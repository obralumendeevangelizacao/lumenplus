"""
Rotas de Organização
====================
Unidades organizacionais, convites, membros.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.models import User, OrgUnit, OrgUnitType, GroupType, Visibility, OrgRoleCode
from app.api.routes.auth import get_current_user
from app.schemas.organization import (
    CreateOrgUnitRequest, OrgUnitOut, OrgUnitWithChildren, OrgTreeResponse,
    SendInviteRequest, InviteDetailOut, InviteResponse, PendingInvitesResponse,
    MemberOut, MembersListResponse,
)
from app.services.organization import (
    OrgServiceError, create_org_unit, send_invite, respond_to_invite,
    get_org_tree, get_org_unit_members, get_org_unit_pending_invites,
    is_coordinator_of,
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

@router.get("/tree", response_model=OrgTreeResponse)
async def get_organization_tree(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retorna árvore organizacional."""
    root = get_org_tree(db, user.id)
    
    if not root:
        return OrgTreeResponse(root=None)
    
    def build_tree(unit: OrgUnit, depth: int = 0) -> OrgUnitWithChildren:
        children = []
        if depth < 5:  # Limita profundidade
            for child in unit.children:
                if child.is_active:
                    # TODO: Filtrar por visibilidade
                    children.append(build_tree(child, depth + 1))
        
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
            member_count=len([m for m in unit.memberships if m.status.value == "ACTIVE"]),
        )
    
    return OrgTreeResponse(root=build_tree(root))


@router.post("/units/{parent_id}/children", response_model=OrgUnitOut)
async def create_child_unit(
    parent_id: UUID,
    data: CreateOrgUnitRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Cria unidade filha."""
    # Determina tipo baseado no parent
    parent = db.get(OrgUnit, parent_id)
    if not parent:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Unidade pai não encontrada"})
    
    type_mapping = {
        "CONSELHO_GERAL": OrgUnitType.CONSELHO_EXECUTIVO,
        "CONSELHO_EXECUTIVO": OrgUnitType.SETOR,
        "SETOR": OrgUnitType.MINISTERIO if not data.group_type else OrgUnitType.GRUPO,
        "MINISTERIO": OrgUnitType.GRUPO,
    }
    
    child_type = type_mapping.get(parent.type.value)
    if not child_type:
        raise HTTPException(status_code=400, detail={"error": "invalid_parent", "message": "Esta unidade não pode ter filhos"})
    
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
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retorna detalhes de uma unidade."""
    unit = db.get(OrgUnit, org_unit_id)
    if not unit:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Unidade não encontrada"})
    
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
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Lista membros de uma unidade."""
    unit = db.get(OrgUnit, org_unit_id)
    if not unit:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Unidade não encontrada"})
    
    try:
        memberships = get_org_unit_members(db, org_unit_id, user.id)
        
        members = []
        for m in memberships:
            member_user = m.user
            profile = member_user.profile
            email = member_user.identities[0].email if member_user.identities else None
            
            members.append(MemberOut(
                user_id=m.user_id,
                user_name=profile.full_name if profile else "Usuário",
                user_email=email,
                role=m.role.value,
                status=m.status.value,
                joined_at=m.joined_at,
            ))
        
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
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
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
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Lista convites pendentes da unidade (só coordenador)."""
    try:
        invites = get_org_unit_pending_invites(db, org_unit_id, user.id)
        
        invite_list = []
        for inv in invites:
            invited_user = inv.invited_user
            invited_by = inv.invited_by_user
            
            invite_list.append(InviteDetailOut(
                id=inv.id,
                org_unit_id=inv.org_unit_id,
                org_unit_name=inv.org_unit.name,
                org_unit_type=inv.org_unit.type.value,
                invited_user_id=inv.invited_user_id,
                invited_user_name=invited_user.profile.full_name if invited_user.profile else "Usuário",
                invited_user_email=invited_user.identities[0].email if invited_user.identities else None,
                invited_by_user_id=inv.invited_by_user_id,
                invited_by_name=invited_by.profile.full_name if invited_by.profile else "Usuário",
                role=inv.role.value,
                status=inv.status.value,
                message=inv.message,
                created_at=inv.created_at,
                expires_at=inv.expires_at,
                responded_at=inv.responded_at,
            ))
        
        return PendingInvitesResponse(
            org_unit_id=org_unit_id,
            invites=invite_list,
        )
    except OrgServiceError as e:
        handle_org_error(e)


@router.post("/invites/{invite_id}/accept", response_model=InviteResponse)
async def accept_invite(
    invite_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
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
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
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
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Lista convites pendentes do usuário logado."""
    from app.services.organization import get_user_pending_invites
    
    invites = get_user_pending_invites(db, user.id)
    
    result = []
    for inv in invites:
        invited_by = inv.invited_by_user
        invited_by_name = "Desconhecido"
        if invited_by and invited_by.profile:
            invited_by_name = invited_by.profile.full_name or "Usuário"
        
        result.append(InviteDetailOut(
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
        ))
    
    return result


@router.get("/my/memberships")
async def get_my_memberships(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Lista memberships ativos do usuário."""
    from app.db.models import OrgMembership, MembershipStatus
    from sqlalchemy import select
    
    memberships = db.execute(
        select(OrgMembership)
        .where(
            OrgMembership.user_id == user.id,
            OrgMembership.status == MembershipStatus.ACTIVE,
        )
    ).scalars().all()
    
    result = []
    for m in memberships:
        result.append({
            "id": str(m.id),
            "org_unit_id": str(m.org_unit_id),
            "org_unit_name": m.org_unit.name,
            "org_unit_type": m.org_unit.type.value,
            "role": m.role.value,
            "joined_at": m.joined_at.isoformat(),
        })
    
    return result


# =============================================================================
# MEMBER MANAGEMENT (gerenciamento de membros)
# =============================================================================

@router.get("/units/{org_unit_id}/search-users")
async def search_users_to_invite(
    org_unit_id: UUID,
    q: str = "",
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Busca usuários para convidar (exclui membros e convites pendentes)."""
    from app.services.organization import search_users_for_invite
    
    if len(q) < 2:
        return []
    
    try:
        users = search_users_for_invite(db, org_unit_id, user.id, q)
        
        result = []
        for u in users:
            result.append({
                "id": str(u.id),
                "name": u.profile.full_name if u.profile else "Usuário",
                "email": u.identities[0].email if u.identities else None,
                "photo_url": u.profile.photo_url if u.profile else None,
            })
        
        return result
    except OrgServiceError as e:
        handle_org_error(e)


@router.put("/units/{org_unit_id}/members/{member_user_id}/role")
async def update_member_role_endpoint(
    org_unit_id: UUID,
    member_user_id: UUID,
    role: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Atualiza papel de um membro (COORDINATOR ou MEMBER)."""
    from app.services.organization import update_member_role
    
    try:
        new_role = OrgRoleCode(role)
    except ValueError:
        raise HTTPException(status_code=400, detail={"error": "invalid_role", "message": "Papel inválido"})
    
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
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Remove um membro da unidade."""
    from app.services.organization import remove_member
    
    try:
        remove_member(db, org_unit_id, member_user_id, user.id)
        return {"message": "Membro removido com sucesso"}
    except OrgServiceError as e:
        handle_org_error(e)


@router.post("/units/{org_unit_id}/leave")
async def leave_unit(
    org_unit_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Sai de uma unidade (remove a si mesmo)."""
    from app.services.organization import remove_member
    
    try:
        remove_member(db, org_unit_id, user.id, user.id)
        return {"message": "Você saiu da unidade"}
    except OrgServiceError as e:
        handle_org_error(e)


@router.get("/units/{org_unit_id}/permissions")
async def get_unit_permissions(
    org_unit_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retorna permissões do usuário na unidade."""
    from app.services.organization import get_user_permissions
    
    return get_user_permissions(db, user.id, org_unit_id)
