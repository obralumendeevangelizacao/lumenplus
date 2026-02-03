from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.db.models import MembershipStatus, OrgMembership, OrgUnit, OrgUnitType


def get_org_tree(db: Session) -> dict[str, list[dict[str, Any]]]:
    """
    Returns the organizational tree with sectors containing their ministries,
    and groups listed separately.
    """
    sectors = db.query(OrgUnit).filter(
        OrgUnit.type == OrgUnitType.SECTOR,
        OrgUnit.is_active == True,  # noqa: E712
    ).all()

    groups = db.query(OrgUnit).filter(
        OrgUnit.type == OrgUnitType.GROUP,
        OrgUnit.is_active == True,  # noqa: E712
    ).all()

    ministries = db.query(OrgUnit).filter(
        OrgUnit.type == OrgUnitType.MINISTRY,
        OrgUnit.is_active == True,  # noqa: E712
    ).all()

    ministry_by_parent: dict[UUID, list[OrgUnit]] = {}
    for m in ministries:
        if m.parent_id:
            ministry_by_parent.setdefault(m.parent_id, []).append(m)

    result_sectors = []
    for sector in sectors:
        sector_ministries = ministry_by_parent.get(sector.id, [])
        result_sectors.append({
            "id": sector.id,
            "name": sector.name,
            "slug": sector.slug,
            "ministries": [
                {"id": m.id, "name": m.name, "slug": m.slug}
                for m in sector_ministries
            ],
        })

    result_groups = [
        {"id": g.id, "name": g.name, "slug": g.slug}
        for g in groups
    ]

    return {
        "sectors": result_sectors,
        "groups": result_groups,
    }


def expand_org_units_for_user(db: Session, user_id: UUID) -> set[UUID]:
    """
    Returns a set of org_unit IDs that the user belongs to (directly via ACTIVE membership)
    PLUS all ancestor org_units (parent chain).

    This implements the inheritance rule:
    - If user is member of a MINISTRY, they also inherit visibility to its parent SECTOR.
    """
    active_memberships = db.query(OrgMembership).filter(
        OrgMembership.user_id == user_id,
        OrgMembership.status == MembershipStatus.ACTIVE,
    ).all()

    direct_ids = {m.org_unit_id for m in active_memberships}

    if not direct_ids:
        return set()

    org_units = db.query(OrgUnit).filter(OrgUnit.id.in_(direct_ids)).all()

    expanded: set[UUID] = set(direct_ids)

    for org_unit in org_units:
        current = org_unit
        while current.parent_id:
            expanded.add(current.parent_id)
            parent = db.query(OrgUnit).filter(OrgUnit.id == current.parent_id).first()
            if not parent:
                break
            current = parent

    return expanded


def get_ancestors(db: Session, org_unit_id: UUID) -> list[UUID]:
    """
    Returns a list of ancestor IDs for a given org_unit, from immediate parent to root.
    """
    ancestors: list[UUID] = []
    org_unit = db.query(OrgUnit).filter(OrgUnit.id == org_unit_id).first()

    if not org_unit:
        return ancestors

    current = org_unit
    while current.parent_id:
        ancestors.append(current.parent_id)
        parent = db.query(OrgUnit).filter(OrgUnit.id == current.parent_id).first()
        if not parent:
            break
        current = parent

    return ancestors
