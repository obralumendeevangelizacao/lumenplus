from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.models import User, UserIdentity


def test_me_unauthorized(client: TestClient) -> None:
    response = client.get("/me")
    assert response.status_code == 401


def test_me_invalid_auth_format(client: TestClient) -> None:
    response = client.get("/me", headers={"Authorization": "InvalidFormat"})
    assert response.status_code == 401


def test_me_dev_token_provisions_new_user(client: TestClient, db: Session) -> None:
    response = client.get(
        "/me",
        headers={"Authorization": "Bearer dev:new-user-123:newuser@example.com"},
    )

    assert response.status_code == 200

    data = response.json()
    assert "user_id" in data
    assert data["is_active"] is True
    assert len(data["identities"]) == 1
    assert data["identities"][0]["provider"] == "firebase"
    assert data["identities"][0]["provider_uid"] == "new-user-123"
    assert data["identities"][0]["email"] == "newuser@example.com"


def test_me_returns_existing_user(client: TestClient, test_user: User) -> None:
    identity = test_user.identities[0]

    response = client.get(
        "/me",
        headers={"Authorization": f"Bearer dev:{identity.provider_uid}:{identity.email}"},
    )

    assert response.status_code == 200

    data = response.json()
    assert data["user_id"] == str(test_user.id)


def test_me_with_memberships(
    client: TestClient,
    user_with_membership: User,
    sample_org_structure: dict,
) -> None:
    identity = user_with_membership.identities[0]

    response = client.get(
        "/me",
        headers={"Authorization": f"Bearer dev:{identity.provider_uid}:{identity.email}"},
    )

    assert response.status_code == 200

    data = response.json()
    assert len(data["memberships"]) == 1
    assert data["memberships"][0]["status"] == "ACTIVE"
    assert data["memberships"][0]["org_unit_type"] == "MINISTRY"

    direct_ids = data["org_units"]["direct_ids"]
    expanded_ids = data["org_units"]["expanded_ids"]

    assert str(sample_org_structure["ministry"].id) in direct_ids
    assert str(sample_org_structure["sector"].id) in expanded_ids
    assert str(sample_org_structure["ministry"].id) in expanded_ids
