"""
Admin Routes
============
Endpoints administrativos e acesso a dados sensíveis.

SEGURANÇA: Toda visualização de CPF/RG é auditada obrigatoriamente.
"""

from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request

from app.api.deps import CurrentUser, DBSession
from app.core.settings import settings
from app.crypto.service import crypto_service
from app.db.models import SensitiveAccessRequest, UserProfile
from app.schemas import DocumentsResponse, ErrorResponse, SensitiveAccessRequestBody, SensitiveAccessResponse
from app.services import RoleService, audit_sensitive_access, create_audit_log

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.post("/sensitive-access/request", response_model=SensitiveAccessResponse, status_code=201)
async def request_sensitive_access(request: Request, body: SensitiveAccessRequestBody, current_user: CurrentUser, db: DBSession) -> SensitiveAccessResponse:
    """Solicita acesso a dados sensíveis (SECRETARY ou DEV)."""
    if not settings.enable_sensitive_access:
        raise HTTPException(status_code=503, detail={"error": "service_unavailable", "message": "Acesso sensível desabilitado"})

    role_service = RoleService(db)
    if not role_service.can_request_sensitive_access(current_user.id):
        raise HTTPException(status_code=403, detail={"error": "forbidden", "message": "Sem permissão para solicitar acesso"})

    target = db.query(UserProfile).filter(UserProfile.user_id == body.target_user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Usuário não encontrado"})

    existing = db.query(SensitiveAccessRequest).filter(SensitiveAccessRequest.requester_user_id == current_user.id, SensitiveAccessRequest.target_user_id == body.target_user_id, SensitiveAccessRequest.status == "PENDING").first()
    if existing:
        raise HTTPException(status_code=409, detail={"error": "conflict", "message": "Solicitação pendente já existe"})

    access_req = SensitiveAccessRequest(requester_user_id=current_user.id, target_user_id=body.target_user_id, scope="CPF_RG", reason=body.reason, status="PENDING")
    db.add(access_req)

    create_audit_log(db=db, actor_user_id=current_user.id, action="sensitive_access_requested", entity_type="sensitive_access_request", entity_id=str(access_req.id), ip=request.client.host if request.client else None, user_agent=request.headers.get("user-agent"), metadata={"target_user_id": str(body.target_user_id)})
    db.commit()
    db.refresh(access_req)

    return SensitiveAccessResponse(id=access_req.id, requester_user_id=access_req.requester_user_id, target_user_id=access_req.target_user_id, scope=access_req.scope, reason=access_req.reason, status=access_req.status, expires_at=access_req.expires_at, created_at=access_req.created_at)


@router.get("/sensitive-access/pending", response_model=list[SensitiveAccessResponse])
async def get_pending_access_requests(current_user: CurrentUser, db: DBSession) -> list[SensitiveAccessResponse]:
    """Lista solicitações pendentes (COUNCIL_GENERAL ou DEV)."""
    role_service = RoleService(db)
    if not role_service.can_approve_sensitive_access(current_user.id):
        raise HTTPException(status_code=403, detail={"error": "forbidden", "message": "Sem permissão"})

    requests = db.query(SensitiveAccessRequest).filter(SensitiveAccessRequest.status == "PENDING").order_by(SensitiveAccessRequest.created_at.desc()).all()
    return [SensitiveAccessResponse(id=r.id, requester_user_id=r.requester_user_id, target_user_id=r.target_user_id, scope=r.scope, reason=r.reason, status=r.status, expires_at=r.expires_at, created_at=r.created_at) for r in requests]


@router.post("/sensitive-access/{request_id}/approve", response_model=SensitiveAccessResponse)
async def approve_sensitive_access(request: Request, request_id: UUID, current_user: CurrentUser, db: DBSession) -> SensitiveAccessResponse:
    """Aprova solicitação de acesso sensível (COUNCIL_GENERAL ou DEV)."""
    role_service = RoleService(db)
    if not role_service.can_approve_sensitive_access(current_user.id):
        raise HTTPException(status_code=403, detail={"error": "forbidden", "message": "Sem permissão"})

    access_req = db.query(SensitiveAccessRequest).filter(SensitiveAccessRequest.id == request_id).first()
    if not access_req:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Não encontrado"})
    if access_req.status != "PENDING":
        raise HTTPException(status_code=400, detail={"error": "bad_request", "message": "Não está pendente"})

    access_req.status = "APPROVED"
    access_req.approved_by_user_id = current_user.id
    access_req.approved_at = datetime.now(timezone.utc)
    access_req.expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.sensitive_access_duration_minutes)

    create_audit_log(db=db, actor_user_id=current_user.id, action="sensitive_access_approved", entity_type="sensitive_access_request", entity_id=str(request_id), ip=request.client.host if request.client else None, user_agent=request.headers.get("user-agent"), metadata={"requester_id": str(access_req.requester_user_id), "expires_at": access_req.expires_at.isoformat()})
    db.commit()
    db.refresh(access_req)

    return SensitiveAccessResponse(id=access_req.id, requester_user_id=access_req.requester_user_id, target_user_id=access_req.target_user_id, scope=access_req.scope, reason=access_req.reason, status=access_req.status, expires_at=access_req.expires_at, created_at=access_req.created_at)


@router.post("/sensitive-access/{request_id}/reject", response_model=SensitiveAccessResponse)
async def reject_sensitive_access(request: Request, request_id: UUID, current_user: CurrentUser, db: DBSession) -> SensitiveAccessResponse:
    """Rejeita solicitação de acesso sensível."""
    role_service = RoleService(db)
    if not role_service.can_approve_sensitive_access(current_user.id):
        raise HTTPException(status_code=403, detail={"error": "forbidden", "message": "Sem permissão"})

    access_req = db.query(SensitiveAccessRequest).filter(SensitiveAccessRequest.id == request_id).first()
    if not access_req:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Não encontrado"})
    if access_req.status != "PENDING":
        raise HTTPException(status_code=400, detail={"error": "bad_request", "message": "Não está pendente"})

    access_req.status = "REJECTED"
    access_req.approved_by_user_id = current_user.id
    access_req.approved_at = datetime.now(timezone.utc)

    create_audit_log(db=db, actor_user_id=current_user.id, action="sensitive_access_rejected", entity_type="sensitive_access_request", entity_id=str(request_id), ip=request.client.host if request.client else None, user_agent=request.headers.get("user-agent"))
    db.commit()
    db.refresh(access_req)

    return SensitiveAccessResponse(id=access_req.id, requester_user_id=access_req.requester_user_id, target_user_id=access_req.target_user_id, scope=access_req.scope, reason=access_req.reason, status=access_req.status, expires_at=access_req.expires_at, created_at=access_req.created_at)


@router.get("/users/{user_id}/documents", response_model=DocumentsResponse)
async def get_user_documents(request: Request, user_id: UUID, current_user: CurrentUser, db: DBSession) -> DocumentsResponse:
    """
    Retorna documentos sensíveis (CPF/RG).
    
    SEGURANÇA: Requer DEV ou aprovação ativa. SEMPRE auditado.
    """
    role_service = RoleService(db)
    is_dev = role_service.is_dev(current_user.id)

    access_request = None
    if not is_dev:
        access_request = db.query(SensitiveAccessRequest).filter(
            SensitiveAccessRequest.requester_user_id == current_user.id,
            SensitiveAccessRequest.target_user_id == user_id,
            SensitiveAccessRequest.status == "APPROVED",
            SensitiveAccessRequest.expires_at > datetime.now(timezone.utc),
        ).first()

        if not access_request:
            raise HTTPException(status_code=403, detail={"error": "forbidden", "message": "Sem permissão de acesso válida"})

    profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    if not profile or not profile.cpf_encrypted or not profile.rg_encrypted:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Documentos não encontrados"})

    if not crypto_service.is_configured:
        raise HTTPException(status_code=503, detail={"error": "service_unavailable", "message": "Decriptação indisponível"})

    try:
        cpf = crypto_service.decrypt(profile.cpf_encrypted)
        rg = crypto_service.decrypt(profile.rg_encrypted)
    except Exception:
        raise HTTPException(status_code=500, detail={"error": "decryption_error", "message": "Falha na decriptação"})

    # AUDITORIA OBRIGATÓRIA
    audit_sensitive_access(
        db=db,
        viewer_user_id=current_user.id,
        target_user_id=user_id,
        action="VIEW_CPF_RG",
        request_id=access_request.id if access_request else None,
        ip=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        access_type="dev_bypass" if is_dev else "approved_request",
    )
    db.commit()

    return DocumentsResponse(cpf=cpf, rg=rg)
