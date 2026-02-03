"""
Profile Service
===============
Regras de negócio para gerenciamento de perfis.

SEGURANÇA: CPF e RG são criptografados antes de armazenar.
"""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.settings import settings
from app.crypto.service import crypto_service
from app.db.models import ProfileCatalog, ProfileCatalogItem, UserEmergencyContact, UserProfile
from app.schemas.profile import (
    EmergencyContactRequest,
    EmergencyContactResponse,
    ProfileResponse,
    ProfileUpdateRequest,
)
from app.services.audit_service import create_audit_log


class ProfileServiceError(Exception):
    """Erro base do serviço de perfil."""
    pass


class CPFAlreadyExistsError(ProfileServiceError):
    """CPF já cadastrado para outro usuário."""
    pass


class PhoneAlreadyExistsError(ProfileServiceError):
    """Telefone já cadastrado para outro usuário."""
    pass


class EncryptionNotConfiguredError(ProfileServiceError):
    """Serviço de criptografia não configurado."""
    pass


class ProfileService:
    """Serviço de gerenciamento de perfis."""
    
    def __init__(self, db: Session):
        self.db = db
    
    def get_catalogs(self) -> list[dict]:
        """Retorna todos os catálogos com itens ativos."""
        catalogs = self.db.query(ProfileCatalog).all()
        result = []
        
        for catalog in catalogs:
            items = (
                self.db.query(ProfileCatalogItem)
                .filter(
                    ProfileCatalogItem.catalog_id == catalog.id,
                    ProfileCatalogItem.is_active == True,
                )
                .order_by(ProfileCatalogItem.sort_order)
                .all()
            )
            result.append({
                "code": catalog.code,
                "name": catalog.name,
                "items": [
                    {"id": item.id, "code": item.code, "label": item.label}
                    for item in items
                ],
            })
        
        return result
    
    def get_profile(self, user_id: UUID) -> ProfileResponse:
        """Retorna perfil do usuário (sem CPF/RG)."""
        profile = self.db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
        
        if not profile:
            return ProfileResponse(
                user_id=user_id,
                full_name=None,
                birth_date=None,
                phone_e164=None,
                phone_verified=False,
                city=None,
                state=None,
                life_state_item_id=None,
                marital_status_item_id=None,
                vocational_reality_item_id=None,
                status="INCOMPLETE",
                completed_at=None,
                emergency_contacts=[],
                has_documents=False,
            )
        
        emergency_contacts = [
            EmergencyContactResponse(
                id=ec.id,
                name=ec.contact_name,
                phone_e164=ec.contact_phone,
                relationship=ec.contact_relationship,
            )
            for ec in profile.emergency_contacts
        ]
        
        return ProfileResponse(
            user_id=profile.user_id,
            full_name=profile.full_name,
            birth_date=profile.birth_date,
            phone_e164=profile.phone_e164,
            phone_verified=profile.phone_verified,
            city=profile.city,
            state=profile.state,
            life_state_item_id=profile.life_state_item_id,
            marital_status_item_id=profile.marital_status_item_id,
            vocational_reality_item_id=profile.vocational_reality_item_id,
            status=profile.status,
            completed_at=profile.completed_at,
            emergency_contacts=emergency_contacts,
            has_documents=bool(profile.cpf_encrypted and profile.rg_encrypted),
        )
    
    def update_profile(
        self,
        user_id: UUID,
        data: ProfileUpdateRequest,
        ip: str | None = None,
        user_agent: str | None = None,
    ) -> ProfileResponse:
        """
        Cria ou atualiza perfil do usuário.
        
        CPF e RG são criptografados antes de armazenar.
        """
        if not crypto_service.is_configured:
            raise EncryptionNotConfiguredError("Serviço de criptografia não configurado")
        
        try:
            cpf_hash, cpf_encrypted = crypto_service.encrypt_cpf(data.cpf)
            rg_encrypted = crypto_service.encrypt_rg(data.rg)
        except ValueError as e:
            raise ProfileServiceError(str(e))
        
        profile = self.db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
        
        try:
            if profile:
                self._update_existing_profile(profile, data, cpf_hash, cpf_encrypted, rg_encrypted)
                action = "profile_updated"
            else:
                profile = self._create_new_profile(user_id, data, cpf_hash, cpf_encrypted, rg_encrypted)
                action = "profile_created"
            
            self.db.flush()
            
            if settings.enable_audit:
                create_audit_log(
                    db=self.db,
                    actor_user_id=user_id,
                    action=action,
                    entity_type="user_profile",
                    entity_id=str(user_id),
                    ip=ip,
                    user_agent=user_agent,
                    metadata={"status": profile.status},
                )
            
            self.db.commit()
            self.db.refresh(profile)
            
        except IntegrityError as e:
            self.db.rollback()
            error_str = str(e)
            if "cpf_hash" in error_str:
                raise CPFAlreadyExistsError("CPF já cadastrado")
            if "phone_e164" in error_str:
                raise PhoneAlreadyExistsError("Telefone já cadastrado")
            raise
        
        return self.get_profile(user_id)
    
    def _update_existing_profile(
        self,
        profile: UserProfile,
        data: ProfileUpdateRequest,
        cpf_hash: str,
        cpf_encrypted: bytes,
        rg_encrypted: bytes,
    ) -> None:
        """Atualiza perfil existente."""
        profile.full_name = data.full_name
        profile.birth_date = data.birth_date
        profile.cpf_hash = cpf_hash
        profile.cpf_encrypted = cpf_encrypted
        profile.rg_encrypted = rg_encrypted
        profile.city = data.city
        profile.state = data.state
        profile.life_state_item_id = data.life_state_item_id
        profile.marital_status_item_id = data.marital_status_item_id
        profile.vocational_reality_item_id = data.vocational_reality_item_id
        
        if profile.phone_e164 != data.phone_e164:
            profile.phone_e164 = data.phone_e164
            profile.phone_verified = False
        
        self._update_profile_status(profile)
    
    def _create_new_profile(
        self,
        user_id: UUID,
        data: ProfileUpdateRequest,
        cpf_hash: str,
        cpf_encrypted: bytes,
        rg_encrypted: bytes,
    ) -> UserProfile:
        """Cria novo perfil."""
        profile = UserProfile(
            user_id=user_id,
            full_name=data.full_name,
            birth_date=data.birth_date,
            cpf_hash=cpf_hash,
            cpf_encrypted=cpf_encrypted,
            rg_encrypted=rg_encrypted,
            phone_e164=data.phone_e164,
            phone_verified=False,
            city=data.city,
            state=data.state,
            life_state_item_id=data.life_state_item_id,
            marital_status_item_id=data.marital_status_item_id,
            vocational_reality_item_id=data.vocational_reality_item_id,
            status="PENDING_VERIFICATION",
        )
        self.db.add(profile)
        return profile
    
    def _update_profile_status(self, profile: UserProfile) -> None:
        """Atualiza status do perfil baseado na verificação."""
        if profile.phone_verified:
            profile.status = "COMPLETE"
            if not profile.completed_at:
                profile.completed_at = datetime.now(timezone.utc)
        else:
            profile.status = "PENDING_VERIFICATION"
    
    def add_emergency_contact(
        self,
        user_id: UUID,
        data: EmergencyContactRequest,
    ) -> EmergencyContactResponse:
        """Adiciona ou atualiza contato de emergência."""
        profile = self.db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
        
        if not profile:
            raise ProfileServiceError("Perfil deve ser criado primeiro")
        
        existing = (
            self.db.query(UserEmergencyContact)
            .filter(UserEmergencyContact.user_id == user_id)
            .first()
        )
        
        if existing:
            existing.contact_name = data.name
            existing.contact_phone = data.phone_e164
            existing.contact_relationship = data.relationship
            contact = existing
        else:
            contact = UserEmergencyContact(
                user_id=user_id,
                contact_name=data.name,
                contact_phone=data.phone_e164,
                contact_relationship=data.relationship,
            )
            self.db.add(contact)
        
        self.db.commit()
        self.db.refresh(contact)
        
        return EmergencyContactResponse(
            id=contact.id,
            name=contact.contact_name,
            phone_e164=contact.contact_phone,
            relationship=contact.contact_relationship,
        )
