"""
Auth Tests
==========
Testes de autenticação e endpoint /me.
"""

import pytest
from fastapi.testclient import TestClient


class TestAuth:
    """Testes de autenticação."""
    
    def test_me_without_auth_returns_401(self, client: TestClient):
        """Requisição sem auth deve retornar 401."""
        response = client.get("/me")
        assert response.status_code == 401
    
    def test_me_with_invalid_token_returns_401(self, client: TestClient):
        """Token inválido deve retornar 401."""
        response = client.get("/me", headers={"Authorization": "Bearer invalid"})
        assert response.status_code == 401
    
    def test_me_with_valid_auth_returns_200(self, client: TestClient, auth_headers: dict):
        """Auth válido deve retornar 200."""
        response = client.get("/me", headers=auth_headers)
        assert response.status_code == 200
    
    def test_me_returns_user_id(self, client: TestClient, auth_headers: dict):
        """Deve retornar user_id."""
        response = client.get("/me", headers=auth_headers)
        data = response.json()
        assert "user_id" in data
    
    def test_me_returns_identities(self, client: TestClient, auth_headers: dict):
        """Deve retornar identidades."""
        response = client.get("/me", headers=auth_headers)
        data = response.json()
        assert "identities" in data
        assert len(data["identities"]) > 0
    
    def test_me_returns_profile_status(self, client: TestClient, auth_headers: dict):
        """Deve retornar status do perfil."""
        response = client.get("/me", headers=auth_headers)
        data = response.json()
        assert "profile_status" in data
        assert data["profile_status"] == "INCOMPLETE"
    
    def test_me_returns_consents_status(self, client: TestClient, auth_headers: dict, seeded_db):
        """Deve retornar status de consentimentos."""
        response = client.get("/me", headers=auth_headers)
        data = response.json()
        assert "consents" in data
        assert data["consents"]["status"] == "pending"
