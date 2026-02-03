from sqlalchemy.orm import Session

from app.db.models import MembershipStatus, OrgMembership, OrgRole, OrgUnit, OrgUnitType, User
from app.org.service import expand_org_units_for_user, get_ancestors, get_org_tree


def test_expand_org_units_empty_for_no_memberships(db: Session, test_user: User) -> None:
    result = expand_org_units_for_user(db, test_user.id)
    assert result == set()


def test_expand_org_units_includes_direct_membership(
    db: Session, user_with_membership: User, sample_org_structure: dict
) -> None:
    result = expand_org_units_for_user(db, user_with_membership.id)

    assert sample_org_structure["ministry"].id in result


def test_expand_org_units_includes_parent_sector(
    db: Session, user_with_membership: User, sample_org_structure: dict
) -> None:
    result = expand_org_units_for_user(db, user_with_membership.id)

    assert sample_org_structure["sector"].id in result
    assert sample_org_structure["ministry"].id in result


def test_expand_org_units_does_not_include_siblings(
    db: Session, user_with_membership: User, sample_org_structure: dict, member_role: OrgRole
) -> None:
    another_ministry = OrgUnit(
        type=OrgUnitType.MINISTRY,
        name="Another Ministry",
        slug="another-ministry-test",
        parent_id=sample_org_structure["sector"].id,
        is_active=True,
    )
    db.add(another_ministry)
    db.commit()

    result = expand_org_units_for_user(db, user_with_membership.id)

    assert another_ministry.id not in result


def test_get_ancestors_returns_parent_chain(db: Session, sample_org_structure: dict) -> None:
    ministry = sample_org_structure["ministry"]
    sector = sample_org_structure["sector"]

    ancestors = get_ancestors(db, ministry.id)

    assert sector.id in ancestors
    assert len(ancestors) == 1


def test_get_ancestors_returns_empty_for_root(db: Session, sample_org_structure: dict) -> None:
    sector = sample_org_structure["sector"]

    ancestors = get_ancestors(db, sector.id)

    assert ancestors == []


def test_get_org_tree_structure(db: Session, sample_org_structure: dict) -> None:
    tree = get_org_tree(db)

    assert "sectors" in tree
    assert "groups" in tree

    sector_ids = [s["id"] for s in tree["sectors"]]
    assert sample_org_structure["sector"].id in sector_ids

    group_ids = [g["id"] for g in tree["groups"]]
    assert sample_org_structure["group"].id in group_ids


def test_get_org_tree_ministries_nested_in_sectors(db: Session, sample_org_structure: dict) -> None:
    tree = get_org_tree(db)

    for sector in tree["sectors"]:
        if sector["id"] == sample_org_structure["sector"].id:
            ministry_ids = [m["id"] for m in sector["ministries"]]
            assert sample_org_structure["ministry"].id in ministry_ids
            break
    else:
        raise AssertionError("Sector not found in tree")
