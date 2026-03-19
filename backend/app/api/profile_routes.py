"""
Rotas de Perfil
===============
CRUD de perfil, catálogos e contatos de emergência.

Schemas vivem em app.schemas.profile — este módulo apenas orquestra.
"""

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request
from sqlalchemy.exc import IntegrityError

from app.api.deps import CurrentUser, DBSession
from app.audit.service import create_audit_log
from app.crypto.service import crypto_service
from app.db.models import (
    OrgUnit,
    ProfileCatalog,
    ProfileCatalogItem,
    User,
    UserEmergencyContact,
    UserProfile,
)
from app.schemas.profile import (
    CatalogItemOut,
    CatalogOut,
    EmergencyContactOut,
    EmergencyContactRequest,
    ProfileUpdateRequest,
    ProfileWithLabelsOut,
)

router = APIRouter(prefix="/profile", tags=["Profile"])


# =============================================================================
# CATALOGOS
# =============================================================================

@router.get("/catalogs", response_model=list[CatalogOut])
async def get_catalogs(db: DBSession) -> list[CatalogOut]:
    """Retorna catálogos de perfil com itens ativos, ordenados."""
    catalogs = db.query(ProfileCatalog).all()
    result = []
    for catalog in catalogs:
        items = (
            db.query(ProfileCatalogItem)
            .filter(
                ProfileCatalogItem.catalog_id == catalog.id,
                ProfileCatalogItem.is_active == True,
            )
            .order_by(ProfileCatalogItem.sort_order)
            .all()
        )
        result.append(CatalogOut(
            code=catalog.code,
            name=catalog.name,
            items=[
                CatalogItemOut(
                    id=item.id,
                    code=item.code,
                    label=item.label,
                    sort_order=item.sort_order,
                )
                for item in items
            ],
        ))
    return result


# =============================================================================
# PERFIL
# =============================================================================

@router.get("", response_model=ProfileWithLabelsOut)
async def get_profile(current_user: CurrentUser, db: DBSession) -> ProfileWithLabelsOut:
    """Retorna perfil do usuário autenticado com labels dos catálogos."""
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()

    if not profile:
        return ProfileWithLabelsOut(user_id=current_user.id, status="INCOMPLETE")

    return _build_profile_response(profile, db)


@router.put("", response_model=ProfileWithLabelsOut)
async def update_profile(
    request: Request,
    body: ProfileUpdateRequest,
    current_user: CurrentUser,
    db: DBSession,
) -> ProfileWithLabelsOut:
    """Cria ou atualiza perfil (idempotente). CPF/RG são opcionais e criptografados quando informados."""
    cpf_hash, cpf_encrypted, rg_encrypted = None, None, None

    if body.cpf or body.rg:
        if not crypto_service.is_configured:
            raise HTTPException(
                status_code=503,
                detail={"error": "service_unavailable", "message": "Serviço de criptografia não configurado. CPF/RG não podem ser salvos."},
            )
        try:
            if body.cpf:
                cpf_hash, cpf_encrypted = crypto_service.encrypt_cpf(body.cpf)
            if body.rg:
                rg_encrypted = crypto_service.encrypt_rg(body.rg)
        except ValueError as e:
            raise HTTPException(
                status_code=400,
                detail={"error": "validation_error", "message": str(e)},
            )

    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()

    try:
        if profile:
            _apply_profile_fields(profile, body, cpf_hash, cpf_encrypted, rg_encrypted)
            action = "profile_updated"
        else:
            profile = _create_profile(current_user.id, body, cpf_hash, cpf_encrypted, rg_encrypted)
            db.add(profile)
            action = "profile_created"

        db.flush()

        create_audit_log(
            db=db,
            actor_user_id=current_user.id,
            action=action,
            entity_type="user_profile",
            entity_id=str(current_user.id),
            ip=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
            metadata={"status": profile.status},
        )

        db.commit()
        db.refresh(profile)

    except IntegrityError as e:
        db.rollback()
        error_str = str(e).lower()
        if "cpf_hash" in error_str:
            raise HTTPException(
                status_code=409,
                detail={"error": "conflict", "message": "CPF já cadastrado"},
            )
        if "phone_e164" in error_str:
            raise HTTPException(
                status_code=409,
                detail={"error": "conflict", "message": "Telefone já cadastrado"},
            )
        raise

    return _build_profile_response(profile, db)


# =============================================================================
# CONTATOS DE EMERGENCIA
# =============================================================================

@router.post("/emergency-contact", response_model=EmergencyContactOut, status_code=201)
async def create_emergency_contact(
    body: EmergencyContactRequest,
    current_user: CurrentUser,
    db: DBSession,
) -> EmergencyContactOut:
    """Adiciona ou atualiza contato de emergência (um por usuário)."""
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(
            status_code=400,
            detail={"error": "bad_request", "message": "Complete seu perfil antes de adicionar contatos de emergência"},
        )

    existing = (
        db.query(UserEmergencyContact)
        .filter(UserEmergencyContact.user_id == current_user.id)
        .first()
    )

    if existing:
        existing.contact_name = body.name
        existing.contact_phone = body.phone_e164
        existing.contact_relationship = body.relationship
        contact = existing
    else:
        contact = UserEmergencyContact(
            user_id=current_user.id,
            contact_name=body.name,
            contact_phone=body.phone_e164,
            contact_relationship=body.relationship,
        )
        db.add(contact)

    db.commit()
    db.refresh(contact)

    return EmergencyContactOut(
        id=contact.id,
        name=contact.contact_name,
        phone_e164=contact.contact_phone,
        relationship=contact.contact_relationship,
    )


@router.get("/emergency-contacts", response_model=list[EmergencyContactOut])
async def list_emergency_contacts(
    current_user: CurrentUser,
    db: DBSession,
) -> list[EmergencyContactOut]:
    """Lista contatos de emergência do usuário."""
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    if not profile:
        return []

    return [
        EmergencyContactOut(
            id=c.id,
            name=c.contact_name,
            phone_e164=c.contact_phone,
            relationship=c.contact_relationship,
        )
        for c in profile.emergency_contacts
    ]


# =============================================================================
# HELPERS INTERNOS
# =============================================================================

def _apply_profile_fields(
    profile: UserProfile,
    body: ProfileUpdateRequest,
    cpf_hash: str | None,
    cpf_encrypted: bytes | None,
    rg_encrypted: bytes | None,
) -> None:
    """Aplica campos do request no profile existente."""
    profile.full_name = body.full_name
    profile.birth_date = body.birth_date
    # Só sobrescreve CPF/RG se um novo valor foi enviado;
    # caso contrário, mantém os dados criptografados existentes.
    if body.cpf:
        profile.cpf_hash = cpf_hash
        profile.cpf_encrypted = cpf_encrypted
    if body.rg:
        profile.rg_encrypted = rg_encrypted
    profile.city = body.city
    profile.state = body.state
    profile.life_state_item_id = body.life_state_item_id
    profile.marital_status_item_id = body.marital_status_item_id
    profile.vocational_reality_item_id = body.vocational_reality_item_id
    profile.consecration_year = body.consecration_year

    # Campos condicionais: limpa dependentes quando a flag é False/None
    profile.has_vocational_accompaniment = body.has_vocational_accompaniment
    if body.has_vocational_accompaniment:
        profile.vocational_accompanist_user_id = body.vocational_accompanist_user_id
        profile.vocational_accompanist_name = body.vocational_accompanist_name
    else:
        profile.vocational_accompanist_user_id = None
        profile.vocational_accompanist_name = None

    profile.interested_in_ministry = body.interested_in_ministry
    if body.interested_in_ministry:
        profile.interested_ministry_id = body.interested_ministry_id
        profile.ministry_interest_notes = body.ministry_interest_notes
    else:
        profile.interested_ministry_id = None
        profile.ministry_interest_notes = None

    # Informações adicionais
    profile.instagram = body.instagram
    profile.dietary_restriction = body.dietary_restriction
    profile.dietary_restriction_notes = body.dietary_restriction_notes if body.dietary_restriction else None
    profile.health_insurance = body.health_insurance
    profile.health_insurance_name = body.health_insurance_name if body.health_insurance else None
    profile.accommodation_preference = body.accommodation_preference
    profile.is_from_mission = body.is_from_mission
    profile.mission_name = body.mission_name if body.is_from_mission else None
    profile.despertar_encounter = body.despertar_encounter

    if body.photo_url:
        profile.photo_url = body.photo_url

    # Atualiza telefone (verificação não é mais exigida)
    if profile.phone_e164 != body.phone_e164:
        profile.phone_e164 = body.phone_e164

    # Determina status: COMPLETE se os campos obrigatórios estão preenchidos
    required = [profile.full_name, profile.birth_date, profile.phone_e164, profile.city, profile.state]
    if all(required):
        profile.status = "COMPLETE"
        if not profile.completed_at:
            profile.completed_at = datetime.now(timezone.utc)
    else:
        profile.status = "INCOMPLETE"


def _create_profile(
    user_id: UUID,
    body: ProfileUpdateRequest,
    cpf_hash: str | None,
    cpf_encrypted: bytes | None,
    rg_encrypted: bytes | None,
) -> UserProfile:
    """Instancia novo UserProfile a partir do request."""
    return UserProfile(
        user_id=user_id,
        full_name=body.full_name,
        birth_date=body.birth_date,
        cpf_hash=cpf_hash,
        cpf_encrypted=cpf_encrypted,
        rg_encrypted=rg_encrypted,
        phone_e164=body.phone_e164,
        phone_verified=False,
        city=body.city,
        state=body.state,
        life_state_item_id=body.life_state_item_id,
        marital_status_item_id=body.marital_status_item_id,
        vocational_reality_item_id=body.vocational_reality_item_id,
        consecration_year=body.consecration_year,
        has_vocational_accompaniment=body.has_vocational_accompaniment,
        vocational_accompanist_user_id=(
            body.vocational_accompanist_user_id if body.has_vocational_accompaniment else None
        ),
        vocational_accompanist_name=(
            body.vocational_accompanist_name if body.has_vocational_accompaniment else None
        ),
        interested_in_ministry=body.interested_in_ministry,
        interested_ministry_id=(
            body.interested_ministry_id if body.interested_in_ministry else None
        ),
        ministry_interest_notes=(
            body.ministry_interest_notes if body.interested_in_ministry else None
        ),
        photo_url=body.photo_url,
        instagram=body.instagram,
        dietary_restriction=body.dietary_restriction,
        dietary_restriction_notes=body.dietary_restriction_notes if body.dietary_restriction else None,
        health_insurance=body.health_insurance,
        health_insurance_name=body.health_insurance_name if body.health_insurance else None,
        accommodation_preference=body.accommodation_preference,
        is_from_mission=body.is_from_mission,
        mission_name=body.mission_name if body.is_from_mission else None,
        despertar_encounter=body.despertar_encounter,
        status="COMPLETE" if all([body.full_name, body.birth_date, body.phone_e164, body.city, body.state]) else "INCOMPLETE",
        completed_at=datetime.now(timezone.utc) if all([body.full_name, body.birth_date, body.phone_e164, body.city, body.state]) else None,
    )


def _build_profile_response(profile: UserProfile, db: DBSession) -> ProfileWithLabelsOut:
    """Monta ProfileWithLabelsOut resolvendo labels de catálogo e nomes relacionados."""
    life_state_label = _get_catalog_label(db, profile.life_state_item_id)
    marital_status_label = _get_catalog_label(db, profile.marital_status_item_id)
    vocational_reality_label = _get_catalog_label(db, profile.vocational_reality_item_id)

    # Resolve nome do acompanhador vocacional
    accompanist_display_name = profile.vocational_accompanist_name
    if profile.vocational_accompanist_user_id:
        accompanist = db.get(User, profile.vocational_accompanist_user_id)
        if accompanist and accompanist.profile:
            accompanist_display_name = accompanist.profile.full_name

    # Resolve nome do ministério de interesse
    ministry_name = None
    if profile.interested_ministry_id:
        ministry = db.get(OrgUnit, profile.interested_ministry_id)
        if ministry:
            ministry_name = ministry.name

    # Contatos de emergência
    emergency_contacts = [
        EmergencyContactOut(
            id=c.id,
            name=c.contact_name,
            phone_e164=c.contact_phone,
            relationship=c.contact_relationship,
        )
        for c in profile.emergency_contacts
    ]

    return ProfileWithLabelsOut(
        user_id=profile.user_id,
        full_name=profile.full_name,
        birth_date=profile.birth_date,
        photo_url=profile.photo_url,
        phone_e164=profile.phone_e164,
        phone_verified=profile.phone_verified,
        city=profile.city,
        state=profile.state,
        life_state_item_id=profile.life_state_item_id,
        marital_status_item_id=profile.marital_status_item_id,
        vocational_reality_item_id=profile.vocational_reality_item_id,
        consecration_year=profile.consecration_year,
        has_vocational_accompaniment=profile.has_vocational_accompaniment,
        vocational_accompanist_user_id=profile.vocational_accompanist_user_id,
        vocational_accompanist_name=profile.vocational_accompanist_name,
        interested_in_ministry=profile.interested_in_ministry,
        interested_ministry_id=profile.interested_ministry_id,
        ministry_interest_notes=profile.ministry_interest_notes,
        instagram=profile.instagram,
        dietary_restriction=profile.dietary_restriction,
        dietary_restriction_notes=profile.dietary_restriction_notes,
        health_insurance=profile.health_insurance,
        health_insurance_name=profile.health_insurance_name,
        accommodation_preference=profile.accommodation_preference,
        is_from_mission=profile.is_from_mission,
        mission_name=profile.mission_name,
        despertar_encounter=profile.despertar_encounter,
        emergency_contacts=emergency_contacts,
        status=profile.status,
        completed_at=profile.completed_at,
        has_documents=bool(profile.cpf_encrypted),
        life_state_label=life_state_label,
        marital_status_label=marital_status_label,
        vocational_reality_label=vocational_reality_label,
        interested_ministry_name=ministry_name,
        vocational_accompanist_display_name=accompanist_display_name,
    )


def _get_catalog_label(db: DBSession, item_id: UUID | None) -> str | None:
    """Retorna o label de um item de catálogo pelo UUID, ou None se não encontrado."""
    if not item_id:
        return None
    item = db.get(ProfileCatalogItem, item_id)
    return item.label if item else None
