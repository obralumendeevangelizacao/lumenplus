"""
Serviço de Organização
======================
Gerencia hierarquia organizacional e convites.
"""

from datetime import datetime, timedelta, timezone
from uuid import UUID
import re

from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.db.models import (
    OrgUnit, OrgUnitType, GroupType, Visibility,
    OrgMembership, MembershipStatus, OrgRoleCode,
    OrgInvite, InviteStatus,
    User, UserGlobalRole, GlobalRole,
)
from app.core.settings import settings
from app.schemas.organization import HIERARCHY_PERMISSIONS, GROUP_TYPES


class OrgServiceError(Exception):
    """Erro do serviço de organização."""
    def __init__(self, code: str, message: str):
        self.code = code
        self.message = message
        super().__init__(message)


def slugify(text: str) -> str:
    """Gera slug a partir de texto."""
    text = text.lower().strip()
    text = re.sub(r"[àáâãäå]", "a", text)
    text = re.sub(r"[èéêë]", "e", text)
    text = re.sub(r"[ìíîï]", "i", text)
    text = re.sub(r"[òóôõö]", "o", text)
    text = re.sub(r"[ùúûü]", "u", text)
    text = re.sub(r"[ç]", "c", text)
    text = re.sub(r"[^a-z0-9]+", "-", text)
    text = re.sub(r"-+", "-", text).strip("-")
    return text


def get_user_global_roles(db: Session, user_id: UUID) -> list[str]:
    """Retorna roles globais do usuário."""
    result = db.execute(
        select(GlobalRole.code)
        .join(UserGlobalRole, UserGlobalRole.global_role_id == GlobalRole.id)
        .where(UserGlobalRole.user_id == user_id)
    )
    return [r[0] for r in result.all()]


def is_coordinator_of(db: Session, user_id: UUID, org_unit_id: UUID) -> bool:
    """Verifica se usuário é coordenador da unidade."""
    result = db.execute(
        select(OrgMembership)
        .where(
            OrgMembership.user_id == user_id,
            OrgMembership.org_unit_id == org_unit_id,
            OrgMembership.role == OrgRoleCode.COORDINATOR,
            OrgMembership.status == MembershipStatus.ACTIVE,
        )
    )
    return result.scalar_one_or_none() is not None


def is_member_of(db: Session, user_id: UUID, org_unit_id: UUID) -> bool:
    """Verifica se usuário é membro da unidade."""
    result = db.execute(
        select(OrgMembership)
        .where(
            OrgMembership.user_id == user_id,
            OrgMembership.org_unit_id == org_unit_id,
            OrgMembership.status == MembershipStatus.ACTIVE,
        )
    )
    return result.scalar_one_or_none() is not None


def can_user_create_child(db: Session, user_id: UUID, parent_unit: OrgUnit, child_type: OrgUnitType) -> bool:
    """
    Verifica se usuário pode criar filho do tipo especificado.
    
    Regras:
    - DEV pode criar CONSELHO_GERAL (sem parent)
    - Coordenador de uma unidade pode criar filhos permitidos
    """
    global_roles = get_user_global_roles(db, user_id)
    
    # CONSELHO_GERAL só pode ser criado por DEV
    if child_type == OrgUnitType.CONSELHO_GERAL:
        return "DEV" in global_roles
    
    # Outros tipos precisam de parent
    if not parent_unit:
        return False
    
    # Verifica se é coordenador do parent
    if not is_coordinator_of(db, user_id, parent_unit.id):
        return False
    
    # Verifica hierarquia permitida
    parent_type = parent_unit.type.value
    permissions = HIERARCHY_PERMISSIONS.get(parent_type, {})
    allowed_children = permissions.get("can_create", [])
    
    return child_type.value in allowed_children


def create_org_unit(
    db: Session,
    user_id: UUID,
    parent_id: UUID | None,
    org_type: OrgUnitType,
    name: str,
    description: str | None = None,
    visibility: Visibility = Visibility.PUBLIC,
    group_type: GroupType | None = None,
    coordinator_user_ids: list[UUID] | None = None,
) -> OrgUnit:
    """
    Cria unidade organizacional.
    
    - Valida hierarquia
    - Cria unidade
    - Adiciona criador como coordenador
    - Adiciona coordenadores extras
    """
    # Busca parent se existir
    parent_unit = None
    if parent_id:
        parent_unit = db.get(OrgUnit, parent_id)
        if not parent_unit:
            raise OrgServiceError("parent_not_found", "Unidade pai não encontrada")
    
    # Valida permissão de criação
    if not can_user_create_child(db, user_id, parent_unit, org_type):
        raise OrgServiceError("permission_denied", "Você não tem permissão para criar este tipo de unidade")
    
    # Valida group_type
    if org_type == OrgUnitType.GRUPO:
        if not group_type:
            raise OrgServiceError("group_type_required", "Tipo de grupo é obrigatório")
        if group_type.value not in GROUP_TYPES:
            raise OrgServiceError("invalid_group_type", f"Tipo de grupo inválido. Use: {GROUP_TYPES}")
    elif group_type:
        raise OrgServiceError("group_type_not_allowed", "Tipo de grupo só pode ser definido para GRUPO")
    
    # Gera slug único
    base_slug = slugify(name)
    slug = base_slug
    counter = 1
    while db.execute(select(OrgUnit).where(OrgUnit.slug == slug)).scalar_one_or_none():
        slug = f"{base_slug}-{counter}"
        counter += 1
    
    # Cria unidade
    org_unit = OrgUnit(
        type=org_type,
        group_type=group_type,
        name=name,
        slug=slug,
        description=description,
        visibility=visibility,
        parent_id=parent_id,
        created_by_user_id=user_id,
    )
    db.add(org_unit)
    db.flush()
    
    # Adiciona criador como coordenador
    creator_membership = OrgMembership(
        user_id=user_id,
        org_unit_id=org_unit.id,
        role=OrgRoleCode.COORDINATOR,
        status=MembershipStatus.ACTIVE,
    )
    db.add(creator_membership)
    
    # Adiciona coordenadores extras (se existirem)
    if coordinator_user_ids:
        for coord_id in coordinator_user_ids:
            if coord_id == user_id:
                continue  # Já adicionado
            
            user = db.get(User, coord_id)
            if not user:
                continue
            
            membership = OrgMembership(
                user_id=coord_id,
                org_unit_id=org_unit.id,
                role=OrgRoleCode.COORDINATOR,
                status=MembershipStatus.ACTIVE,
            )
            db.add(membership)
    
    db.commit()
    db.refresh(org_unit)
    return org_unit


def send_invite(
    db: Session,
    org_unit_id: UUID,
    invited_user_id: UUID,
    invited_by_user_id: UUID,
    role: OrgRoleCode = OrgRoleCode.MEMBER,
    message: str | None = None,
) -> OrgInvite:
    """
    Envia convite para usuário participar de unidade.
    
    - Verifica se quem convida é coordenador
    - Verifica se usuário já é membro
    - Verifica se já existe convite pendente
    """
    # Verifica unidade
    org_unit = db.get(OrgUnit, org_unit_id)
    if not org_unit:
        raise OrgServiceError("org_unit_not_found", "Unidade não encontrada")
    
    # Verifica se é coordenador
    if not is_coordinator_of(db, invited_by_user_id, org_unit_id):
        raise OrgServiceError("permission_denied", "Apenas coordenadores podem enviar convites")
    
    # Verifica se usuário existe
    invited_user = db.get(User, invited_user_id)
    if not invited_user:
        raise OrgServiceError("user_not_found", "Usuário não encontrado")
    
    # Verifica se já é membro
    if is_member_of(db, invited_user_id, org_unit_id):
        raise OrgServiceError("already_member", "Usuário já é membro desta unidade")
    
    # Verifica se já existe convite pendente
    existing = db.execute(
        select(OrgInvite)
        .where(
            OrgInvite.org_unit_id == org_unit_id,
            OrgInvite.invited_user_id == invited_user_id,
            OrgInvite.status == InviteStatus.PENDING,
        )
    ).scalar_one_or_none()
    
    if existing:
        raise OrgServiceError("invite_exists", "Já existe convite pendente para este usuário")
    
    # Cria convite
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.invite_expiration_days)
    
    invite = OrgInvite(
        org_unit_id=org_unit_id,
        invited_user_id=invited_user_id,
        invited_by_user_id=invited_by_user_id,
        role=role,
        status=InviteStatus.PENDING,
        message=message,
        expires_at=expires_at,
    )
    db.add(invite)
    db.commit()
    db.refresh(invite)
    
    return invite


def respond_to_invite(
    db: Session,
    invite_id: UUID,
    user_id: UUID,
    accept: bool,
) -> OrgInvite:
    """
    Responde a um convite.
    
    - Verifica se convite é do usuário
    - Verifica se está pendente
    - Se aceito, cria membership
    """
    invite = db.get(OrgInvite, invite_id)
    if not invite:
        raise OrgServiceError("invite_not_found", "Convite não encontrado")
    
    if invite.invited_user_id != user_id:
        raise OrgServiceError("permission_denied", "Este convite não é para você")
    
    if invite.status != InviteStatus.PENDING:
        raise OrgServiceError("invite_not_pending", f"Convite já foi {invite.status.value}")
    
    # Verifica expiração
    if invite.expires_at and invite.expires_at < datetime.now(timezone.utc):
        invite.status = InviteStatus.EXPIRED
        db.commit()
        raise OrgServiceError("invite_expired", "Convite expirado")
    
    now = datetime.now(timezone.utc)
    invite.responded_at = now
    
    if accept:
        invite.status = InviteStatus.ACCEPTED
        
        # Cria membership
        membership = OrgMembership(
            user_id=user_id,
            org_unit_id=invite.org_unit_id,
            role=invite.role,
            status=MembershipStatus.ACTIVE,
            invite_id=invite.id,
        )
        db.add(membership)
    else:
        invite.status = InviteStatus.REJECTED
    
    db.commit()
    db.refresh(invite)
    return invite


def get_user_pending_invites(db: Session, user_id: UUID) -> list[OrgInvite]:
    """Retorna convites pendentes do usuário."""
    result = db.execute(
        select(OrgInvite)
        .where(
            OrgInvite.invited_user_id == user_id,
            OrgInvite.status == InviteStatus.PENDING,
        )
        .order_by(OrgInvite.created_at.desc())
    )
    return list(result.scalars().all())


def get_org_unit_pending_invites(db: Session, org_unit_id: UUID, user_id: UUID) -> list[OrgInvite]:
    """Retorna convites pendentes de uma unidade (só coordenador pode ver)."""
    if not is_coordinator_of(db, user_id, org_unit_id):
        raise OrgServiceError("permission_denied", "Apenas coordenadores podem ver convites")
    
    result = db.execute(
        select(OrgInvite)
        .where(
            OrgInvite.org_unit_id == org_unit_id,
            OrgInvite.status == InviteStatus.PENDING,
        )
        .order_by(OrgInvite.created_at.desc())
    )
    return list(result.scalars().all())


def get_org_tree(db: Session, user_id: UUID) -> OrgUnit | None:
    """
    Retorna árvore organizacional visível para o usuário.
    
    - Unidades PUBLIC são visíveis para todos
    - Unidades RESTRICTED só para membros
    """
    # IDs das unidades que o usuário é membro
    user_unit_ids = set()
    memberships = db.execute(
        select(OrgMembership.org_unit_id)
        .where(
            OrgMembership.user_id == user_id,
            OrgMembership.status == MembershipStatus.ACTIVE,
        )
    )
    for row in memberships:
        user_unit_ids.add(row[0])
    
    # Busca raiz (CONSELHO_GERAL)
    root = db.execute(
        select(OrgUnit)
        .where(
            OrgUnit.type == OrgUnitType.CONSELHO_GERAL,
            OrgUnit.is_active == True,
        )
    ).scalar_one_or_none()
    
    return root


def get_org_unit_members(db: Session, org_unit_id: UUID, user_id: UUID) -> list[OrgMembership]:
    """Retorna membros de uma unidade."""
    org_unit = db.get(OrgUnit, org_unit_id)
    if not org_unit:
        raise OrgServiceError("org_unit_not_found", "Unidade não encontrada")
    
    # Verifica visibilidade
    if org_unit.visibility == Visibility.RESTRICTED:
        if not is_member_of(db, user_id, org_unit_id):
            raise OrgServiceError("permission_denied", "Unidade restrita")
    
    result = db.execute(
        select(OrgMembership)
        .where(
            OrgMembership.org_unit_id == org_unit_id,
            OrgMembership.status == MembershipStatus.ACTIVE,
        )
        .order_by(OrgMembership.role, OrgMembership.joined_at)
    )
    return list(result.scalars().all())


def search_users_for_invite(
    db: Session,
    org_unit_id: UUID,
    user_id: UUID,
    query: str,
    limit: int = 20,
) -> list[User]:
    """
    Busca usuários para convidar.
    
    - Só coordenador pode buscar
    - Exclui quem já é membro
    - Exclui quem já tem convite pendente
    """
    from app.db.models import UserProfile
    
    # Verifica se é coordenador
    if not is_coordinator_of(db, user_id, org_unit_id):
        raise OrgServiceError("permission_denied", "Apenas coordenadores podem buscar usuários")
    
    # IDs de membros atuais
    member_ids = db.execute(
        select(OrgMembership.user_id)
        .where(
            OrgMembership.org_unit_id == org_unit_id,
            OrgMembership.status == MembershipStatus.ACTIVE,
        )
    ).scalars().all()
    
    # IDs com convite pendente
    pending_ids = db.execute(
        select(OrgInvite.invited_user_id)
        .where(
            OrgInvite.org_unit_id == org_unit_id,
            OrgInvite.status == InviteStatus.PENDING,
        )
    ).scalars().all()
    
    exclude_ids = set(member_ids) | set(pending_ids)
    
    # Busca usuários
    search_term = f"%{query}%"
    stmt = (
        select(User)
        .join(UserProfile, UserProfile.user_id == User.id, isouter=True)
        .where(
            User.is_active == True,
            UserProfile.full_name.ilike(search_term),
        )
    )
    
    if exclude_ids:
        stmt = stmt.where(User.id.notin_(exclude_ids))
    
    stmt = stmt.limit(limit)
    
    return list(db.execute(stmt).scalars().all())


def update_member_role(
    db: Session,
    org_unit_id: UUID,
    target_user_id: UUID,
    acting_user_id: UUID,
    new_role: OrgRoleCode,
) -> OrgMembership:
    """
    Atualiza papel de um membro.
    
    - Só coordenador pode alterar
    - Não pode rebaixar a si mesmo se for único coordenador
    """
    # Verifica se é coordenador
    if not is_coordinator_of(db, acting_user_id, org_unit_id):
        raise OrgServiceError("permission_denied", "Apenas coordenadores podem alterar papéis")
    
    # Busca membership do target
    membership = db.execute(
        select(OrgMembership)
        .where(
            OrgMembership.org_unit_id == org_unit_id,
            OrgMembership.user_id == target_user_id,
            OrgMembership.status == MembershipStatus.ACTIVE,
        )
    ).scalar_one_or_none()
    
    if not membership:
        raise OrgServiceError("member_not_found", "Membro não encontrado")
    
    # Se está rebaixando a si mesmo, verifica se há outros coordenadores
    if target_user_id == acting_user_id and new_role != OrgRoleCode.COORDINATOR:
        coord_count = db.execute(
            select(func.count(OrgMembership.id))
            .where(
                OrgMembership.org_unit_id == org_unit_id,
                OrgMembership.role == OrgRoleCode.COORDINATOR,
                OrgMembership.status == MembershipStatus.ACTIVE,
            )
        ).scalar()
        
        if coord_count <= 1:
            raise OrgServiceError(
                "last_coordinator",
                "Você é o único coordenador. Promova outro membro antes de se rebaixar."
            )
    
    membership.role = new_role
    db.commit()
    db.refresh(membership)
    return membership


def remove_member(
    db: Session,
    org_unit_id: UUID,
    target_user_id: UUID,
    acting_user_id: UUID,
) -> None:
    """
    Remove um membro da unidade.
    
    - Coordenador pode remover membros
    - Membro pode remover a si mesmo (sair)
    - Não pode remover último coordenador
    """
    # Busca membership do target
    membership = db.execute(
        select(OrgMembership)
        .where(
            OrgMembership.org_unit_id == org_unit_id,
            OrgMembership.user_id == target_user_id,
            OrgMembership.status == MembershipStatus.ACTIVE,
        )
    ).scalar_one_or_none()
    
    if not membership:
        raise OrgServiceError("member_not_found", "Membro não encontrado")
    
    # Verifica permissão
    is_self = target_user_id == acting_user_id
    is_coord = is_coordinator_of(db, acting_user_id, org_unit_id)
    
    if not is_self and not is_coord:
        raise OrgServiceError("permission_denied", "Você não tem permissão para remover este membro")
    
    # Se é coordenador sendo removido, verifica se há outros
    if membership.role == OrgRoleCode.COORDINATOR:
        coord_count = db.execute(
            select(func.count(OrgMembership.id))
            .where(
                OrgMembership.org_unit_id == org_unit_id,
                OrgMembership.role == OrgRoleCode.COORDINATOR,
                OrgMembership.status == MembershipStatus.ACTIVE,
            )
        ).scalar()
        
        if coord_count <= 1:
            raise OrgServiceError(
                "last_coordinator",
                "Não é possível remover o último coordenador. Promova outro membro primeiro."
            )
    
    # Marca como removido (soft delete)
    membership.status = MembershipStatus.REMOVED
    membership.left_at = datetime.now(timezone.utc)
    db.commit()


def get_user_permissions(db: Session, user_id: UUID, org_unit_id: UUID) -> dict:
    """
    Retorna permissões do usuário em uma unidade.
    """
    org_unit = db.get(OrgUnit, org_unit_id)
    if not org_unit:
        return {"can_view": False}
    
    is_coord = is_coordinator_of(db, user_id, org_unit_id)
    is_memb = is_member_of(db, user_id, org_unit_id)
    global_roles = get_user_global_roles(db, user_id)
    is_admin = "ADMIN" in global_roles or "DEV" in global_roles
    
    # Verifica o que pode criar
    can_create = []
    if is_coord or is_admin:
        permissions = HIERARCHY_PERMISSIONS.get(org_unit.type.value, {})
        can_create = permissions.get("can_create", [])
    
    return {
        "can_view": org_unit.visibility == Visibility.PUBLIC or is_memb or is_admin,
        "can_view_members": org_unit.visibility == Visibility.PUBLIC or is_memb or is_admin,
        "can_invite": is_coord or is_admin,
        "can_create_child": len(can_create) > 0,
        "allowed_child_types": can_create,
        "can_edit": is_coord or is_admin,
        "can_manage_members": is_coord or is_admin,
        "is_coordinator": is_coord,
        "is_member": is_memb,
        "is_admin": is_admin,
    }
