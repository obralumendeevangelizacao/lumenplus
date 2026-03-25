"""
Org Expand Unit Tests
=====================
Testes das funções de expansão hierárquica da organização.
"""

import uuid

import pytest
from sqlalchemy.orm import Session

from app.db.models import (
    MembershipStatus,
    OrgMembership,
    OrgRoleCode,
    OrgUnit,
    OrgUnitType,
    User,
)
from app.org.service import expand_org_units_for_user, get_ancestors, get_org_tree


# =============================================================================
# LOCAL FIXTURES
# =============================================================================


@pytest.fixture
def test_user(db_session: Session) -> User:
    """Cria usuário mínimo para testes."""
    user = User(id=uuid.uuid4(), is_active=True)
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def sample_org_structure(db_session: Session) -> dict:
    """Cria estrutura org: sector -> ministry, + group."""
    sector = OrgUnit(
        type=OrgUnitType.SETOR,
        name="Test Sector",
        slug=f"test-sector-{uuid.uuid4().hex[:6]}",
        is_active=True,
    )
    db_session.add(sector)
    db_session.flush()

    ministry = OrgUnit(
        type=OrgUnitType.MINISTERIO,
        name="Test Ministry",
        slug=f"test-ministry-{uuid.uuid4().hex[:6]}",
        parent_id=sector.id,
        is_active=True,
    )
    group = OrgUnit(
        type=OrgUnitType.GRUPO,
        name="Test Group",
        slug=f"test-group-{uuid.uuid4().hex[:6]}",
        is_active=True,
    )
    db_session.add_all([ministry, group])
    db_session.commit()
    db_session.refresh(sector)
    db_session.refresh(ministry)
    db_session.refresh(group)

    return {"sector": sector, "ministry": ministry, "group": group}


@pytest.fixture
def user_with_membership(db_session: Session, test_user: User, sample_org_structure: dict) -> User:
    """Usuário com membership ativo no ministry."""
    membership = OrgMembership(
        user_id=test_user.id,
        org_unit_id=sample_org_structure["ministry"].id,
        role=OrgRoleCode.MEMBER,
        status=MembershipStatus.ACTIVE,
    )
    db_session.add(membership)
    db_session.commit()
    return test_user


# =============================================================================
# TESTS
# =============================================================================


def test_expand_org_units_empty_for_no_memberships(db_session: Session, test_user: User) -> None:
    result = expand_org_units_for_user(db_session, test_user.id)
    assert result == set()


def test_expand_org_units_includes_direct_membership(
    db_session: Session, user_with_membership: User, sample_org_structure: dict
) -> None:
    result = expand_org_units_for_user(db_session, user_with_membership.id)

    assert sample_org_structure["ministry"].id in result


def test_expand_org_units_includes_parent_sector(
    db_session: Session, user_with_membership: User, sample_org_structure: dict
) -> None:
    result = expand_org_units_for_user(db_session, user_with_membership.id)

    assert sample_org_structure["sector"].id in result
    assert sample_org_structure["ministry"].id in result


def test_expand_org_units_does_not_include_siblings(
    db_session: Session, user_with_membership: User, sample_org_structure: dict
) -> None:
    another_ministry = OrgUnit(
        type=OrgUnitType.MINISTERIO,
        name="Another Ministry",
        slug=f"another-ministry-{uuid.uuid4().hex[:6]}",
        parent_id=sample_org_structure["sector"].id,
        is_active=True,
    )
    db_session.add(another_ministry)
    db_session.commit()

    result = expand_org_units_for_user(db_session, user_with_membership.id)

    assert another_ministry.id not in result


def test_get_ancestors_returns_parent_chain(
    db_session: Session, sample_org_structure: dict
) -> None:
    ministry = sample_org_structure["ministry"]
    sector = sample_org_structure["sector"]

    ancestors = get_ancestors(db_session, ministry.id)

    assert sector.id in ancestors
    assert len(ancestors) == 1


def test_get_ancestors_returns_empty_for_root(
    db_session: Session, sample_org_structure: dict
) -> None:
    sector = sample_org_structure["sector"]

    ancestors = get_ancestors(db_session, sector.id)

    assert ancestors == []


def test_get_org_tree_structure(db_session: Session, sample_org_structure: dict) -> None:
    tree = get_org_tree(db_session)

    assert "sectors" in tree
    assert "groups" in tree

    sector_ids = [s["id"] for s in tree["sectors"]]
    assert sample_org_structure["sector"].id in sector_ids

    group_ids = [g["id"] for g in tree["groups"]]
    assert sample_org_structure["group"].id in group_ids


def test_get_org_tree_ministries_nested_in_sectors(
    db_session: Session, sample_org_structure: dict
) -> None:
    tree = get_org_tree(db_session)

    for sector in tree["sectors"]:
        if sector["id"] == sample_org_structure["sector"].id:
            ministry_ids = [m["id"] for m in sector["ministries"]]
            assert sample_org_structure["ministry"].id in ministry_ids
            break
    else:
        raise AssertionError("Sector not found in tree")
