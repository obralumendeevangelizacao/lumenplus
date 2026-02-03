"""Legal documents and consent endpoints."""

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import desc

from app.api.deps import CurrentUser, DBSession
from app.audit.service import create_audit_log
from app.db.models import LegalDocument, UserConsent, UserPreferences

router = APIRouter(prefix="/legal", tags=["Legal"])


class LegalDocumentResponse(BaseModel):
    id: UUID
    type: str
    version: str
    content: str
    published_at: datetime


class LatestLegalResponse(BaseModel):
    terms: LegalDocumentResponse | None
    privacy: LegalDocumentResponse | None


class AcceptLegalRequest(BaseModel):
    terms_version: str
    privacy_version: str
    analytics_opt_in: bool = False
    push_opt_in: bool = True


class AcceptLegalResponse(BaseModel):
    message: str
    terms_accepted: bool
    privacy_accepted: bool


@router.get("/latest", response_model=LatestLegalResponse)
async def get_latest_legal(db: DBSession) -> LatestLegalResponse:
    """Get latest published terms and privacy policy."""
    terms = (
        db.query(LegalDocument)
        .filter(LegalDocument.type == "TERMS")
        .order_by(desc(LegalDocument.published_at))
        .first()
    )

    privacy = (
        db.query(LegalDocument)
        .filter(LegalDocument.type == "PRIVACY")
        .order_by(desc(LegalDocument.published_at))
        .first()
    )

    return LatestLegalResponse(
        terms=LegalDocumentResponse(
            id=terms.id,
            type=terms.type,
            version=terms.version,
            content=terms.content,
            published_at=terms.published_at,
        ) if terms else None,
        privacy=LegalDocumentResponse(
            id=privacy.id,
            type=privacy.type,
            version=privacy.version,
            content=privacy.content,
            published_at=privacy.published_at,
        ) if privacy else None,
    )


@router.post("/accept", response_model=AcceptLegalResponse)
async def accept_legal(
    request: Request,
    body: AcceptLegalRequest,
    current_user: CurrentUser,
    db: DBSession,
) -> AcceptLegalResponse:
    """Accept terms and privacy policy."""
    terms_doc = (
        db.query(LegalDocument)
        .filter(LegalDocument.type == "TERMS", LegalDocument.version == body.terms_version)
        .first()
    )

    privacy_doc = (
        db.query(LegalDocument)
        .filter(LegalDocument.type == "PRIVACY", LegalDocument.version == body.privacy_version)
        .first()
    )

    if not terms_doc:
        raise HTTPException(status_code=400, detail={"error": "bad_request", "message": f"Terms version {body.terms_version} not found"})

    if not privacy_doc:
        raise HTTPException(status_code=400, detail={"error": "bad_request", "message": f"Privacy version {body.privacy_version} not found"})

    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    terms_accepted = False
    privacy_accepted = False

    existing_terms = db.query(UserConsent).filter(UserConsent.user_id == current_user.id, UserConsent.document_id == terms_doc.id).first()
    if not existing_terms:
        db.add(UserConsent(user_id=current_user.id, document_id=terms_doc.id, ip=client_ip, user_agent=user_agent))
        terms_accepted = True

    existing_privacy = db.query(UserConsent).filter(UserConsent.user_id == current_user.id, UserConsent.document_id == privacy_doc.id).first()
    if not existing_privacy:
        db.add(UserConsent(user_id=current_user.id, document_id=privacy_doc.id, ip=client_ip, user_agent=user_agent))
        privacy_accepted = True

    preferences = db.query(UserPreferences).filter(UserPreferences.user_id == current_user.id).first()
    if preferences:
        preferences.analytics_opt_in = body.analytics_opt_in
        preferences.push_opt_in = body.push_opt_in
    else:
        db.add(UserPreferences(user_id=current_user.id, analytics_opt_in=body.analytics_opt_in, push_opt_in=body.push_opt_in))

    create_audit_log(db=db, actor_user_id=current_user.id, action="legal_accepted", entity_type="user_consent", entity_id=str(current_user.id), ip=client_ip, user_agent=user_agent, metadata={"terms_version": body.terms_version, "privacy_version": body.privacy_version})
    db.commit()

    return AcceptLegalResponse(message="Consents recorded successfully", terms_accepted=terms_accepted, privacy_accepted=privacy_accepted)