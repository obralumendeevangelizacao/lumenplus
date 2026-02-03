"""Admin endpoints for sensitive data access."""

from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.api.deps import CurrentUser, DBSession
from app.audit.service import create_audit_log
from app.crypto.service import crypto_service
from app.db.models import GlobalRole, SensitiveAccessAudit, SensitiveAccessRequest, UserGlobalRole, UserProfile

router = APIRouter(prefix="/admin", tags=["Admin"])

DEFAULT_ACCESS_DURATION_MINUTES = 30


class SensitiveAccessRequestBody(BaseModel):
    target_user_id: UUID
    reason: str


class SensitiveAccessResponse(BaseModel):
    id: UUID
    requester_user_id: UUID
    target_user_id: UUID
    scope: str
    reason: str
    status: str
    expires_at: datetime | None
    created_at: datetime


class DocumentsResponse(BaseModel):
    cpf: str
    rg: str


def get_user_global_roles(db, user_id: UUID) -> list[str]:
    roles = db.query(GlobalRole.code).join(UserGlobalRole).filter(UserGlobalRole.user_id == user_id).all()
    return [r[0] for r in roles]


def require_role(db, user_id: UUID, allowed_roles: list[str]) -> None:
    user_roles = get_user_global_roles(db, user_id)
    if not any(role in allowed_roles for role in user_roles):
        raise HTTPException(status_code=403, detail={"error": "forbidden", "message": "Insufficient permissions"})


@router.post("/sensitive-access/request", response_model=SensitiveAccessResponse, status_code=201)
async def request_sensitive_access(request: Request, body: SensitiveAccessRequestBody, current_user: CurrentUser, db: DBSession) -> SensitiveAccessResponse:
    """Request access to sensitive data (SECRETARY only)."""
    require_role(db, current_user.id, ["SECRETARY", "DEV"])

    target_profile = db.query(UserProfile).filter(UserProfile.user_id == body.target_user_id).first()
    if not target_profile:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Target user not found"})

    existing = db.query(SensitiveAccessRequest).filter(
        SensitiveAccessRequest.requester_user_id == current_user.id,
        SensitiveAccessRequest.target_user_id == body.target_user_id,
        SensitiveAccessRequest.status == "PENDING",
    ).first()

    if existing:
        raise HTTPException(status_code=409, detail={"error": "conflict", "message": "Pending request already exists"})

    access_request = SensitiveAccessRequest(
        requester_user_id=current_user.id,
        target_user_id=body.target_user_id,
        scope="CPF_RG",
        reason=body.reason,
        status="PENDING",
    )
    db.add(access_request)

    create_audit_log(db=db, actor_user_id=current_user.id, action="sensitive_access_requested", entity_type="sensitive_access_request", entity_id=str(access_request.id), ip=request.client.host if request.client else None, user_agent=request.headers.get("user-agent"), metadata={"target_user_id": str(body.target_user_id), "scope": "CPF_RG"})
    db.commit()
    db.refresh(access_request)

    return SensitiveAccessResponse(id=access_request.id, requester_user_id=access_request.requester_user_id, target_user_id=access_request.target_user_id, scope=access_request.scope, reason=access_request.reason, status=access_request.status, expires_at=access_request.expires_at, created_at=access_request.created_at)


@router.get("/sensitive-access/pending", response_model=list[SensitiveAccessResponse])
async def get_pending_access_requests(current_user: CurrentUser, db: DBSession) -> list[SensitiveAccessResponse]:
    """Get pending sensitive access requests (COUNCIL_GENERAL or DEV only)."""
    require_role(db, current_user.id, ["COUNCIL_GENERAL", "DEV"])

    requests = db.query(SensitiveAccessRequest).filter(SensitiveAccessRequest.status == "PENDING").order_by(SensitiveAccessRequest.created_at.desc()).all()
    return [SensitiveAccessResponse(id=r.id, requester_user_id=r.requester_user_id, target_user_id=r.target_user_id, scope=r.scope, reason=r.reason, status=r.status, expires_at=r.expires_at, created_at=r.created_at) for r in requests]


@router.post("/sensitive-access/{request_id}/approve", response_model=SensitiveAccessResponse)
async def approve_sensitive_access(request: Request, request_id: UUID, current_user: CurrentUser, db: DBSession) -> SensitiveAccessResponse:
    """Approve sensitive access request (COUNCIL_GENERAL or DEV only)."""
    require_role(db, current_user.id, ["COUNCIL_GENERAL", "DEV"])

    access_request = db.query(SensitiveAccessRequest).filter(SensitiveAccessRequest.id == request_id).first()
    if not access_request:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Request not found"})
    if access_request.status != "PENDING":
        raise HTTPException(status_code=400, detail={"error": "bad_request", "message": "Request is not pending"})

    access_request.status = "APPROVED"
    access_request.approved_by_user_id = current_user.id
    access_request.approved_at = datetime.now(timezone.utc)
    access_request.expires_at = datetime.now(timezone.utc) + timedelta(minutes=DEFAULT_ACCESS_DURATION_MINUTES)

    create_audit_log(db=db, actor_user_id=current_user.id, action="sensitive_access_approved", entity_type="sensitive_access_request", entity_id=str(request_id), ip=request.client.host if request.client else None, user_agent=request.headers.get("user-agent"), metadata={"requester_user_id": str(access_request.requester_user_id), "target_user_id": str(access_request.target_user_id), "expires_at": access_request.expires_at.isoformat()})
    db.commit()
    db.refresh(access_request)

    return SensitiveAccessResponse(id=access_request.id, requester_user_id=access_request.requester_user_id, target_user_id=access_request.target_user_id, scope=access_request.scope, reason=access_request.reason, status=access_request.status, expires_at=access_request.expires_at, created_at=access_request.created_at)


@router.post("/sensitive-access/{request_id}/reject", response_model=SensitiveAccessResponse)
async def reject_sensitive_access(request: Request, request_id: UUID, current_user: CurrentUser, db: DBSession) -> SensitiveAccessResponse:
    """Reject sensitive access request (COUNCIL_GENERAL or DEV only)."""
    require_role(db, current_user.id, ["COUNCIL_GENERAL", "DEV"])

    access_request = db.query(SensitiveAccessRequest).filter(SensitiveAccessRequest.id == request_id).first()
    if not access_request:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Request not found"})
    if access_request.status != "PENDING":
        raise HTTPException(status_code=400, detail={"error": "bad_request", "message": "Request is not pending"})

    access_request.status = "REJECTED"
    access_request.approved_by_user_id = current_user.id
    access_request.approved_at = datetime.now(timezone.utc)

    create_audit_log(db=db, actor_user_id=current_user.id, action="sensitive_access_rejected", entity_type="sensitive_access_request", entity_id=str(request_id), ip=request.client.host if request.client else None, user_agent=request.headers.get("user-agent"), metadata={"requester_user_id": str(access_request.requester_user_id), "target_user_id": str(access_request.target_user_id)})
    db.commit()
    db.refresh(access_request)

    return SensitiveAccessResponse(id=access_request.id, requester_user_id=access_request.requester_user_id, target_user_id=access_request.target_user_id, scope=access_request.scope, reason=access_request.reason, status=access_request.status, expires_at=access_request.expires_at, created_at=access_request.created_at)


@router.get("/users/{user_id}/documents", response_model=DocumentsResponse)
async def get_user_documents(request: Request, user_id: UUID, current_user: CurrentUser, db: DBSession) -> DocumentsResponse:
    """Get user's sensitive documents (CPF/RG). Requires DEV role or approved access request."""
    user_roles = get_user_global_roles(db, current_user.id)
    is_dev = "DEV" in user_roles

    access_request = None
    if not is_dev:
        access_request = db.query(SensitiveAccessRequest).filter(
            SensitiveAccessRequest.requester_user_id == current_user.id,
            SensitiveAccessRequest.target_user_id == user_id,
            SensitiveAccessRequest.status == "APPROVED",
            SensitiveAccessRequest.expires_at > datetime.now(timezone.utc),
        ).first()

        if not access_request:
            raise HTTPException(status_code=403, detail={"error": "forbidden", "message": "No valid access permission"})

    profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    if not profile or not profile.cpf_encrypted or not profile.rg_encrypted:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Documents not found"})

    if not crypto_service.is_configured:
        raise HTTPException(status_code=503, detail={"error": "service_unavailable", "message": "Decryption service not available"})

    try:
        cpf = crypto_service.decrypt(profile.cpf_encrypted)
        rg = crypto_service.decrypt(profile.rg_encrypted)
    except Exception:
        raise HTTPException(status_code=500, detail={"error": "decryption_error", "message": "Failed to decrypt documents"})

    # Audit
    audit_entry = SensitiveAccessAudit(
        request_id=access_request.id if access_request else None,
        viewer_user_id=current_user.id,
        target_user_id=user_id,
        action="VIEW_CPF_RG",
        ip=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    db.add(audit_entry)

    create_audit_log(db=db, actor_user_id=current_user.id, action="sensitive_documents_viewed", entity_type="user_profile", entity_id=str(user_id), ip=request.client.host if request.client else None, user_agent=request.headers.get("user-agent"), metadata={"access_type": "dev_bypass" if is_dev else "approved_request", "request_id": str(access_request.id) if access_request else None})
    db.commit()

    return DocumentsResponse(cpf=cpf, rg=rg)