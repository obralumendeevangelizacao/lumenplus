"""
Rotas de Desenvolvimento
========================
Endpoints para testes e seed de dados.
DESABILITAR EM PRODUÇÃO!
"""

from uuid import UUID
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.models import (
    User, UserProfile, UserIdentity, GlobalRole, UserGlobalRole,
    OrgUnit, OrgUnitType, Visibility, OrgMembership, OrgRoleCode, MembershipStatus,
    LegalDocument,
)
from app.api.routes.auth import get_current_user

router = APIRouter(prefix="/dev", tags=["dev"])


@router.post("/seed")
async def seed_database(db: Session = Depends(get_db)):
    """Popula banco com dados iniciais."""
    results = {
        "global_roles": 0,
        "legal_docs": 0,
        "org_units": 0,
        "users": 0,
    }
    
    # Global Roles
    roles = [
        ("DEV", "Desenvolvedor"),
        ("ADMIN", "Administrador"),
        ("SECRETARY", "Secretário Geral"),
    ]
    for code, name in roles:
        existing = db.execute(select(GlobalRole).where(GlobalRole.code == code)).scalar_one_or_none()
        if not existing:
            db.add(GlobalRole(code=code, name=name))
            results["global_roles"] += 1
    
    # Legal Documents
    docs = [
        ("TERMS", "1.0", "Termos de Uso do Lumen+\n\nAo utilizar o aplicativo..."),
        ("PRIVACY", "1.0", "Política de Privacidade do Lumen+\n\nSeus dados são..."),
    ]
    for doc_type, version, content in docs:
        existing = db.execute(
            select(LegalDocument).where(LegalDocument.type == doc_type, LegalDocument.version == version)
        ).scalar_one_or_none()
        if not existing:
            db.add(LegalDocument(type=doc_type, version=version, content=content))
            results["legal_docs"] += 1
    
    db.commit()
    
    return {"message": "Seed concluído", "results": results}


@router.post("/create-conselho-geral")
async def create_conselho_geral(
    name: str = "Conselho Geral Lumen Christi",
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Cria o Conselho Geral (raiz da hierarquia). Requer role DEV."""
    # Verifica se é DEV
    is_dev = any(ugr.global_role.code == "DEV" for ugr in user.global_roles)
    if not is_dev:
        raise HTTPException(status_code=403, detail={"error": "forbidden", "message": "Apenas DEV pode criar Conselho Geral"})
    
    # Verifica se já existe
    existing = db.execute(
        select(OrgUnit).where(OrgUnit.type == OrgUnitType.CONSELHO_GERAL)
    ).scalar_one_or_none()
    
    if existing:
        raise HTTPException(status_code=400, detail={"error": "already_exists", "message": "Conselho Geral já existe"})
    
    # Cria
    slug = name.lower().replace(" ", "-")
    conselho = OrgUnit(
        type=OrgUnitType.CONSELHO_GERAL,
        name=name,
        slug=slug,
        visibility=Visibility.PUBLIC,
        created_by_user_id=user.id,
    )
    db.add(conselho)
    db.flush()
    
    # Adiciona criador como coordenador
    membership = OrgMembership(
        user_id=user.id,
        org_unit_id=conselho.id,
        role=OrgRoleCode.COORDINATOR,
        status=MembershipStatus.ACTIVE,
    )
    db.add(membership)
    
    db.commit()
    db.refresh(conselho)
    
    return {
        "message": "Conselho Geral criado",
        "org_unit": {
            "id": str(conselho.id),
            "name": conselho.name,
            "slug": conselho.slug,
        }
    }


@router.post("/assign-global-role")
async def assign_global_role(
    target_user_id: UUID,
    role_code: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Atribui role global a um usuário. Requer role DEV."""
    # Verifica se é DEV
    is_dev = any(ugr.global_role.code == "DEV" for ugr in user.global_roles)
    if not is_dev:
        raise HTTPException(status_code=403, detail={"error": "forbidden", "message": "Apenas DEV pode atribuir roles"})
    
    # Busca role
    role = db.execute(select(GlobalRole).where(GlobalRole.code == role_code)).scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": f"Role {role_code} não encontrada"})
    
    # Busca usuário
    target = db.get(User, target_user_id)
    if not target:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Usuário não encontrado"})
    
    # Verifica se já tem
    existing = db.execute(
        select(UserGlobalRole).where(
            UserGlobalRole.user_id == target_user_id,
            UserGlobalRole.global_role_id == role.id,
        )
    ).scalar_one_or_none()
    
    if existing:
        return {"message": "Usuário já possui esta role"}
    
    # Atribui
    ugr = UserGlobalRole(user_id=target_user_id, global_role_id=role.id)
    db.add(ugr)
    db.commit()
    
    return {"message": f"Role {role_code} atribuída ao usuário"}


@router.post("/make-me-dev")
async def make_me_dev(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Torna o usuário atual DEV (APENAS para primeiro setup)."""
    # Busca role DEV
    role = db.execute(select(GlobalRole).where(GlobalRole.code == "DEV")).scalar_one_or_none()
    if not role:
        # Cria se não existir
        role = GlobalRole(code="DEV", name="Desenvolvedor")
        db.add(role)
        db.flush()
    
    # Verifica se já tem
    existing = db.execute(
        select(UserGlobalRole).where(
            UserGlobalRole.user_id == user.id,
            UserGlobalRole.global_role_id == role.id,
        )
    ).scalar_one_or_none()
    
    if existing:
        return {"message": "Você já é DEV"}
    
    # Atribui
    ugr = UserGlobalRole(user_id=user.id, global_role_id=role.id)
    db.add(ugr)
    db.commit()
    
    return {"message": "Você agora é DEV!", "user_id": str(user.id)}


@router.post("/grant-inbox-permission")
async def grant_inbox_permission(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Dá permissão para enviar avisos ao usuário atual."""
    from app.db.models import UserPermission
    from app.services.inbox_service import PERMISSION_SEND_INBOX
    
    # Verifica se já tem
    existing = db.execute(
        select(UserPermission).where(
            UserPermission.user_id == user.id,
            UserPermission.permission_code == PERMISSION_SEND_INBOX,
        )
    ).scalar_one_or_none()
    
    if existing:
        return {"message": "Você já tem permissão para enviar avisos"}
    
    # Cria permissão
    permission = UserPermission(
        user_id=user.id,
        permission_code=PERMISSION_SEND_INBOX,
    )
    db.add(permission)
    db.commit()
    
    return {
        "message": "Permissão concedida! Agora você pode enviar avisos.",
        "permission": PERMISSION_SEND_INBOX,
        "user_id": str(user.id),
    }


@router.delete("/revoke-inbox-permission")
async def revoke_inbox_permission(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Remove permissão de enviar avisos do usuário atual."""
    from app.db.models import UserPermission
    from app.services.inbox_service import PERMISSION_SEND_INBOX
    
    existing = db.execute(
        select(UserPermission).where(
            UserPermission.user_id == user.id,
            UserPermission.permission_code == PERMISSION_SEND_INBOX,
        )
    ).scalar_one_or_none()
    
    if not existing:
        return {"message": "Você não tem essa permissão"}
    
    db.delete(existing)
    db.commit()
    
    return {"message": "Permissão removida"}
