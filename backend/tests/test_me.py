"""
/auth/me Endpoint Tests
=======================
Testes do endpoint GET /auth/me.
"""

from fastapi.testclient import TestClient


def test_me_unauthorized(client: TestClient) -> None:
    response = client.get("/auth/me")
    assert response.status_code == 401


def test_me_invalid_auth_format(client: TestClient) -> None:
    response = client.get("/auth/me", headers={"Authorization": "InvalidFormat"})
    assert response.status_code == 401


def test_me_dev_token_provisions_new_user(client: TestClient) -> None:
    response = client.get(
        "/auth/me",
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


def test_me_returns_existing_user(client: TestClient) -> None:
    """Segunda chamada com mesmo token retorna o mesmo usuário provisionado."""
    token = "Bearer dev:existing-user-456:existing@example.com"

    r1 = client.get("/auth/me", headers={"Authorization": token})
    assert r1.status_code == 200
    user_id = r1.json()["user_id"]

    r2 = client.get("/auth/me", headers={"Authorization": token})
    assert r2.status_code == 200
    assert r2.json()["user_id"] == user_id


def test_me_with_memberships(client: TestClient, seeded_db) -> None:
    """Usuário com membership ativo deve ver membership na response."""
    response = client.get(
        "/auth/me",
        headers={"Authorization": "Bearer dev:test-user:test@example.com"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "memberships" in data
