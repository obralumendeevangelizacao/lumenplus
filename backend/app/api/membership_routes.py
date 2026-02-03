"""Organization membership endpoints."""

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.api.deps import CurrentUser, DBSession
from app.audit.service import create_audit_log
from app.db.models import GlobalRole, OrgMembership, OrgRole, OrgUnit, UserGlobalRole, MembershipStatus

router = APIRouter(prefix="/org-memberships", tags=["Memberships"])


class MembershipRequestBody(BaseModel):
    org_unit_id: UUID


class MembershipResponse(BaseModel):
    id: UUID
    org_unit_id: UUID
    org_unit_name: str
    org_unit_type: str
    role_code: str
    status: str
    created_at: datetime


class PendingMemberResponse(BaseModel):
    membership_id: UUID
    user_id: UUID
    user_email: str | None
    requested_at: datetime


def has_global_role(db, user_id: UUID, role_codes: list[str]) -> bool:
    return db.query(UserGlobalRole).join(GlobalRole).filter(UserGlobalRole.user_id == user_id, GlobalRole.code.in_(role_codes)).first() is not None


def is_coordinator_of(db, user_id: UUID, org_unit_id: UUID) -> bool:
    coordinator_role = db.query(OrgRole).filter(OrgRole.code == "COORDINATOR").first()
    if not coordinator_role:
        return False
    return db.query(OrgMembership).filter(
        OrgMembership.user_id == user_id,
        OrgMembership.org_unit_id == org_unit_id,
        OrgMembership.org_role_id == coordinator_role.id,
        OrgMembership.status == MembershipStatus.ACTIVE,
    ).first() is not None


@router.post("/request", response_model=MembershipResponse, status_code=201)
async def request_membership(request: Request, body: MembershipRequestBody, current_user: CurrentUser, db: DBSession) -> MembershipResponse:
    """Request membership to an organization unit."""
    org_unit = db.query(OrgUnit).filter(OrgUnit.id == body.org_unit_id, OrgUnit.is_active == True).first()
    if not org_unit:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Organization unit not found"})

    existing = db.query(OrgMembership).filter(OrgMembership.user_id == current_user.id, OrgMembership.org_unit_id == body.org_unit_id).first()
    if existing:
        if existing.status == MembershipStatus.ACTIVE:
            raise HTTPException(status_code=409, detail={"error": "conflict", "message": "Already a member"})
        if existing.status == MembershipStatus.PENDING:
            raise HTTPException(status_code=409, detail={"error": "conflict", "message": "Request already pending"})

    member_role = db.query(OrgRole).filter(OrgRole.code == "MEMBER").first()
    if not member_role:
        raise HTTPException(status_code=500, detail={"error": "internal", "message": "Member role not configured"})

    membership = OrgMembership(user_id=current_user.id, org_unit_id=body.org_unit_id, org_role_id=member_role.id, status=MembershipStatus.PENDING)
    db.add(membership)

    create_audit_log(db=db, actor_user_id=current_user.id, action="membership_requested", entity_type="org_membership", entity_id=str(membership.id), ip=request.client.host if request.client else None, user_agent=request.headers.get("user-agent"), metadata={"org_unit_id": str(body.org_unit_id)})
    db.commit()
    db.refresh(membership)

    return MembershipResponse(id=membership.id, org_unit_id=membership.org_unit_id, org_unit_name=org_unit.name, org_unit_type=org_unit.type.value, role_code=member_role.code, status=membership.status.value, created_at=membership.created_at)


@router.get("/my", response_model=list[MembershipResponse])
async def get_my_memberships(current_user: CurrentUser, db: DBSession) -> list[MembershipResponse]:
    """Get current user's memberships."""
    memberships = db.query(OrgMembership).filter(OrgMembership.user_id == current_user.id).all()
    return [MembershipResponse(id=m.id, org_unit_id=m.org_unit_id, org_unit_name=m.org_unit.name, org_unit_type=m.org_unit.type.value, role_code=m.org_role.code, status=m.status.value, created_at=m.created_at) for m in memberships]


@router.get("/{org_unit_id}/pending", response_model=list[PendingMemberResponse])
async def get_pending_members(org_unit_id: UUID, current_user: CurrentUser, db: DBSession) -> list[PendingMemberResponse]:
    """Get pending membership requests for an org unit (coordinators only)."""
    if not (has_global_role(db, current_user.id, ["DEV", "COUNCIL_GENERAL"]) or is_coordinator_of(db, current_user.id, org_unit_id)):
        raise HTTPException(status_code=403, detail={"error": "forbidden", "message": "Not authorized to view pending members"})

    pending = db.query(OrgMembership).filter(OrgMembership.org_unit_id == org_unit_id, OrgMembership.status == MembershipStatus.PENDING).all()
    result = []
    for m in pending:
        email = m.user.identities[0].email if m.user.identities else None
        result.append(PendingMemberResponse(membership_id=m.id, user_id=m.user_id, user_email=email, requested_at=m.created_at))
    return result


@router.post("/{membership_id}/approve", response_model=MembershipResponse)
async def approve_membership(request: Request, membership_id: UUID, current_user: CurrentUser, db: DBSession) -> MembershipResponse:
    """Approve a membership request."""
    membership = db.query(OrgMembership).filter(OrgMembership.id == membership_id).first()
    if not membership:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Membership not found"})
    if membership.status != MembershipStatus.PENDING:
        raise HTTPException(status_code=400, detail={"error": "bad_request", "message": "Membership is not pending"})

    if not (has_global_role(db, current_user.id, ["DEV", "COUNCIL_GENERAL"]) or is_coordinator_of(db, current_user.id, membership.org_unit_id)):
        raise HTTPException(status_code=403, detail={"error": "forbidden", "message": "Not authorized to approve memberships"})

    membership.status = MembershipStatus.ACTIVE
    membership.approved_by_user_id = current_user.id
    membership.approved_at = datetime.now(timezone.utc)

    create_audit_log(db=db, actor_user_id=current_user.id, action="membership_approved", entity_type="org_membership", entity_id=str(membership.id), ip=request.client.host if request.client else None, user_agent=request.headers.get("user-agent"), metadata={"target_user_id": str(membership.user_id), "org_unit_id": str(membership.org_unit_id)})
    db.commit()
    db.refresh(membership)

    return MembershipResponse(id=membership.id, org_unit_id=membership.org_unit_id, org_unit_name=membership.org_unit.name, org_unit_type=membership.org_unit.type.value, role_code=membership.org_role.code, status=membership.status.value, created_at=membership.created_at)


@router.post("/{membership_id}/reject", response_model=MembershipResponse)
async def reject_membership(request: Request, membership_id: UUID, current_user: CurrentUser, db: DBSession) -> MembershipResponse:
    """Reject a membership request."""
    membership = db.query(OrgMembership).filter(OrgMembership.id == membership_id).first()
    if not membership:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Membership not found"})
    if membership.status != MembershipStatus.PENDING:
        raise HTTPException(status_code=400, detail={"error": "bad_request", "message": "Membership is not pending"})

    if not (has_global_role(db, current_user.id, ["DEV", "COUNCIL_GENERAL"]) or is_coordinator_of(db, current_user.id, membership.org_unit_id)):
        raise HTTPException(status_code=403, detail={"error": "forbidden", "message": "Not authorized to reject memberships"})

    membership.status = MembershipStatus.REJECTED
    membership.approved_by_user_id = current_user.id
    membership.approved_at = datetime.now(timezone.utc)

    create_audit_log(db=db, actor_user_id=current_user.id, action="membership_rejected", entity_type="org_membership", entity_id=str(membership.id), ip=request.client.host if request.client else None, user_agent=request.headers.get("user-agent"), metadata={"target_user_id": str(membership.user_id), "org_unit_id": str(membership.org_unit_id)})
    db.commit()
    db.refresh(membership)

    return MembershipResponse(id=membership.id, org_unit_id=membership.org_unit_id, org_unit_name=membership.org_unit.name, org_unit_type=membership.org_unit.type.value, role_code=membership.org_role.code, status=membership.status.value, created_at=membership.created_at)