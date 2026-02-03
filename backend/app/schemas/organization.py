"""
Schemas de Organização
======================
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from uuid import UUID
from datetime import datetime


# =============================================================================
# CONSTANTES DE HIERARQUIA
# =============================================================================

# Tipos de grupo permitidos
GROUP_TYPES = [
    "ACOLHIDA",
    "APROFUNDAMENTO", 
    "VOCACIONAL",
    "CASAIS",
    "CURSO",
    "PROJETO",
]

# Permissões de hierarquia: quem pode criar o quê
HIERARCHY_PERMISSIONS = {
    "CONSELHO_GERAL": {
        "can_create": ["CONSELHO_EXECUTIVO"],
        "description": "Pode criar Conselho Executivo",
    },
    "CONSELHO_EXECUTIVO": {
        "can_create": ["SETOR"],
        "description": "Pode criar Setores",
    },
    "SETOR": {
        "can_create": ["MINISTERIO", "GRUPO"],
        "description": "Pode criar Ministérios e Grupos",
    },
    "MINISTERIO": {
        "can_create": ["GRUPO"],
        "description": "Pode criar Grupos",
    },
    "GRUPO": {
        "can_create": [],
        "description": "Não pode criar filhos",
    },
}


# =============================================================================
# ORG UNIT
# =============================================================================

class CreateOrgUnitRequest(BaseModel):
    """Request para criar unidade organizacional."""
    name: str = Field(..., min_length=2, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    visibility: Optional[str] = "PUBLIC"  # PUBLIC | RESTRICTED
    group_type: Optional[str] = None  # ACOLHIDA, APROFUNDAMENTO, VOCACIONAL, CASAIS, CURSO, PROJETO
    coordinator_user_ids: List[UUID] = []


class OrgUnitOut(BaseModel):
    """Unidade organizacional."""
    id: UUID
    type: str  # CONSELHO_GERAL, CONSELHO_EXECUTIVO, SETOR, MINISTERIO, GRUPO
    group_type: Optional[str] = None
    name: str
    slug: str
    description: Optional[str] = None
    visibility: str
    is_active: bool
    parent_id: Optional[UUID] = None
    created_at: datetime

    class Config:
        from_attributes = True


class OrgUnitWithChildren(OrgUnitOut):
    """Unidade com filhos (para árvore)."""
    children: List["OrgUnitWithChildren"] = []
    member_count: int = 0


# Necessário para referência circular
OrgUnitWithChildren.model_rebuild()


class OrgTreeResponse(BaseModel):
    """Resposta da árvore organizacional."""
    root: Optional[OrgUnitWithChildren] = None


# =============================================================================
# INVITES
# =============================================================================

class SendInviteRequest(BaseModel):
    """Request para enviar convite."""
    user_id: UUID
    role: Optional[str] = "MEMBER"  # COORDINATOR | MEMBER
    message: Optional[str] = Field(None, max_length=500)


class InviteResponse(BaseModel):
    """Resposta de ação de convite."""
    message: str
    invite_id: UUID
    status: str


class InviteDetailOut(BaseModel):
    """Detalhes do convite."""
    id: UUID
    org_unit_id: UUID
    org_unit_name: str
    org_unit_type: str
    invited_user_id: UUID
    invited_user_name: str
    invited_user_email: Optional[str] = None
    invited_by_user_id: UUID
    invited_by_name: str
    role: str
    status: str
    message: Optional[str] = None
    created_at: datetime
    expires_at: Optional[datetime] = None
    responded_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PendingInvitesResponse(BaseModel):
    """Lista de convites pendentes."""
    org_unit_id: UUID
    invites: List[InviteDetailOut] = []


# =============================================================================
# MEMBERS
# =============================================================================

class MemberOut(BaseModel):
    """Membro de uma unidade."""
    user_id: UUID
    user_name: str
    user_email: Optional[str] = None
    role: str
    status: str
    joined_at: datetime

    class Config:
        from_attributes = True


class MembersListResponse(BaseModel):
    """Lista de membros."""
    org_unit_id: UUID
    org_unit_name: str
    members: List[MemberOut] = []
    total: int = 0
