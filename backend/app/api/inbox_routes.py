"""
Inbox Routes
============
Rotas para o sistema de avisos/inbox.
"""

from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from fastapi.routing import APIRouter

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, DBSession
from app.db.models import OrgMembership, OrgUnit, MembershipStatus
from app.services.inbox_service import InboxService, PERMISSION_SEND_INBOX
from app.services.organization import get_user_global_roles, is_conselho_geral_coordinator
from app.schemas.inbox import (
    InboxSendRequest,
    InboxPreviewRequest,
    InboxListResponse,
    InboxMessageResponse,
    InboxPreviewResponse,
    InboxSendResponse,
    InboxSentMessageResponse,
    InboxSentResponse,
    InboxFiltersOptionsResponse,
    UserPermissionsResponse,
    SendScopesResponse,
    OrgScopeResponse,
)

router = APIRouter(prefix="/inbox", tags=["inbox"])


# === HELPER DE PERMISSÃO ===


def _has_full_send_access(db: Session, user_id: Any) -> bool:
    """
    Retorna True se o usuário tem acesso nativo completo de envio:
    role global AVISOS, DEV, ADMIN ou SECRETARY, ou coordenador do Conselho Geral.
    """
    global_roles = get_user_global_roles(db, user_id)
    if any(r in global_roles for r in ["DEV", "ADMIN", "AVISOS", "SECRETARY"]):
        return True
    return is_conselho_geral_coordinator(db, user_id)


def _check_send_permission(db: DBSession, current_user: CurrentUser) -> None:
    """
    Levanta 403 se o usuário não pode enviar avisos.
    Aceita CAN_SEND_INBOX, coordenador de qualquer OrgUnit, role AVISOS, DEV ou ADMIN.
    """
    service = InboxService(db)
    if service.user_can_send(current_user.id) or _has_full_send_access(db, current_user.id):
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={"error": "forbidden", "message": "Você não tem permissão para enviar avisos"},
    )


def _check_global_send_permission(db: DBSession, current_user: CurrentUser) -> None:
    """
    Levanta 403 se o usuário não pode enviar avisos globais (para todos).
    Aceita CAN_SEND_INBOX, role AVISOS, DEV, ADMIN ou coordenador do Conselho Geral.
    """
    service = InboxService(db)
    if service.user_has_permission(current_user.id, PERMISSION_SEND_INBOX):
        return
    if _has_full_send_access(db, current_user.id):
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={
            "error": "forbidden",
            "message": "Você não tem permissão para enviar avisos globais",
        },
    )


# === ROTAS DO USUÁRIO ===


@router.get("", response_model=InboxListResponse)
def get_inbox(
    db: DBSession,
    current_user: CurrentUser,
    include_read: bool = True,
    limit: int = 50,
    offset: int = 0,
) -> Any:
    """Lista mensagens do inbox do usuário."""
    service = InboxService(db)
    messages, total, unread_count = service.get_user_inbox(
        user_id=current_user.id,
        include_read=include_read,
        limit=limit,
        offset=offset,
    )
    return InboxListResponse(
        messages=[InboxMessageResponse(**m) for m in messages],
        total=total,
        unread_count=unread_count,
    )


@router.get("/unread", response_model=list[InboxMessageResponse])
def get_unread_messages(
    db: DBSession,
    current_user: CurrentUser,
    limit: int = 10,
) -> Any:
    """Lista apenas mensagens não lidas."""
    service = InboxService(db)
    messages = service.get_unread_messages(current_user.id, limit=limit)
    return [InboxMessageResponse(**m) for m in messages]


@router.patch("/read-all")
def mark_all_as_read(
    db: DBSession,
    current_user: CurrentUser,
) -> Any:
    """Marca todas as mensagens como lidas."""
    service = InboxService(db)
    count = service.mark_all_as_read(current_user.id)
    return {"success": True, "count": count}


@router.patch("/{recipient_id}/read")
def mark_as_read(
    recipient_id: UUID,
    db: DBSession,
    current_user: CurrentUser,
) -> Any:
    """
    Marca uma mensagem como lida (idempotente).
    Retorna 200 mesmo que já esteja lida; 404 apenas se o recipient não existir
    ou não pertencer ao usuário autenticado.
    """
    service = InboxService(db)
    found = service.mark_as_read(current_user.id, recipient_id)

    if not found:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "not_found", "message": "Mensagem não encontrada"},
        )

    return {"success": True}


# === ROTAS DE PERMISSÕES ===


@router.get("/permissions", response_model=UserPermissionsResponse)
def get_my_permissions(
    db: DBSession,
    current_user: CurrentUser,
) -> Any:
    """Retorna permissões do usuário atual."""
    service = InboxService(db)
    permissions = service.get_user_permissions(current_user.id)
    global_roles = get_user_global_roles(db, current_user.id)
    is_global_admin = any(r in global_roles for r in ["DEV", "ADMIN"])
    has_admin = (
        PERMISSION_SEND_INBOX in permissions
        or any(r in global_roles for r in ["DEV", "ADMIN", "SECRETARY", "AVISOS"])
        or is_conselho_geral_coordinator(db, current_user.id)
    )
    # Verifica acesso a retiros: ADMIN/DEV, PERMISSION_MANAGE_RETREATS ou
    # membro ativo de qualquer unidade com retreat_scope=True
    from app.api.admin_retreat_routes import _is_global_retreat_manager

    has_retreat = _is_global_retreat_manager(db, current_user.id)
    if not has_retreat:
        retreat_membership = db.execute(
            select(OrgMembership)
            .join(OrgUnit, OrgUnit.id == OrgMembership.org_unit_id)
            .where(
                OrgMembership.user_id == current_user.id,
                OrgMembership.status == MembershipStatus.ACTIVE,
                OrgUnit.retreat_scope.is_(True),
            )
        ).scalar_one_or_none()
        has_retreat = retreat_membership is not None

    return UserPermissionsResponse(
        permissions=permissions,
        has_admin_access=has_admin,
        is_global_admin=is_global_admin,
        has_retreat_access=has_retreat,
    )


# === ROTAS DE ENVIO (REQUER CAN_SEND_INBOX) ===


@router.get("/send/scopes", response_model=SendScopesResponse)
def get_send_scopes(
    db: DBSession,
    current_user: CurrentUser,
) -> Any:
    """
    Retorna os escopos disponíveis para envio de aviso:
    - can_send_to_all: True se tem CAN_SEND_INBOX
    - scopes: OrgUnits onde o usuário é coordenador ativo
    Retorna 403 se o usuário não tem nenhuma permissão de envio.
    """
    _check_send_permission(db, current_user)
    service = InboxService(db)
    data = service.get_sendable_scopes(current_user.id)
    # Usuários com acesso nativo completo (AVISOS, DEV, ADMIN, coord. Conselho Geral)
    # também podem enviar para todos, mesmo sem CAN_SEND_INBOX explícito
    can_send_to_all = data["can_send_to_all"] or _has_full_send_access(db, current_user.id)
    return SendScopesResponse(
        can_send_to_all=can_send_to_all,
        scopes=[OrgScopeResponse(**s) for s in data["scopes"]],
    )


@router.get("/send/filters", response_model=InboxFiltersOptionsResponse)
def get_filter_options(
    db: DBSession,
    current_user: CurrentUser,
) -> Any:
    """Retorna opções disponíveis para filtros de segmentação de perfil."""
    _check_send_permission(db, current_user)
    service = InboxService(db)
    options = service.get_filter_options()
    return InboxFiltersOptionsResponse(**options)


@router.post("/send/preview", response_model=InboxPreviewResponse)
def preview_send(
    request: InboxPreviewRequest,
    db: DBSession,
    current_user: CurrentUser,
) -> Any:
    """Preview de quantos usuários receberão o aviso."""
    _check_send_permission(db, current_user)
    # Envio global apenas para CAN_SEND_INBOX
    if request.send_to_all:
        _check_global_send_permission(db, current_user)
    service = InboxService(db)
    count = service.preview_send(request.send_to_all, request.filters, request.scope_org_unit_id)
    return InboxPreviewResponse(
        recipient_count=count,
        filters_applied=request.filters.model_dump() if request.filters else None,
    )


@router.post("/send", response_model=InboxSendResponse)
def send_message(
    request: InboxSendRequest,
    db: DBSession,
    current_user: CurrentUser,
) -> Any:
    """Envia um aviso para os destinatários selecionados."""
    _check_send_permission(db, current_user)

    # Envio global (send_to_all) exige permissão explícita CAN_SEND_INBOX
    if request.send_to_all:
        _check_global_send_permission(db, current_user)

    # Deve ter pelo menos um escopo definido
    if not request.send_to_all and not request.scope_org_unit_id and not request.filters:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "bad_request",
                "message": "Selecione 'enviar para todos', um setor/grupo ou defina filtros",
            },
        )

    # Coordenador só pode enviar para as suas próprias OrgUnits
    # (usuários com acesso nativo completo podem enviar para qualquer unidade)
    service = InboxService(db)
    if request.scope_org_unit_id and not service.user_has_permission(
        current_user.id, PERMISSION_SEND_INBOX
    ):
        if not _has_full_send_access(db, current_user.id):
            coordinator_ids = {str(u.id) for u in service._coordinator_org_units(current_user.id)}
            if str(request.scope_org_unit_id) not in coordinator_ids:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail={
                        "error": "forbidden",
                        "message": "Você não é coordenador desta unidade",
                    },
                )

    attachments = [a.model_dump() for a in request.attachments] if request.attachments else None

    message_id, recipient_count = service.send_message(
        title=request.title,
        message=request.message,
        message_type=request.type,
        created_by_user_id=current_user.id,
        send_to_all=request.send_to_all,
        filters=request.filters,
        attachments=attachments,
        scope_org_unit_id=request.scope_org_unit_id,
    )

    return InboxSendResponse(
        message_id=message_id,
        recipient_count=recipient_count,
        success=True,
    )


@router.get("/sent", response_model=InboxSentResponse)
def get_sent_messages(
    db: DBSession,
    current_user: CurrentUser,
    limit: int = 20,
) -> Any:
    """Lista mensagens enviadas pelo usuário (requer CAN_SEND_INBOX)."""
    _check_send_permission(db, current_user)
    service = InboxService(db)
    messages = service.get_sent_messages(current_user.id, limit=limit)
    return InboxSentResponse(messages=[InboxSentMessageResponse(**m) for m in messages])
