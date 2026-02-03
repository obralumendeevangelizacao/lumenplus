"""
Profile Tests
=============
Testes de perfil com foco em segurança de dados sensíveis.

IMPORTANTE: Valida que CPF e RG NUNCA vazam em responses.
"""

import pytest
from fastapi.testclient import TestClient


class TestProfileCatalogs:
    """Testes de catálogos de perfil."""
    
    def test_catalogs_returns_200(self, client: TestClient, seeded_db):
        """Catálogos devem retornar 200."""
        response = client.get("/profile/catalogs")
        assert response.status_code == 200
    
    def test_catalogs_returns_three_catalogs(self, client: TestClient, seeded_db):
        """Deve retornar 3 catálogos."""
        response = client.get("/profile/catalogs")
        data = response.json()
        assert len(data) == 3
    
    def test_catalogs_contains_life_state(self, client: TestClient, seeded_db):
        """Deve conter catálogo LIFE_STATE."""
        response = client.get("/profile/catalogs")
        data = response.json()
        codes = [c["code"] for c in data]
        assert "LIFE_STATE" in codes


class TestProfileCRUD:
    """Testes de CRUD de perfil."""
    
    def test_get_profile_without_auth_returns_401(self, client: TestClient):
        """Perfil sem auth deve retornar 401."""
        response = client.get("/profile")
        assert response.status_code == 401
    
    def test_get_empty_profile_returns_incomplete(self, client: TestClient, auth_headers: dict):
        """Perfil vazio deve ter status INCOMPLETE."""
        response = client.get("/profile", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "INCOMPLETE"
    
    def test_update_profile_requires_auth(self, client: TestClient, sample_profile_data: dict):
        """Update de perfil requer auth."""
        response = client.put("/profile", json=sample_profile_data)
        assert response.status_code == 401


class TestProfileSensitiveDataProtection:
    """
    Testes de proteção de dados sensíveis.
    
    CRÍTICO: CPF e RG NUNCA devem aparecer em responses de profile.
    """
    
    def test_profile_response_never_contains_cpf(self, client: TestClient, auth_headers: dict, seeded_db):
        """CPF NUNCA deve aparecer na response de profile."""
        # Primeiro, pega os IDs dos catálogos
        catalogs = client.get("/profile/catalogs").json()
        life_state_id = catalogs[0]["items"][0]["id"]
        marital_id = catalogs[1]["items"][0]["id"]
        vocational_id = catalogs[2]["items"][0]["id"]
        
        profile_data = {
            "full_name": "Test User",
            "birth_date": "1990-01-01",
            "cpf": "123.456.789-00",
            "rg": "12.345.678-9",
            "phone_e164": "+5511999999999",
            "city": "São Paulo",
            "state": "SP",
            "life_state_item_id": life_state_id,
            "marital_status_item_id": marital_id,
            "vocational_reality_item_id": vocational_id,
        }
        
        # Cria perfil
        response = client.put("/profile", json=profile_data, headers=auth_headers)
        
        # Verifica que CPF não está na response
        response_text = response.text
        assert "123.456.789-00" not in response_text
        assert "12345678900" not in response_text
        assert "cpf_encrypted" not in response_text
    
    def test_profile_response_never_contains_rg(self, client: TestClient, auth_headers: dict, seeded_db):
        """RG NUNCA deve aparecer na response de profile."""
        catalogs = client.get("/profile/catalogs").json()
        
        profile_data = {
            "full_name": "Test User",
            "birth_date": "1990-01-01",
            "cpf": "123.456.789-00",
            "rg": "12.345.678-9",
            "phone_e164": "+5511988888888",
            "city": "São Paulo",
            "state": "SP",
            "life_state_item_id": catalogs[0]["items"][0]["id"],
            "marital_status_item_id": catalogs[1]["items"][0]["id"],
            "vocational_reality_item_id": catalogs[2]["items"][0]["id"],
        }
        
        response = client.put("/profile", json=profile_data, headers=auth_headers)
        
        response_text = response.text
        assert "12.345.678-9" not in response_text
        assert "rg_encrypted" not in response_text
    
    def test_profile_response_indicates_has_documents(self, client: TestClient, auth_headers: dict, seeded_db):
        """Profile deve indicar se tem documentos sem expô-los."""
        catalogs = client.get("/profile/catalogs").json()
        
        profile_data = {
            "full_name": "Test User",
            "birth_date": "1990-01-01",
            "cpf": "123.456.789-00",
            "rg": "12.345.678-9",
            "phone_e164": "+5511977777777",
            "city": "São Paulo",
            "state": "SP",
            "life_state_item_id": catalogs[0]["items"][0]["id"],
            "marital_status_item_id": catalogs[1]["items"][0]["id"],
            "vocational_reality_item_id": catalogs[2]["items"][0]["id"],
        }
        
        response = client.put("/profile", json=profile_data, headers=auth_headers)
        data = response.json()
        
        # Deve indicar que tem documentos
        assert data.get("has_documents") == True
        
        # Mas não deve conter os valores
        assert "cpf" not in data or data.get("cpf") is None
        assert "rg" not in data or data.get("rg") is None
