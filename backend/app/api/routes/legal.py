"""
Legal Routes
============
Endpoints para termos, privacidade e consentimentos.
"""

from fastapi import APIRouter, HTTPException, Request, status
from sqlalchemy import desc

from app.api.deps import CurrentUser, DBSession
from app.db.models import LegalDocument, UserConsent, UserPreferences
from app.schemas import (
    AcceptLegalRequest,
    AcceptLegalResponse,
    ErrorResponse,
    LatestLegalResponse,
    LegalDocumentResponse,
)
from app.services import create_audit_log

router = APIRouter(prefix="/legal", tags=["Legal"])


@router.get("/latest", response_model=LatestLegalResponse)
async def get_latest_legal(db: DBSession) -> LatestLegalResponse:
    """
    Retorna últimos Termos de Uso e Política de Privacidade publicados.
    """
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


@router.post(
    "/accept",
    response_model=AcceptLegalResponse,
    responses={
        400: {"model": ErrorResponse},
        401: {"model": ErrorResponse},
    },
)
async def accept_legal(
    request: Request,
    body: AcceptLegalRequest,
    current_user: CurrentUser,
    db: DBSession,
) -> AcceptLegalResponse:
    """
    Aceita Termos de Uso e Política de Privacidade.
    
    Registra consentimento com IP e timestamp para compliance.
    """
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
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "bad_request", "message": f"Termos versão {body.terms_version} não encontrados"},
        )

    if not privacy_doc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "bad_request", "message": f"Privacidade versão {body.privacy_version} não encontrada"},
        )

    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    terms_accepted = False
    privacy_accepted = False

    # Terms consent
    existing_terms = (
        db.query(UserConsent)
        .filter(UserConsent.user_id == current_user.id, UserConsent.document_id == terms_doc.id)
        .first()
    )
    if not existing_terms:
        db.add(UserConsent(
            user_id=current_user.id,
            document_id=terms_doc.id,
            ip=client_ip,
            user_agent=user_agent,
        ))
        terms_accepted = True

    # Privacy consent
    existing_privacy = (
        db.query(UserConsent)
        .filter(UserConsent.user_id == current_user.id, UserConsent.document_id == privacy_doc.id)
        .first()
    )
    if not existing_privacy:
        db.add(UserConsent(
            user_id=current_user.id,
            document_id=privacy_doc.id,
            ip=client_ip,
            user_agent=user_agent,
        ))
        privacy_accepted = True

    # Preferences
    preferences = db.query(UserPreferences).filter(UserPreferences.user_id == current_user.id).first()
    if preferences:
        preferences.analytics_opt_in = body.analytics_opt_in
        preferences.push_opt_in = body.push_opt_in
    else:
        db.add(UserPreferences(
            user_id=current_user.id,
            analytics_opt_in=body.analytics_opt_in,
            push_opt_in=body.push_opt_in,
        ))

    # Audit
    create_audit_log(
        db=db,
        actor_user_id=current_user.id,
        action="legal_accepted",
        entity_type="user_consent",
        entity_id=str(current_user.id),
        ip=client_ip,
        user_agent=user_agent,
        metadata={
            "terms_version": body.terms_version,
            "privacy_version": body.privacy_version,
        },
    )

    db.commit()

    return AcceptLegalResponse(
        message="Consentimentos registrados com sucesso",
        terms_accepted=terms_accepted,
        privacy_accepted=privacy_accepted,
    )
