"""
Role Service
============
Serviço de gerenciamento de roles e permissões.
"""

from uuid import UUID

from sqlalchemy.orm import Session

from app.db.models import GlobalRole, OrgMembership, OrgRole, UserGlobalRole, MembershipStatus


class RoleService:
    """Serviço de roles e permissões."""
    
    def __init__(self, db: Session):
        self.db = db
    
    def get_user_global_roles(self, user_id: UUID) -> list[str]:
        """Retorna lista de códigos de roles globais do usuário."""
        roles = (
            self.db.query(GlobalRole.code)
            .join(UserGlobalRole)
            .filter(UserGlobalRole.user_id == user_id)
            .all()
        )
        return [r[0] for r in roles]
    
    def has_any_global_role(self, user_id: UUID, role_codes: list[str]) -> bool:
        """Verifica se usuário tem alguma das roles especificadas."""
        user_roles = self.get_user_global_roles(user_id)
        return any(role in user_roles for role in role_codes)
    
    def has_global_role(self, user_id: UUID, role_code: str) -> bool:
        """Verifica se usuário tem uma role específica."""
        return self.has_any_global_role(user_id, [role_code])
    
    def is_dev(self, user_id: UUID) -> bool:
        """Verifica se usuário é DEV."""
        return self.has_global_role(user_id, "DEV")
    
    def is_council(self, user_id: UUID) -> bool:
        """Verifica se usuário é COUNCIL_GENERAL."""
        return self.has_global_role(user_id, "COUNCIL_GENERAL")
    
    def is_secretary(self, user_id: UUID) -> bool:
        """Verifica se usuário é SECRETARY."""
        return self.has_global_role(user_id, "SECRETARY")
    
    def is_coordinator_of(self, user_id: UUID, org_unit_id: UUID) -> bool:
        """Verifica se usuário é coordenador de uma unidade organizacional."""
        coordinator_role = self.db.query(OrgRole).filter(OrgRole.code == "COORDINATOR").first()
        
        if not coordinator_role:
            return False
        
        membership = (
            self.db.query(OrgMembership)
            .filter(
                OrgMembership.user_id == user_id,
                OrgMembership.org_unit_id == org_unit_id,
                OrgMembership.org_role_id == coordinator_role.id,
                OrgMembership.status == MembershipStatus.ACTIVE,
            )
            .first()
        )
        
        return membership is not None
    
    def can_approve_membership(self, user_id: UUID, org_unit_id: UUID) -> bool:
        """
        Verifica se usuário pode aprovar memberships de uma unidade.
        
        Podem aprovar:
        - DEV
        - COUNCIL_GENERAL
        - Coordenador da unidade
        """
        if self.has_any_global_role(user_id, ["DEV", "COUNCIL_GENERAL"]):
            return True
        
        return self.is_coordinator_of(user_id, org_unit_id)
    
    def can_request_sensitive_access(self, user_id: UUID) -> bool:
        """Verifica se usuário pode solicitar acesso a dados sensíveis."""
        return self.has_any_global_role(user_id, ["SECRETARY", "DEV"])
    
    def can_approve_sensitive_access(self, user_id: UUID) -> bool:
        """Verifica se usuário pode aprovar acesso a dados sensíveis."""
        return self.has_any_global_role(user_id, ["COUNCIL_GENERAL", "DEV"])
    
    def can_bypass_sensitive_access(self, user_id: UUID) -> bool:
        """Verifica se usuário pode acessar dados sensíveis sem aprovação."""
        return self.is_dev(user_id)
