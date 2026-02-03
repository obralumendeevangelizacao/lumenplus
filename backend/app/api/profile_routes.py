"""Profile management endpoints."""

from datetime import date, datetime, timezone
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.exc import IntegrityError

from app.api.deps import CurrentUser, DBSession
from app.audit.service import create_audit_log
from app.crypto.service import crypto_service
from app.db.models import ProfileCatalog, ProfileCatalogItem, UserEmergencyContact, UserProfile

router = APIRouter(prefix="/profile", tags=["Profile"])


# SCHEMAS
class CatalogItemResponse(BaseModel):
    id: UUID
    code: str
    label: str


class CatalogResponse(BaseModel):
    code: str
    name: str
    items: list[CatalogItemResponse]


class ProfileUpdateRequest(BaseModel):
    full_name: str = Field(..., min_length=3, max_length=200)
    birth_date: date
    cpf: str = Field(..., min_length=11, max_length=14)
    rg: str = Field(..., min_length=5, max_length=20)
    phone_e164: str = Field(..., pattern=r"^\+[1-9]\d{10,14}$")
    city: str = Field(..., min_length=2, max_length=100)
    state: str = Field(..., min_length=2, max_length=2)
    life_state_item_id: UUID
    marital_status_item_id: UUID
    vocational_reality_item_id: UUID

    @field_validator("cpf")
    @classmethod
    def validate_cpf(cls, v: str) -> str:
        digits = "".join(c for c in v if c.isdigit())
        if len(digits) != 11:
            raise ValueError("CPF must have 11 digits")
        return v

    @field_validator("state")
    @classmethod
    def validate_state(cls, v: str) -> str:
        return v.upper()


class EmergencyContactRequest(BaseModel):
    name: str = Field(..., min_length=3, max_length=200)
    phone_e164: str = Field(..., pattern=r"^\+[1-9]\d{10,14}$")
    relationship: str = Field(..., min_length=2, max_length=50)


class EmergencyContactResponse(BaseModel):
    id: UUID
    name: str
    phone_e164: str
    relationship: str


class ProfileResponse(BaseModel):
    user_id: UUID
    full_name: str | None
    birth_date: date | None
    phone_e164: str | None
    phone_verified: bool
    city: str | None
    state: str | None
    life_state_item_id: UUID | None
    marital_status_item_id: UUID | None
    vocational_reality_item_id: UUID | None
    status: str
    completed_at: datetime | None
    emergency_contacts: list[EmergencyContactResponse]


# ENDPOINTS
@router.get("/catalogs", response_model=list[CatalogResponse])
async def get_catalogs(db: DBSession) -> list[CatalogResponse]:
    """Get all profile catalogs with active items."""
    catalogs = db.query(ProfileCatalog).all()
    result = []
    for catalog in catalogs:
        items = db.query(ProfileCatalogItem).filter(ProfileCatalogItem.catalog_id == catalog.id, ProfileCatalogItem.is_active == True).order_by(ProfileCatalogItem.sort_order).all()
        result.append(CatalogResponse(code=catalog.code, name=catalog.name, items=[CatalogItemResponse(id=item.id, code=item.code, label=item.label) for item in items]))
    return result


@router.get("", response_model=ProfileResponse)
async def get_profile(current_user: CurrentUser, db: DBSession) -> ProfileResponse:
    """Get current user's profile."""
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()

    if not profile:
        return ProfileResponse(user_id=current_user.id, full_name=None, birth_date=None, phone_e164=None, phone_verified=False, city=None, state=None, life_state_item_id=None, marital_status_item_id=None, vocational_reality_item_id=None, status="INCOMPLETE", completed_at=None, emergency_contacts=[])

    emergency_contacts = [EmergencyContactResponse(id=ec.id, name=ec.contact_name, phone_e164=ec.contact_phone, relationship=ec.contact_relationship) for ec in profile.emergency_contacts]

    return ProfileResponse(user_id=profile.user_id, full_name=profile.full_name, birth_date=profile.birth_date, phone_e164=profile.phone_e164, phone_verified=profile.phone_verified, city=profile.city, state=profile.state, life_state_item_id=profile.life_state_item_id, marital_status_item_id=profile.marital_status_item_id, vocational_reality_item_id=profile.vocational_reality_item_id, status=profile.status, completed_at=profile.completed_at, emergency_contacts=emergency_contacts)


@router.put("", response_model=ProfileResponse)
async def update_profile(request: Request, body: ProfileUpdateRequest, current_user: CurrentUser, db: DBSession) -> ProfileResponse:
    """Create or update user profile (idempotent)."""
    if not crypto_service.is_configured:
        raise HTTPException(status_code=503, detail={"error": "service_unavailable", "message": "Encryption service not configured"})

    try:
        cpf_hash, cpf_encrypted = crypto_service.encrypt_cpf(body.cpf)
        rg_encrypted = crypto_service.encrypt_rg(body.rg)
    except ValueError as e:
        raise HTTPException(status_code=400, detail={"error": "validation_error", "message": str(e)})

    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()

    try:
        if profile:
            profile.full_name = body.full_name
            profile.birth_date = body.birth_date
            profile.cpf_hash = cpf_hash
            profile.cpf_encrypted = cpf_encrypted
            profile.rg_encrypted = rg_encrypted
            profile.city = body.city
            profile.state = body.state
            profile.life_state_item_id = body.life_state_item_id
            profile.marital_status_item_id = body.marital_status_item_id
            profile.vocational_reality_item_id = body.vocational_reality_item_id

            if profile.phone_e164 != body.phone_e164:
                profile.phone_e164 = body.phone_e164
                profile.phone_verified = False

            if profile.phone_verified:
                profile.status = "COMPLETE"
                if not profile.completed_at:
                    profile.completed_at = datetime.now(timezone.utc)
            else:
                profile.status = "PENDING_VERIFICATION"

            action = "profile_updated"
        else:
            profile = UserProfile(
                user_id=current_user.id, full_name=body.full_name, birth_date=body.birth_date,
                cpf_hash=cpf_hash, cpf_encrypted=cpf_encrypted, rg_encrypted=rg_encrypted,
                phone_e164=body.phone_e164, phone_verified=False, city=body.city, state=body.state,
                life_state_item_id=body.life_state_item_id, marital_status_item_id=body.marital_status_item_id,
                vocational_reality_item_id=body.vocational_reality_item_id, status="PENDING_VERIFICATION",
            )
            db.add(profile)
            action = "profile_created"

        db.flush()
        create_audit_log(db=db, actor_user_id=current_user.id, action=action, entity_type="user_profile", entity_id=str(current_user.id), ip=request.client.host if request.client else None, user_agent=request.headers.get("user-agent"), metadata={"status": profile.status})
        db.commit()
        db.refresh(profile)

    except IntegrityError as e:
        db.rollback()
        if "cpf_hash" in str(e):
            raise HTTPException(status_code=409, detail={"error": "conflict", "message": "CPF already registered"})
        if "phone_e164" in str(e):
            raise HTTPException(status_code=409, detail={"error": "conflict", "message": "Phone number already registered"})
        raise

    emergency_contacts = [EmergencyContactResponse(id=ec.id, name=ec.contact_name, phone_e164=ec.contact_phone, relationship=ec.contact_relationship) for ec in profile.emergency_contacts]

    return ProfileResponse(user_id=profile.user_id, full_name=profile.full_name, birth_date=profile.birth_date, phone_e164=profile.phone_e164, phone_verified=profile.phone_verified, city=profile.city, state=profile.state, life_state_item_id=profile.life_state_item_id, marital_status_item_id=profile.marital_status_item_id, vocational_reality_item_id=profile.vocational_reality_item_id, status=profile.status, completed_at=profile.completed_at, emergency_contacts=emergency_contacts)


@router.post("/emergency-contact", response_model=EmergencyContactResponse, status_code=201)
async def create_emergency_contact(request: Request, body: EmergencyContactRequest, current_user: CurrentUser, db: DBSession) -> EmergencyContactResponse:
    """Add or update emergency contact."""
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=400, detail={"error": "bad_request", "message": "Profile must be created first"})

    existing = db.query(UserEmergencyContact).filter(UserEmergencyContact.user_id == current_user.id).first()

    if existing:
        existing.contact_name = body.name
        existing.contact_phone = body.phone_e164
        existing.contact_relationship = body.relationship
        contact = existing
    else:
        contact = UserEmergencyContact(user_id=current_user.id, contact_name=body.name, contact_phone=body.phone_e164, contact_relationship=body.relationship)
        db.add(contact)

    db.commit()
    db.refresh(contact)

    return EmergencyContactResponse(id=contact.id, name=contact.contact_name, phone_e164=contact.contact_phone, relationship=contact.contact_relationship)