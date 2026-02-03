from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter
from pydantic import BaseModel

from app.api.deps import CurrentUser, DBSession
from app.db.models import MembershipStatus, OrgMembership, OrgUnitType
from app.org.service import expand_org_units_for_user, get_org_tree
from app.schemas.responses import ErrorResponse

router = APIRouter()


class HealthResponse(BaseModel):
    status: str
    timestamp: str


@router.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check() -> HealthResponse:
    return HealthResponse(
        status="healthy",
        timestamp=datetime.now(timezone.utc).isoformat(),
    )


class IdentityInfo(BaseModel):
    provider: str
    provider_uid: str
    email: str | None


class MembershipInfo(BaseModel):
    org_unit_id: UUID
    org_unit_name: str
    org_unit_type: str
    role_code: str
    status: str


class OrgUnitsInfo(BaseModel):
    direct_ids: list[UUID]
    expanded_ids: list[UUID]


class MeResponse(BaseModel):
    user_id: UUID
    is_active: bool
    identities: list[IdentityInfo]
    org_units: OrgUnitsInfo
    memberships: list[MembershipInfo]


@router.get(
    "/me",
    response_model=MeResponse,
    responses={401: {"model": ErrorResponse}, 403: {"model": ErrorResponse}},
    tags=["User"],
)
async def get_me(current_user: CurrentUser, db: DBSession) -> MeResponse:
    identities = [
        IdentityInfo(
            provider=i.provider,
            provider_uid=i.provider_uid,
            email=i.email,
        )
        for i in current_user.identities
    ]

    active_memberships = (
        db.query(OrgMembership)
        .filter(
            OrgMembership.user_id == current_user.id,
            OrgMembership.status == MembershipStatus.ACTIVE,
        )
        .all()
    )

    direct_ids = [m.org_unit_id for m in active_memberships]
    expanded_ids = expand_org_units_for_user(db, current_user.id)

    memberships = [
        MembershipInfo(
            org_unit_id=m.org_unit_id,
            org_unit_name=m.org_unit.name,
            org_unit_type=m.org_unit.type.value,
            role_code=m.org_role.code,
            status=m.status.value,
        )
        for m in active_memberships
    ]

    return MeResponse(
        user_id=current_user.id,
        is_active=current_user.is_active,
        identities=identities,
        org_units=OrgUnitsInfo(
            direct_ids=direct_ids,
            expanded_ids=list(expanded_ids),
        ),
        memberships=memberships,
    )


class MinistryItem(BaseModel):
    id: UUID
    name: str
    slug: str


class SectorItem(BaseModel):
    id: UUID
    name: str
    slug: str
    ministries: list[MinistryItem]


class GroupItem(BaseModel):
    id: UUID
    name: str
    slug: str


class OrgTreeResponse(BaseModel):
    sectors: list[SectorItem]
    groups: list[GroupItem]


@router.get("/org-units/tree", response_model=OrgTreeResponse, tags=["Organization"])
async def get_org_units_tree(db: DBSession) -> OrgTreeResponse:
    tree = get_org_tree(db)

    sectors = [
        SectorItem(
            id=s["id"],
            name=s["name"],
            slug=s["slug"],
            ministries=[
                MinistryItem(id=m["id"], name=m["name"], slug=m["slug"]) for m in s["ministries"]
            ],
        )
        for s in tree["sectors"]
    ]

    groups = [GroupItem(id=g["id"], name=g["name"], slug=g["slug"]) for g in tree["groups"]]

    return OrgTreeResponse(sectors=sectors, groups=groups)
