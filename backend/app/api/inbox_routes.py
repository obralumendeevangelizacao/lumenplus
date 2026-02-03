"""
Inbox Routes
============
Rotas para o sistema de avisos/inbox.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.models import User
from app.api.routes.auth import get_current_user
from app.services.inbox_service import InboxService, PERMISSION_SEND_INBOX
from app.schemas.inbox import (
    InboxSendRequest,
    InboxPreviewRequest,
    InboxListResponse,
    InboxMessageResponse,
    InboxPreviewResponse,
    InboxSendResponse,
    InboxFiltersOptionsResponse,
    UserPermissionsResponse,
)

router = APIRouter(prefix="/inbox", tags=["inbox"])


# === ROTAS DO USUÁRIO ===

@router.get("", response_model=InboxListResponse)
def get_inbox(
    include_read: bool = True,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
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


@router.get("/unread")
def get_unread_messages(
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lista apenas mensagens não lidas."""
    service = InboxService(db)
    messages = service.get_unread_messages(current_user.id, limit=limit)
    return messages


@router.patch("/{recipient_id}/read")
def mark_as_read(
    recipient_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Marca uma mensagem como lida."""
    service = InboxService(db)
    success = service.mark_as_read(current_user.id, recipient_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mensagem não encontrada ou já lida",
        )
    
    return {"success": True}


@router.patch("/read-all")
def mark_all_as_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Marca todas as mensagens como lidas."""
    service = InboxService(db)
    count = service.mark_all_as_read(current_user.id)
    return {"success": True, "count": count}


# === ROTAS DE ENVIO (REQUER PERMISSÃO) ===

def require_send_permission(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> User:
    """Dependency que verifica se usuário pode enviar avisos."""
    service = InboxService(db)
    if not service.user_has_permission(current_user.id, PERMISSION_SEND_INBOX):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Você não tem permissão para enviar avisos",
        )
    return current_user


@router.get("/send/filters", response_model=InboxFiltersOptionsResponse)
def get_filter_options(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_send_permission),
):
    """Retorna opções disponíveis para filtros de segmentação."""
    service = InboxService(db)
    options = service.get_filter_options()
    return InboxFiltersOptionsResponse(**options)


@router.post("/send/preview", response_model=InboxPreviewResponse)
def preview_send(
    request: InboxPreviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_send_permission),
):
    """Preview de quantos usuários receberão o aviso."""
    service = InboxService(db)
    count = service.preview_send(request.send_to_all, request.filters)
    
    return InboxPreviewResponse(
        recipient_count=count,
        filters_applied=request.filters.model_dump() if request.filters else None,
    )


@router.post("/send", response_model=InboxSendResponse)
def send_message(
    request: InboxSendRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_send_permission),
):
    """Envia um aviso para os destinatários."""
    service = InboxService(db)
    
    # Validar que tem destinatários
    if not request.send_to_all and not request.filters:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Selecione 'enviar para todos' ou defina filtros de segmentação",
        )
    
    # Converter attachments para dict
    attachments = None
    if request.attachments:
        attachments = [a.model_dump() for a in request.attachments]
    
    message_id, recipient_count = service.send_message(
        title=request.title,
        message=request.message,
        message_type=request.type,
        created_by_user_id=current_user.id,
        send_to_all=request.send_to_all,
        filters=request.filters,
        attachments=attachments,
    )
    
    return InboxSendResponse(
        message_id=message_id,
        recipient_count=recipient_count,
        success=True,
    )


@router.get("/sent")
def get_sent_messages(
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_send_permission),
):
    """Lista mensagens enviadas pelo usuário."""
    service = InboxService(db)
    messages = service.get_sent_messages(current_user.id, limit=limit)
    return {"messages": messages}


# === ROTA DE PERMISSÕES ===

@router.get("/permissions", response_model=UserPermissionsResponse)
def get_my_permissions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retorna permissões do usuário atual."""
    service = InboxService(db)
    permissions = service.get_user_permissions(current_user.id)
    
    return UserPermissionsResponse(
        permissions=permissions,
        has_admin_access=PERMISSION_SEND_INBOX in permissions,
    )
