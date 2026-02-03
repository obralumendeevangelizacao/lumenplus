"""
Rotas de Profile
================
"""

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.models import User, UserProfile, UserEmergencyContact, PhoneVerification, EmailVerification, OrgUnit
from app.api.routes.auth import get_current_user
from app.core.settings import settings

router = APIRouter(tags=["profile"])


# === SCHEMAS ===

from pydantic import BaseModel, Field
from datetime import date

class ProfileUpdateRequest(BaseModel):
    full_name: str = Field(..., min_length=2)
    birth_date: date
    cpf: str
    rg: str
    phone_e164: str
    city: str
    state: str = Field(..., min_length=2, max_length=2)
    
    # Estado de vida
    life_state: str  # SIMPATIZANTE, CAMINHANTE, PEREGRINO, DISCIPULO, APOSTOLO, CONSAGRADO_FILHO_DA_LUZ
    consecration_year: int | None = None  # Obrigatório se life_state = CONSAGRADO_FILHO_DA_LUZ
    
    # Estado civil e vocacional
    marital_status: str  # SOLTEIRO, CASADO, etc
    vocational_reality: str  # LEIGO, SEMINARISTA, etc
    
    # Acompanhamento vocacional
    has_vocational_accompaniment: bool
    vocational_accompanist_user_id: UUID | None = None
    vocational_accompanist_name: str | None = None
    
    # Interesse em ministério
    interested_in_ministry: bool
    interested_ministry_id: UUID | None = None
    ministry_interest_notes: str | None = None


class ProfileOut(BaseModel):
    user_id: UUID
    full_name: str | None
    birth_date: date | None
    photo_url: str | None
    phone_e164: str | None
    phone_verified: bool
    city: str | None
    state: str | None
    life_state: str | None
    consecration_year: int | None
    marital_status: str | None
    vocational_reality: str | None
    has_vocational_accompaniment: bool | None
    vocational_accompanist_name: str | None
    interested_in_ministry: bool | None
    interested_ministry_name: str | None
    ministry_interest_notes: str | None
    status: str
    has_documents: bool

    class Config:
        from_attributes = True


class EmergencyContactRequest(BaseModel):
    name: str
    phone_e164: str
    relationship: str


class EmergencyContactOut(BaseModel):
    id: UUID
    name: str
    phone_e164: str
    relationship: str

    class Config:
        from_attributes = True


# === ROUTES ===

@router.get("/profile", response_model=ProfileOut)
async def get_profile(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retorna perfil do usuário."""
    profile = user.profile
    if not profile:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Perfil não encontrado"})
    
    # Nome do acompanhador
    accompanist_name = profile.vocational_accompanist_name
    if profile.vocational_accompanist_user_id:
        accompanist = db.get(User, profile.vocational_accompanist_user_id)
        if accompanist and accompanist.profile:
            accompanist_name = accompanist.profile.full_name
    
    # Nome do ministério de interesse
    ministry_name = None
    if profile.interested_ministry_id:
        ministry = db.get(OrgUnit, profile.interested_ministry_id)
        if ministry:
            ministry_name = ministry.name
    
    return ProfileOut(
        user_id=profile.user_id,
        full_name=profile.full_name,
        birth_date=profile.birth_date,
        photo_url=profile.photo_url,
        phone_e164=profile.phone_e164,
        phone_verified=profile.phone_verified,
        city=profile.city,
        state=profile.state,
        life_state=profile.life_state,
        consecration_year=profile.consecration_year,
        marital_status=profile.marital_status,
        vocational_reality=profile.vocational_reality,
        has_vocational_accompaniment=profile.has_vocational_accompaniment,
        vocational_accompanist_name=accompanist_name,
        interested_in_ministry=profile.interested_in_ministry,
        interested_ministry_name=ministry_name,
        ministry_interest_notes=profile.ministry_interest_notes,
        status=profile.status,
        has_documents=bool(profile.cpf_encrypted),
    )


@router.put("/profile", response_model=ProfileOut)
async def update_profile(
    data: ProfileUpdateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Atualiza perfil do usuário."""
    profile = user.profile
    if not profile:
        profile = UserProfile(user_id=user.id)
        db.add(profile)
    
    # Validações condicionais
    if data.vocational_reality == "CONSAGRADO_FILHO_DA_LUZ" and not data.consecration_year:
        raise HTTPException(
            status_code=400,
            detail={"error": "validation_error", "message": "Ano de consagração é obrigatório para Consagrado Filho da Luz", "field": "consecration_year"}
        )
    
    if data.has_vocational_accompaniment and not data.vocational_accompanist_user_id and not data.vocational_accompanist_name:
        raise HTTPException(
            status_code=400,
            detail={"error": "validation_error", "message": "Informe quem é seu acompanhador vocacional", "field": "vocational_accompanist"}
        )
    
    if data.interested_in_ministry and not data.interested_ministry_id:
        raise HTTPException(
            status_code=400,
            detail={"error": "validation_error", "message": "Selecione o ministério de interesse", "field": "interested_ministry_id"}
        )
    
    # Atualiza campos
    profile.full_name = data.full_name
    profile.birth_date = data.birth_date
    profile.phone_e164 = data.phone_e164
    profile.city = data.city
    profile.state = data.state.upper()
    profile.life_state = data.life_state
    profile.consecration_year = data.consecration_year if data.vocational_reality == "CONSAGRADO_FILHO_DA_LUZ" else None
    profile.marital_status = data.marital_status
    profile.vocational_reality = data.vocational_reality
    profile.has_vocational_accompaniment = data.has_vocational_accompaniment
    profile.vocational_accompanist_user_id = data.vocational_accompanist_user_id if data.has_vocational_accompaniment else None
    profile.vocational_accompanist_name = data.vocational_accompanist_name if data.has_vocational_accompaniment else None
    profile.interested_in_ministry = data.interested_in_ministry
    profile.interested_ministry_id = data.interested_ministry_id if data.interested_in_ministry else None
    profile.ministry_interest_notes = data.ministry_interest_notes if data.interested_in_ministry else None
    
    # CPF/RG (simplificado - em produção usar criptografia)
    cpf_clean = "".join(c for c in data.cpf if c.isdigit())
    profile.cpf_hash = hashlib.sha256(cpf_clean.encode()).hexdigest()
    profile.cpf_encrypted = cpf_clean.encode()  # TODO: Criptografar
    profile.rg_encrypted = data.rg.encode()  # TODO: Criptografar
    
    # Atualiza status
    if not profile.phone_verified:
        profile.status = "PENDING_PHONE"
    else:
        profile.status = "COMPLETE"
        profile.completed_at = datetime.now(timezone.utc)
    
    db.commit()
    db.refresh(profile)
    
    return await get_profile(user, db)


@router.post("/profile/photo")
async def upload_photo(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload de foto do perfil."""
    profile = user.profile
    if not profile:
        profile = UserProfile(user_id=user.id)
        db.add(profile)
    
    # TODO: Salvar no storage (S3, GCS, etc)
    # Por enquanto, salva como base64 ou retorna URL fake
    
    # Validar tipo de arquivo
    if file.content_type not in ["image/jpeg", "image/png", "image/webp"]:
        raise HTTPException(
            status_code=400,
            detail={"error": "invalid_file", "message": "Arquivo deve ser JPEG, PNG ou WebP"}
        )
    
    # Gera URL fake (em produção: upload para storage)
    photo_url = f"/storage/photos/{user.id}.jpg"
    profile.photo_url = photo_url
    
    db.commit()
    
    return {"photo_url": photo_url, "message": "Foto enviada com sucesso"}


@router.post("/profile/emergency-contact", response_model=EmergencyContactOut)
async def add_emergency_contact(
    data: EmergencyContactRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Adiciona contato de emergência."""
    profile = user.profile
    if not profile:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Complete seu perfil primeiro"})
    
    contact = UserEmergencyContact(
        user_id=profile.user_id,
        contact_name=data.name,
        contact_phone=data.phone_e164,
        contact_relationship=data.relationship,
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


@router.get("/profile/emergency-contacts", response_model=list[EmergencyContactOut])
async def list_emergency_contacts(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Lista contatos de emergência."""
    profile = user.profile
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


# === VERIFICAÇÃO DE TELEFONE ===

@router.post("/verify/phone/start")
async def start_phone_verification(
    phone_e164: str,
    channel: str = "WHATSAPP",
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Inicia verificação de telefone."""
    # Gera código
    code = f"{secrets.randbelow(1000000):06d}"
    code_hash = hashlib.sha256(code.encode()).hexdigest()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
    
    verification = PhoneVerification(
        user_id=user.id,
        phone_e164=phone_e164,
        channel=channel,
        code_hash=code_hash,
        expires_at=expires_at,
    )
    db.add(verification)
    db.commit()
    db.refresh(verification)
    
    # TODO: Enviar SMS/WhatsApp
    
    response = {
        "verification_id": verification.id,
        "expires_at": expires_at.isoformat(),
    }
    
    # Em dev, retorna código
    if settings.debug_verification_code:
        response["debug_code"] = code
    
    return response


@router.post("/verify/phone/confirm")
async def confirm_phone_verification(
    verification_id: UUID,
    code: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Confirma verificação de telefone."""
    verification = db.get(PhoneVerification, verification_id)
    
    if not verification or verification.user_id != user.id:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Verificação não encontrada"})
    
    if verification.verified_at:
        raise HTTPException(status_code=400, detail={"error": "already_verified", "message": "Já verificado"})
    
    if verification.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail={"error": "expired", "message": "Código expirado"})
    
    if verification.attempts >= 5:
        raise HTTPException(status_code=400, detail={"error": "too_many_attempts", "message": "Muitas tentativas"})
    
    code_hash = hashlib.sha256(code.encode()).hexdigest()
    if code_hash != verification.code_hash:
        verification.attempts += 1
        db.commit()
        raise HTTPException(status_code=400, detail={"error": "invalid_code", "message": "Código inválido"})
    
    # Sucesso!
    verification.verified_at = datetime.now(timezone.utc)
    
    # Atualiza perfil
    profile = user.profile
    if profile:
        profile.phone_verified = True
        profile.phone_e164 = verification.phone_e164
        if profile.status == "PENDING_PHONE":
            profile.status = "COMPLETE"
            profile.completed_at = datetime.now(timezone.utc)
    
    db.commit()
    
    return {"verified": True, "message": "Telefone verificado com sucesso!"}


# === CATÁLOGOS ===

@router.get("/profile/catalogs")
async def get_catalogs():
    """Retorna opções para formulário de perfil."""
    return {
        # Estado de Vida (situação eclesial/vocacional)
        "life_states": [
            {"code": "LEIGO", "label": "Leigo(a)"},
            {"code": "LEIGO_CONSAGRADO", "label": "Leigo(a) Consagrado(a)"},
            {"code": "NOVICA", "label": "Noviça"},
            {"code": "SEMINARISTA", "label": "Seminarista"},
            {"code": "RELIGIOSO", "label": "Religioso(a)"},
            {"code": "DIACONO_PERMANENTE", "label": "Diácono Permanente"},
            {"code": "DIACONO", "label": "Diácono"},
            {"code": "SACERDOTE_RELIGIOSO", "label": "Sacerdote Religioso"},
            {"code": "SACERDOTE_DIOCESANO", "label": "Sacerdote Diocesano"},
            {"code": "BISPO", "label": "Bispo"},
        ],
        # Estado Civil
        "marital_statuses": [
            {"code": "SOLTEIRO", "label": "Solteiro(a)"},
            {"code": "NOIVO", "label": "Noivo(a)"},
            {"code": "CASADO", "label": "Casado(a)"},
            {"code": "DIVORCIADO", "label": "Divorciado(a)"},
            {"code": "VIUVO", "label": "Viúvo(a)"},
            {"code": "UNIAO_ESTAVEL", "label": "União Estável"},
        ],
        # Realidade Vocacional (etapa na comunidade)
        "vocational_realities": [
            {"code": "MEMBRO_ACOLHIDA", "label": "Membro do Acolhida"},
            {"code": "MEMBRO_APROFUNDAMENTO", "label": "Membro do Aprofundamento"},
            {"code": "VOCACIONAL", "label": "Vocacional"},
            {"code": "POSTULANTE_PRIMEIRO_ANO", "label": "Postulante de Primeiro Ano"},
            {"code": "POSTULANTE_SEGUNDO_ANO", "label": "Postulante de Segundo Ano"},
            {"code": "DISCIPULO_VOCACIONAL", "label": "Discípulo Vocacional"},
            {"code": "CONSAGRADO_FILHO_DA_LUZ", "label": "Consagrado Filho da Luz"},
        ],
    }