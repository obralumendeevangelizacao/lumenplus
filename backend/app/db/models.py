"""
Lumen+ Database Models v2
=========================
"""

import enum
from datetime import date, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import (
    Boolean, Date, DateTime, Enum, ForeignKey, Integer, 
    LargeBinary, String, Text, UniqueConstraint, Index, func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID as PGUUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


# === ENUMS ===

class OrgUnitType(enum.Enum):
    CONSELHO_GERAL = "CONSELHO_GERAL"
    CONSELHO_EXECUTIVO = "CONSELHO_EXECUTIVO"
    SETOR = "SETOR"
    MINISTERIO = "MINISTERIO"
    GRUPO = "GRUPO"

class GroupType(enum.Enum):
    ACOLHIDA = "ACOLHIDA"
    APROFUNDAMENTO = "APROFUNDAMENTO"
    VOCACIONAL = "VOCACIONAL"
    CASAIS = "CASAIS"
    CURSO = "CURSO"
    PROJETO = "PROJETO"

class Visibility(enum.Enum):
    PUBLIC = "PUBLIC"
    RESTRICTED = "RESTRICTED"

class MembershipStatus(enum.Enum):
    ACTIVE = "ACTIVE"
    REMOVED = "REMOVED"

class InviteStatus(enum.Enum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"
    EXPIRED = "EXPIRED"
    CANCELLED = "CANCELLED"

class OrgRoleCode(enum.Enum):
    COORDINATOR = "COORDINATOR"
    MEMBER = "MEMBER"


# === USER ===

class User(Base):
    __tablename__ = "users"
    
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    identities: Mapped[list["UserIdentity"]] = relationship("UserIdentity", back_populates="user", cascade="all, delete-orphan")
    profile: Mapped["UserProfile | None"] = relationship("UserProfile", back_populates="user", uselist=False, cascade="all, delete-orphan", foreign_keys="UserProfile.user_id")
    memberships: Mapped[list["OrgMembership"]] = relationship("OrgMembership", back_populates="user", foreign_keys="OrgMembership.user_id", cascade="all, delete-orphan")
    global_roles: Mapped[list["UserGlobalRole"]] = relationship("UserGlobalRole", back_populates="user", foreign_keys="UserGlobalRole.user_id", cascade="all, delete-orphan")
    sent_invites: Mapped[list["OrgInvite"]] = relationship("OrgInvite", back_populates="invited_by_user", foreign_keys="OrgInvite.invited_by_user_id")
    received_invites: Mapped[list["OrgInvite"]] = relationship("OrgInvite", back_populates="invited_user", foreign_keys="OrgInvite.invited_user_id")


class UserIdentity(Base):
    __tablename__ = "user_identities"
    
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    provider: Mapped[str] = mapped_column(Text, nullable=False)
    provider_uid: Mapped[str] = mapped_column(Text, nullable=False)
    email: Mapped[str | None] = mapped_column(Text, nullable=True)
    email_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    
    __table_args__ = (UniqueConstraint("provider", "provider_uid", name="uq_identity_provider_uid"),)
    user: Mapped["User"] = relationship("User", back_populates="identities")


# === PROFILE COMPLETO ===

class UserProfile(Base):
    """
    Perfil do usuário com todos os campos:
    - Dados básicos + foto
    - Estado de vida, Estado civil, Realidade vocacional (via catálogos)
    - Ano de consagração (se Consagrado Filho da Luz)
    - Acompanhamento vocacional (se sim → quem)
    - Interesse em ministério (se sim → qual)
    """
    __tablename__ = "user_profiles"
    
    user_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    
    # DADOS BÁSICOS
    full_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    birth_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    photo_url: Mapped[str | None] = mapped_column(Text, nullable=True)  # URL da foto
    
    # DOCUMENTOS (criptografados)
    cpf_hash: Mapped[str | None] = mapped_column(Text, nullable=True, unique=True)
    cpf_encrypted: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    rg_encrypted: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    
    # CONTATO
    phone_e164: Mapped[str | None] = mapped_column(Text, nullable=True, unique=True)
    phone_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    
    # LOCALIZAÇÃO
    city: Mapped[str | None] = mapped_column(Text, nullable=True)
    state: Mapped[str | None] = mapped_column(String(2), nullable=True)
    
    # CATÁLOGOS (via FK para profile_catalog_items)
    # Estado de Vida: Leigo, Leigo Consagrado, Noviça, Seminarista, Religioso,
    #                 Diácono Permanente, Diácono, Sacerdote Religioso, Sacerdote Diocesano, Bispo
    life_state_item_id: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), nullable=True)
    
    # Estado Civil: Solteiro, Noivo, Casado, Divorciado, Viúvo, União Estável
    marital_status_item_id: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), nullable=True)
    
    # Realidade Vocacional: Membro do Acolhida, Membro do Aprofundamento, Vocacional,
    #                       Postulante de Primeiro Ano, Postulante de Segundo Ano,
    #                       Discípulo Vocacional, Consagrado Filho da Luz
    vocational_reality_item_id: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), nullable=True)
    
    # ANO DE CONSAGRAÇÃO (obrigatório se Realidade Vocacional = CONSAGRADO_FILHO_DA_LUZ)
    consecration_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    
    # ACOMPANHAMENTO VOCACIONAL
    has_vocational_accompaniment: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    # Se sim, quem é o acompanhador?
    vocational_accompanist_user_id: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    vocational_accompanist_name: Mapped[str | None] = mapped_column(Text, nullable=True)  # Se não for usuário do sistema
    
    # INTERESSE EM MINISTÉRIO
    interested_in_ministry: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    # Se sim, qual?
    interested_ministry_id: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), ForeignKey("org_units.id", ondelete="SET NULL"), nullable=True)
    ministry_interest_notes: Mapped[str | None] = mapped_column(Text, nullable=True)  # Observações
    
    # STATUS
    status: Mapped[str] = mapped_column(Text, nullable=False, server_default="INCOMPLETE")
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="profile", foreign_keys=[user_id])
    emergency_contacts: Mapped[list["UserEmergencyContact"]] = relationship("UserEmergencyContact", back_populates="profile", cascade="all, delete-orphan")
    vocational_accompanist: Mapped["User | None"] = relationship("User", foreign_keys=[vocational_accompanist_user_id])
    interested_ministry: Mapped["OrgUnit | None"] = relationship("OrgUnit", foreign_keys=[interested_ministry_id])


class UserEmergencyContact(Base):
    __tablename__ = "user_emergency_contacts"
    
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("user_profiles.user_id", ondelete="CASCADE"), nullable=False)
    contact_name: Mapped[str] = mapped_column(Text, nullable=False)
    contact_phone: Mapped[str] = mapped_column(Text, nullable=False)
    contact_relationship: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    
    profile: Mapped["UserProfile"] = relationship("UserProfile", back_populates="emergency_contacts")


# === PROFILE CATALOGS ===

class ProfileCatalog(Base):
    """Catálogo de opções para o perfil (Estado de Vida, Estado Civil, etc.)"""
    __tablename__ = "profile_catalogs"
    
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    code: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    
    items: Mapped[list["ProfileCatalogItem"]] = relationship("ProfileCatalogItem", back_populates="catalog", cascade="all, delete-orphan")


class ProfileCatalogItem(Base):
    """Item de um catálogo de perfil"""
    __tablename__ = "profile_catalog_items"
    
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    catalog_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("profile_catalogs.id", ondelete="CASCADE"), nullable=False)
    code: Mapped[str] = mapped_column(Text, nullable=False)
    label: Mapped[str] = mapped_column(Text, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    
    __table_args__ = (UniqueConstraint("catalog_id", "code", name="uq_catalog_item_code"),)
    catalog: Mapped["ProfileCatalog"] = relationship("ProfileCatalog", back_populates="items")


# === GLOBAL ROLES ===

class GlobalRole(Base):
    __tablename__ = "global_roles"
    
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    code: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)


class UserGlobalRole(Base):
    __tablename__ = "user_global_roles"
    
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    global_role_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("global_roles.id", ondelete="CASCADE"), nullable=False)
    granted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    
    __table_args__ = (UniqueConstraint("user_id", "global_role_id", name="uq_user_global_role"),)
    user: Mapped["User"] = relationship("User", back_populates="global_roles", foreign_keys=[user_id])
    global_role: Mapped["GlobalRole"] = relationship("GlobalRole")


# === ORGANIZATION ===

class OrgUnit(Base):
    __tablename__ = "org_units"
    
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    type: Mapped[OrgUnitType] = mapped_column(Enum(OrgUnitType, name="org_unit_type", create_constraint=False), nullable=False)
    group_type: Mapped[GroupType | None] = mapped_column(Enum(GroupType, name="group_type", create_constraint=False), nullable=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    slug: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    parent_id: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), ForeignKey("org_units.id", ondelete="CASCADE"), nullable=True)
    visibility: Mapped[Visibility] = mapped_column(Enum(Visibility, name="visibility", create_constraint=False), nullable=False, default=Visibility.PUBLIC, server_default="PUBLIC")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    created_by_user_id: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    
    parent: Mapped["OrgUnit | None"] = relationship("OrgUnit", remote_side=[id], back_populates="children")
    children: Mapped[list["OrgUnit"]] = relationship("OrgUnit", back_populates="parent", cascade="all, delete-orphan")
    memberships: Mapped[list["OrgMembership"]] = relationship("OrgMembership", back_populates="org_unit", cascade="all, delete-orphan")
    invites: Mapped[list["OrgInvite"]] = relationship("OrgInvite", back_populates="org_unit", cascade="all, delete-orphan")


class OrgMembership(Base):
    __tablename__ = "org_memberships"
    
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    org_unit_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("org_units.id", ondelete="CASCADE"), nullable=False)
    role: Mapped[OrgRoleCode] = mapped_column(Enum(OrgRoleCode, name="org_role_code", create_constraint=False), nullable=False, default=OrgRoleCode.MEMBER, server_default="MEMBER")
    status: Mapped[MembershipStatus] = mapped_column(Enum(MembershipStatus, name="membership_status", create_constraint=False), nullable=False, default=MembershipStatus.ACTIVE, server_default="ACTIVE")
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    invite_id: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), ForeignKey("org_invites.id", ondelete="SET NULL"), nullable=True)
    
    __table_args__ = (UniqueConstraint("user_id", "org_unit_id", name="uq_membership_user_org"),)
    user: Mapped["User"] = relationship("User", back_populates="memberships", foreign_keys=[user_id])
    org_unit: Mapped["OrgUnit"] = relationship("OrgUnit", back_populates="memberships")


class OrgInvite(Base):
    __tablename__ = "org_invites"
    
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    org_unit_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("org_units.id", ondelete="CASCADE"), nullable=False)
    invited_user_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    invited_by_user_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role: Mapped[OrgRoleCode] = mapped_column(Enum(OrgRoleCode, name="org_role_code", create_constraint=False), nullable=False, default=OrgRoleCode.MEMBER, server_default="MEMBER")
    status: Mapped[InviteStatus] = mapped_column(Enum(InviteStatus, name="invite_status", create_constraint=False), nullable=False, default=InviteStatus.PENDING, server_default="PENDING")
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    responded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    
    org_unit: Mapped["OrgUnit"] = relationship("OrgUnit", back_populates="invites")
    invited_user: Mapped["User"] = relationship("User", back_populates="received_invites", foreign_keys=[invited_user_id])
    invited_by_user: Mapped["User"] = relationship("User", back_populates="sent_invites", foreign_keys=[invited_by_user_id])


# === VERIFICATION ===

class PhoneVerification(Base):
    __tablename__ = "phone_verifications"
    
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    phone_e164: Mapped[str] = mapped_column(Text, nullable=False)
    channel: Mapped[str] = mapped_column(Text, nullable=False)
    code_hash: Mapped[str] = mapped_column(Text, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class EmailVerification(Base):
    __tablename__ = "email_verifications"
    
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    email: Mapped[str] = mapped_column(Text, nullable=False)
    token_hash: Mapped[str] = mapped_column(Text, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# === LEGAL ===

class LegalDocument(Base):
    __tablename__ = "legal_documents"
    
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    type: Mapped[str] = mapped_column(Text, nullable=False)
    version: Mapped[str] = mapped_column(Text, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    
    __table_args__ = (UniqueConstraint("type", "version", name="uq_legal_doc_type_version"),)


class UserConsent(Base):
    __tablename__ = "user_consents"
    
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    document_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("legal_documents.id", ondelete="CASCADE"), nullable=False)
    accepted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class UserPreferences(Base):
    __tablename__ = "user_preferences"
    
    user_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    analytics_opt_in: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    push_opt_in: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")


# === AUDIT ===

class AuditLog(Base):
    __tablename__ = "audit_log"
    
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    actor_user_id: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), nullable=True)
    action: Mapped[str] = mapped_column(Text, nullable=False)
    entity_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    entity_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    extra_data: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# === INBOX (AVISOS) ===

class InboxMessageType(enum.Enum):
    INFO = "info"
    WARNING = "warning"
    SUCCESS = "success"
    URGENT = "urgent"


class InboxMessage(Base):
    """
    Mensagem/Aviso enviado para usuários.
    Criada por usuários com permissão CAN_SEND_INBOX.
    """
    __tablename__ = "inbox_messages"
    
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    title: Mapped[str] = mapped_column(Text, nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    type: Mapped[InboxMessageType] = mapped_column(
        Enum(InboxMessageType, name="inbox_message_type", create_constraint=False), 
        nullable=False, 
        default=InboxMessageType.INFO,
        server_default="info"
    )
    
    # Anexos (URLs de imagens ou links)
    attachments: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    
    # Filtros usados para segmentação (guardamos para histórico)
    filters: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    
    # Quem enviou
    created_by_user_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    
    # Relationships
    created_by: Mapped["User"] = relationship("User", foreign_keys=[created_by_user_id])
    recipients: Mapped[list["InboxRecipient"]] = relationship("InboxRecipient", back_populates="message", cascade="all, delete-orphan")


class InboxRecipient(Base):
    """
    Relação entre mensagem e destinatário.
    Cada usuário tem seu próprio registro para controlar leitura.
    """
    __tablename__ = "inbox_recipients"
    
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    message_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("inbox_messages.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    read: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    
    __table_args__ = (
        UniqueConstraint("message_id", "user_id", name="uq_inbox_recipient"),
        Index("ix_inbox_recipient_user_read", "user_id", "read"),
    )
    
    # Relationships
    message: Mapped["InboxMessage"] = relationship("InboxMessage", back_populates="recipients")
    user: Mapped["User"] = relationship("User")


# === PERMISSÕES ===

class UserPermission(Base):
    """
    Permissões específicas para usuários.
    Exemplo: CAN_SEND_INBOX permite enviar avisos.
    """
    __tablename__ = "user_permissions"
    
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    permission_code: Mapped[str] = mapped_column(Text, nullable=False)
    
    granted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    granted_by_user_id: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    __table_args__ = (
        UniqueConstraint("user_id", "permission_code", name="uq_user_permission"),
        Index("ix_user_permission_code", "permission_code"),
    )
    
    # Relationships
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])
    granted_by: Mapped["User | None"] = relationship("User", foreign_keys=[granted_by_user_id])