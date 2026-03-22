"""
Rotas de Organização
====================
Unidades organizacionais, convites, membros.
"""

from uuid import UUID

from fastapi import APIRouter, HTTPException

from sqlalchemy import select as sa_select
from sqlalchemy.orm import selectinload

from app.api.deps import CurrentUser, DBSession
from app.db.models import MembershipStatus, OrgMembership, OrgUnit, OrgUnitType, GroupType, Visibility, OrgRoleCode
from app.schemas.organization import (
    CreateOrgUnitRequest,
    InviteDetailOut,
    InviteResponse,
    MemberOut,
    MembersListResponse,
    OrgTreeResponse,
    OrgUnitOut,
    OrgUnitWithChildren,
    PendingInvitesResponse,
    SendInviteRequest,
    UpdateOrgUnitRequest,
)
from app.services.organization import (
    OrgServiceError,
    create_org_unit,
    get_org_tree,
    get_org_unit_members,
    get_org_unit_pending_invites,
    get_user_global_roles,
    get_user_pending_invites,
    get_user_permissions,
    remove_member,
    respond_to_invite,
    search_users_for_invite,
    send_invite,
    update_member_role,
    update_org_unit,
)

router = APIRouter(prefix="/org", tags=["organization"])


def handle_org_error(e: OrgServiceError):
    """Converte OrgServiceError em HTTPException."""
    status_codes = {
        "permission_denied": 403,
        "not_found": 404,
        "parent_not_found": 404,
        "org_unit_not_found": 404,
        "user_not_found": 404,
        "invite_not_found": 404,
    }
    status = 400
    for key, code in status_codes.items():
        if key in e.code:
            status = code
            break
    raise HTTPException(status_code=status, detail={"error": e.code, "message": e.message})


# =============================================================================
# ORG UNITS
# =============================================================================


@router.post("/root-unit", response_model=OrgUnitOut, status_code=201)
async def create_root_unit(
    data: CreateOrgUnitRequest,
    user: CurrentUser,
    db: DBSession,
):
    """
    Cria a unidade raiz (CONSELHO_GERAL). Requer papel global DEV ou ADMIN.
    Só pode existir uma unidade raiz ativa.
    """
    global_roles = get_user_global_roles(db, user.id)
    if not any(r in global_roles for r in ["DEV", "ADMIN"]):
        raise HTTPException(
            status_code=403,
            detail={
                "error": "permission_denied",
                "message": "Requer papel DEV ou ADMIN para criar a unidade raiz",
            },
        )

    existing_root = db.execute(
        sa_select(OrgUnit).where(OrgUnit.parent_id == None, OrgUnit.is_active)  # noqa: E711
    ).scalar_one_or_none()

    if existing_root:
        raise HTTPException(
            status_code=409,
            detail={
                "error": "root_exists",
                "message": f"Já existe uma unidade raiz: '{existing_root.name}'",
            },
        )

    try:
        unit = create_org_unit(
            db=db,
            user_id=user.id,
            parent_id=None,
            org_type=OrgUnitType.CONSELHO_GERAL,
            name=data.name,
            description=data.description,
            visibility=Visibility.PUBLIC,
            group_type=None,
            coordinator_user_ids=data.coordinator_user_ids,
        )
        db.commit()
        db.refresh(unit)

        return OrgUnitOut(
            id=unit.id,
            type=unit.type.value,
            group_type=None,
            name=unit.name,
            slug=unit.slug,
            description=unit.description,
            visibility=unit.visibility.value,
            is_active=unit.is_active,
            parent_id=unit.parent_id,
            created_at=unit.created_at,
        )
    except OrgServiceError as e:
        handle_org_error(e)


@router.get("/ministries")
async def list_ministries(
    user: CurrentUser,
    db: DBSession,
):
    """
    Lista todos os ministérios ativos (tipo MINISTERIO).

    Usado pelo app mobile no formulário de perfil para o campo
    "Interesse em Ministério". Retorna apenas id, name e slug.
    """
    ministries = (
        db.execute(
            sa_select(OrgUnit)
            .where(
                OrgUnit.type == OrgUnitType.MINISTERIO,
                OrgUnit.is_active,  # noqa: E711
            )
            .order_by(OrgUnit.name)
        )
        .scalars()
        .all()
    )

    return {"ministries": [{"id": str(m.id), "name": m.name, "slug": m.slug} for m in ministries]}


@router.get("/tree", response_model=OrgTreeResponse)
async def get_organization_tree(
    user: CurrentUser,
    db: DBSession,
):
    """Retorna árvore organizacional.

    Carrega todos os nós e memberships em 2 queries (eager loading) em vez de N+1.
    """
    # Carrega todas as unidades ativas com children e memberships de uma vez
    all_units_result = db.execute(
        sa_select(OrgUnit)
        .where(OrgUnit.is_active == True)  # noqa: E712
        .options(
            selectinload(OrgUnit.memberships),
        )
    )
    all_units = all_units_result.scalars().all()

    if not all_units:
        return OrgTreeResponse(root=None)

    # Monta lookup e encontra raiz em Python (sem novas queries)
    units_by_id: dict = {u.id: u for u in all_units}
    root = next(
        (u for u in all_units if u.type == OrgUnitType.CONSELHO_GERAL and u.parent_id is None),
        None,
    )

    if not root:
        return OrgTreeResponse(root=None)

    def build_tree(unit: OrgUnit, depth: int = 0) -> OrgUnitWithChildren:
        children = []
        if depth < 5:
            for child in all_units:
                if child.parent_id == unit.id and child.is_active:
                    children.append(build_tree(child, depth + 1))

        active_member_count = sum(
            1 for m in unit.memberships if m.status == MembershipStatus.ACTIVE
        )
        return OrgUnitWithChildren(
            id=unit.id,
            type=unit.type.value,
            group_type=unit.group_type.value if unit.group_type else None,
            name=unit.name,
            slug=unit.slug,
            description=unit.description,
            visibility=unit.visibility.value,
            is_active=unit.is_active,
            parent_id=unit.parent_id,
            created_at=unit.created_at,
            children=children,
            member_count=active_member_count,
        )

    return OrgTreeResponse(root=build_tree(root))


@router.post("/units/{parent_id}/children", response_model=OrgUnitOut)
async def create_child_unit(
    parent_id: UUID,
    data: CreateOrgUnitRequest,
    user: CurrentUser,
    db: DBSession,
):
    """Cria unidade filha."""
    # Determina tipo baseado no parent
    parent = db.get(OrgUnit, parent_id)
    if not parent:
        raise HTTPException(
            status_code=404, detail={"error": "not_found", "message": "Unidade pai não encontrada"}
        )

    type_mapping = {
        "CONSELHO_GERAL": OrgUnitType.CONSELHO_EXECUTIVO,
        "CONSELHO_EXECUTIVO": OrgUnitType.SETOR,
        "SETOR": OrgUnitType.MINISTERIO if not data.group_type else OrgUnitType.GRUPO,
        "MINISTERIO": OrgUnitType.GRUPO,
    }

    child_type = type_mapping.get(parent.type.value)
    if not child_type:
        raise HTTPException(
            status_code=400,
            detail={"error": "invalid_parent", "message": "Esta unidade não pode ter filhos"},
        )

    # Se group_type foi fornecido, é um GRUPO
    if data.group_type:
        child_type = OrgUnitType.GRUPO

    try:
        group_type = GroupType(data.group_type) if data.group_type else None
        visibility = Visibility(data.visibility) if data.visibility else Visibility.PUBLIC

        unit = create_org_unit(
            db=db,
            user_id=user.id,
            parent_id=parent_id,
            org_type=child_type,
            name=data.name,
            description=data.description,
            visibility=visibility,
            group_type=group_type,
            coordinator_user_ids=data.coordinator_user_ids,
        )

        return OrgUnitOut(
            id=unit.id,
            type=unit.type.value,
            group_type=unit.group_type.value if unit.group_type else None,
            name=unit.name,
            slug=unit.slug,
            description=unit.description,
            visibility=unit.visibility.value,
            is_active=unit.is_active,
            parent_id=unit.parent_id,
            created_at=unit.created_at,
        )
    except OrgServiceError as e:
        handle_org_error(e)


@router.get("/units/{org_unit_id}", response_model=OrgUnitOut)
async def get_org_unit(
    org_unit_id: UUID,
    user: CurrentUser,
    db: DBSession,
):
    """Retorna detalhes de uma unidade."""
    unit = db.get(OrgUnit, org_unit_id)
    if not unit:
        raise HTTPException(
            status_code=404, detail={"error": "not_found", "message": "Unidade não encontrada"}
        )

    return OrgUnitOut(
        id=unit.id,
        type=unit.type.value,
        group_type=unit.group_type.value if unit.group_type else None,
        name=unit.name,
        slug=unit.slug,
        description=unit.description,
        visibility=unit.visibility.value,
        is_active=unit.is_active,
        parent_id=unit.parent_id,
        created_at=unit.created_at,
    )


# =============================================================================
# MEMBERS
# =============================================================================


@router.get("/units/{org_unit_id}/members", response_model=MembersListResponse)
async def list_members(
    org_unit_id: UUID,
    user: CurrentUser,
    db: DBSession,
):
    """Lista membros de uma unidade."""
    unit = db.get(OrgUnit, org_unit_id)
    if not unit:
        raise HTTPException(
            status_code=404, detail={"error": "not_found", "message": "Unidade não encontrada"}
        )

    try:
        memberships = get_org_unit_members(db, org_unit_id, user.id)

        members = []
        for m in memberships:
            member_user = m.user
            profile = member_user.profile
            email = member_user.identities[0].email if member_user.identities else None

            members.append(
                MemberOut(
                    user_id=m.user_id,
                    user_name=profile.full_name if profile else "Usuário",
                    user_email=email,
                    role=m.role.value,
                    status=m.status.value,
                    joined_at=m.joined_at,
                )
            )

        return MembersListResponse(
            org_unit_id=org_unit_id,
            org_unit_name=unit.name,
            members=members,
            total=len(members),
        )
    except OrgServiceError as e:
        handle_org_error(e)


# =============================================================================
# INVITES
# =============================================================================


@router.post("/units/{org_unit_id}/invites", response_model=InviteResponse)
async def send_member_invite(
    org_unit_id: UUID,
    data: SendInviteRequest,
    user: CurrentUser,
    db: DBSession,
):
    """Envia convite para participar da unidade."""
    try:
        role = OrgRoleCode(data.role) if data.role else OrgRoleCode.MEMBER

        invite = send_invite(
            db=db,
            org_unit_id=org_unit_id,
            invited_user_id=data.user_id,
            invited_by_user_id=user.id,
            role=role,
            message=data.message,
        )

        return InviteResponse(
            message="Convite enviado com sucesso",
            invite_id=invite.id,
            status=invite.status.value,
        )
    except OrgServiceError as e:
        handle_org_error(e)


@router.get("/units/{org_unit_id}/invites/pending", response_model=PendingInvitesResponse)
async def list_pending_invites(
    org_unit_id: UUID,
    user: CurrentUser,
    db: DBSession,
):
    """Lista convites pendentes da unidade (só coordenador)."""
    try:
        invites = get_org_unit_pending_invites(db, org_unit_id, user.id)

        invite_list = []
        for inv in invites:
            invited_user = inv.invited_user
            invited_by = inv.invited_by_user

            invite_list.append(
                InviteDetailOut(
                    id=inv.id,
                    org_unit_id=inv.org_unit_id,
                    org_unit_name=inv.org_unit.name,
                    org_unit_type=inv.org_unit.type.value,
                    invited_user_id=inv.invited_user_id,
                    invited_user_name=invited_user.profile.full_name
                    if invited_user.profile
                    else "Usuário",
                    invited_user_email=invited_user.identities[0].email
                    if invited_user.identities
                    else None,
                    invited_by_user_id=inv.invited_by_user_id,
                    invited_by_name=invited_by.profile.full_name
                    if invited_by.profile
                    else "Usuário",
                    role=inv.role.value,
                    status=inv.status.value,
                    message=inv.message,
                    created_at=inv.created_at,
                    expires_at=inv.expires_at,
                    responded_at=inv.responded_at,
                )
            )

        return PendingInvitesResponse(
            org_unit_id=org_unit_id,
            invites=invite_list,
        )
    except OrgServiceError as e:
        handle_org_error(e)


@router.post("/invites/{invite_id}/accept", response_model=InviteResponse)
async def accept_invite(
    invite_id: UUID,
    user: CurrentUser,
    db: DBSession,
):
    """Aceita um convite."""
    try:
        invite = respond_to_invite(db, invite_id, user.id, accept=True)
        return InviteResponse(
            message="Convite aceito! Você agora é membro.",
            invite_id=invite.id,
            status=invite.status.value,
        )
    except OrgServiceError as e:
        handle_org_error(e)


@router.post("/invites/{invite_id}/reject", response_model=InviteResponse)
async def reject_invite(
    invite_id: UUID,
    user: CurrentUser,
    db: DBSession,
):
    """Rejeita um convite."""
    try:
        invite = respond_to_invite(db, invite_id, user.id, accept=False)
        return InviteResponse(
            message="Convite recusado.",
            invite_id=invite.id,
            status=invite.status.value,
        )
    except OrgServiceError as e:
        handle_org_error(e)


# =============================================================================
# MY INVITES (convites do usuário logado)
# =============================================================================


@router.get("/my/invites", response_model=list[InviteDetailOut])
async def get_my_pending_invites(
    user: CurrentUser,
    db: DBSession,
):
    """Lista convites pendentes do usuário logado."""
    invites = get_user_pending_invites(db, user.id)

    result = []
    for inv in invites:
        invited_by = inv.invited_by_user
        invited_by_name = "Desconhecido"
        if invited_by and invited_by.profile:
            invited_by_name = invited_by.profile.full_name or "Usuário"

        result.append(
            InviteDetailOut(
                id=inv.id,
                org_unit_id=inv.org_unit_id,
                org_unit_name=inv.org_unit.name,
                org_unit_type=inv.org_unit.type.value,
                invited_user_id=inv.invited_user_id,
                invited_user_name=user.profile.full_name if user.profile else "Você",
                invited_user_email=user.identities[0].email if user.identities else None,
                invited_by_user_id=inv.invited_by_user_id,
                invited_by_name=invited_by_name,
                role=inv.role.value,
                status=inv.status.value,
                message=inv.message,
                created_at=inv.created_at,
                expires_at=inv.expires_at,
                responded_at=inv.responded_at,
            )
        )

    return result


@router.get("/my/memberships")
async def get_my_memberships(
    user: CurrentUser,
    db: DBSession,
):
    """Lista memberships ativos do usuário."""
    memberships = (
        db.execute(
            sa_select(OrgMembership).where(
                OrgMembership.user_id == user.id,
                OrgMembership.status == MembershipStatus.ACTIVE,
            )
        )
        .scalars()
        .all()
    )

    result = []
    for m in memberships:
        result.append(
            {
                "id": str(m.id),
                "org_unit_id": str(m.org_unit_id),
                "org_unit_name": m.org_unit.name,
                "org_unit_type": m.org_unit.type.value,
                "retreat_scope": m.org_unit.retreat_scope,
                "role": m.role.value,
                "status": m.status.value,
                "joined_at": m.joined_at.isoformat(),
            }
        )

    return result


# =============================================================================
# MEMBER MANAGEMENT (gerenciamento de membros)
# =============================================================================


@router.get("/units/{org_unit_id}/search-users")
async def search_users_to_invite(
    org_unit_id: UUID,
    user: CurrentUser,
    db: DBSession,
    q: str = "",
):
    """Busca usuários para convidar (exclui membros e convites pendentes)."""
    if len(q) < 2:
        return []

    try:
        users = search_users_for_invite(db, org_unit_id, user.id, q)

        result = []
        for u in users:
            result.append(
                {
                    "id": str(u.id),
                    "name": u.profile.full_name if u.profile else "Usuário",
                    "email": u.identities[0].email if u.identities else None,
                    "photo_url": u.profile.photo_url if u.profile else None,
                }
            )

        return result
    except OrgServiceError as e:
        handle_org_error(e)


@router.put("/units/{org_unit_id}/members/{member_user_id}/role")
async def update_member_role_endpoint(
    org_unit_id: UUID,
    member_user_id: UUID,
    role: str,
    user: CurrentUser,
    db: DBSession,
):
    """Atualiza papel de um membro (COORDINATOR ou MEMBER)."""
    try:
        new_role = OrgRoleCode(role)
    except ValueError:
        raise HTTPException(
            status_code=400, detail={"error": "invalid_role", "message": "Papel inválido"}
        )

    try:
        membership = update_member_role(db, org_unit_id, member_user_id, user.id, new_role)
        return {
            "message": "Papel atualizado com sucesso",
            "user_id": str(member_user_id),
            "new_role": membership.role.value,
        }
    except OrgServiceError as e:
        handle_org_error(e)


@router.delete("/units/{org_unit_id}/members/{member_user_id}")
async def remove_member_endpoint(
    org_unit_id: UUID,
    member_user_id: UUID,
    user: CurrentUser,
    db: DBSession,
):
    """Remove um membro da unidade."""
    try:
        remove_member(db, org_unit_id, member_user_id, user.id)
        return {"message": "Membro removido com sucesso"}
    except OrgServiceError as e:
        handle_org_error(e)


@router.post("/units/{org_unit_id}/leave")
async def leave_unit(
    org_unit_id: UUID,
    user: CurrentUser,
    db: DBSession,
):
    """Sai de uma unidade (remove a si mesmo)."""
    try:
        remove_member(db, org_unit_id, user.id, user.id)
        return {"message": "Você saiu da unidade"}
    except OrgServiceError as e:
        handle_org_error(e)


@router.get("/units/{org_unit_id}/permissions")
async def get_unit_permissions(
    org_unit_id: UUID,
    user: CurrentUser,
    db: DBSession,
):
    """Retorna permissões do usuário na unidade."""
    return get_user_permissions(db, user.id, org_unit_id)


# =============================================================================
# EDIÇÃO DE UNIDADES
# =============================================================================


@router.patch("/units/{unit_id}", response_model=OrgUnitOut)
async def update_org_unit_endpoint(
    unit_id: UUID,
    data: UpdateOrgUnitRequest,
    user: CurrentUser,
    db: DBSession,
):
    """Edita nome e/ou descrição de uma unidade. Requer permissão hierárquica."""
    try:
        unit = update_org_unit(
            db,
            unit_id=unit_id,
            user_id=user.id,
            name=data.name,
            description=data.description,
        )
    except OrgServiceError as e:
        handle_org_error(e)

    return OrgUnitOut(
        id=unit.id,
        name=unit.name,
        type=unit.type.value,
        description=unit.description,
        visibility=unit.visibility.value,
        is_active=unit.is_active,
        parent_id=unit.parent_id,
        slug=unit.slug,
        created_at=unit.created_at,
    )


@router.patch("/units/{unit_id}/retreat-scope")
async def set_retreat_scope(
    unit_id: UUID,
    user: CurrentUser,
    db: DBSession,
    enabled: bool = True,
):
    """Ativa ou desativa escopo de retiro numa unidade organizacional. Requer ADMIN ou DEV."""
    roles = get_user_global_roles(db, user.id)
    if not any(r in roles for r in ("ADMIN", "DEV")):
        raise HTTPException(
            status_code=403,
            detail={"error": "forbidden", "message": "Apenas administradores podem configurar este campo"},
        )
    unit = db.get(OrgUnit, unit_id)
    if not unit:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Unidade não encontrada"})
    unit.retreat_scope = enabled
    db.commit()
    return {"id": str(unit.id), "name": unit.name, "retreat_scope": unit.retreat_scope}
