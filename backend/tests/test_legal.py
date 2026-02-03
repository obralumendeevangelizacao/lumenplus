"""
Legal Tests
===========
Testes de termos, privacidade e consentimentos.
"""

import pytest
from fastapi.testclient import TestClient


class TestLegalDocuments:
    """Testes de documentos legais."""
    
    def test_latest_returns_200(self, client: TestClient, seeded_db):
        """Latest legal deve retornar 200."""
        response = client.get("/legal/latest")
        assert response.status_code == 200
    
    def test_latest_returns_terms(self, client: TestClient, seeded_db):
        """Deve retornar termos."""
        response = client.get("/legal/latest")
        data = response.json()
        assert data["terms"] is not None
        assert data["terms"]["type"] == "TERMS"
        assert data["terms"]["version"] == "1.0"
    
    def test_latest_returns_privacy(self, client: TestClient, seeded_db):
        """Deve retornar privacidade."""
        response = client.get("/legal/latest")
        data = response.json()
        assert data["privacy"] is not None
        assert data["privacy"]["type"] == "PRIVACY"


class TestLegalConsent:
    """Testes de consentimento."""
    
    def test_accept_requires_auth(self, client: TestClient, seeded_db):
        """Accept requer autenticação."""
        response = client.post("/legal/accept", json={
            "terms_version": "1.0",
            "privacy_version": "1.0",
        })
        assert response.status_code == 401
    
    def test_accept_with_valid_versions(self, client: TestClient, auth_headers: dict, seeded_db):
        """Accept com versões válidas deve funcionar."""
        response = client.post("/legal/accept", json={
            "terms_version": "1.0",
            "privacy_version": "1.0",
        }, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["terms_accepted"] == True
        assert data["privacy_accepted"] == True
    
    def test_accept_idempotent(self, client: TestClient, auth_headers: dict, seeded_db):
        """Accept deve ser idempotente."""
        # Primeiro accept
        response1 = client.post("/legal/accept", json={
            "terms_version": "1.0",
            "privacy_version": "1.0",
        }, headers=auth_headers)
        assert response1.status_code == 200
        
        # Segundo accept (mesmo usuário, mesma versão)
        response2 = client.post("/legal/accept", json={
            "terms_version": "1.0",
            "privacy_version": "1.0",
        }, headers=auth_headers)
        assert response2.status_code == 200
        data = response2.json()
        # Já estava aceito
        assert data["terms_accepted"] == False
        assert data["privacy_accepted"] == False
    
    def test_accept_with_invalid_version_returns_400(self, client: TestClient, auth_headers: dict, seeded_db):
        """Versão inválida deve retornar 400."""
        response = client.post("/legal/accept", json={
            "terms_version": "99.0",
            "privacy_version": "1.0",
        }, headers=auth_headers)
        assert response.status_code == 400
