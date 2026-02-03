"""
Membership Tests
================
Testes de fluxo de vínculos organizacionais.
"""

import pytest
from fastapi.testclient import TestClient


class TestMembershipFlow:
    """Testes do fluxo completo de membership."""
    
    def test_request_membership_requires_auth(self, client: TestClient, seeded_db):
        """Request de membership requer auth."""
        response = client.post("/org-memberships/request", json={
            "org_unit_id": "00000000-0000-0000-0000-000000000000"
        })
        assert response.status_code == 401
    
    def test_request_membership_to_invalid_org_returns_404(self, client: TestClient, auth_headers: dict, seeded_db):
        """Request para org inválida retorna 404."""
        response = client.post("/org-memberships/request", json={
            "org_unit_id": "00000000-0000-0000-0000-000000000000"
        }, headers=auth_headers)
        assert response.status_code == 404
    
    def test_my_memberships_returns_empty_list(self, client: TestClient, auth_headers: dict, seeded_db):
        """Usuário novo não tem memberships."""
        response = client.get("/org-memberships/my", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data == []
    
    def test_full_membership_flow(self, client: TestClient, auth_headers: dict, admin_headers: dict, seeded_db):
        """Fluxo completo: request -> approve."""
        # Pega um org_unit do tree
        tree = client.get("/org-units/tree").json()
        org_unit_id = tree["groups"][0]["id"]
        
        # 1. Request membership
        response = client.post("/org-memberships/request", json={
            "org_unit_id": org_unit_id
        }, headers=auth_headers)
        assert response.status_code == 201
        membership = response.json()
        assert membership["status"] == "PENDING"
        membership_id = membership["id"]
        
        # 2. Verifica que está em my memberships
        response = client.get("/org-memberships/my", headers=auth_headers)
        data = response.json()
        assert len(data) == 1
        assert data[0]["status"] == "PENDING"
        
        # 3. Admin aprova
        response = client.post(f"/org-memberships/{membership_id}/approve", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ACTIVE"
        
        # 4. Verifica status atualizado
        response = client.get("/org-memberships/my", headers=auth_headers)
        data = response.json()
        assert data[0]["status"] == "ACTIVE"
    
    def test_reject_membership_flow(self, client: TestClient, auth_headers: dict, admin_headers: dict, seeded_db):
        """Fluxo de rejeição."""
        tree = client.get("/org-units/tree").json()
        org_unit_id = tree["groups"][1]["id"] if len(tree["groups"]) > 1 else tree["groups"][0]["id"]
        
        # Request
        response = client.post("/org-memberships/request", json={
            "org_unit_id": org_unit_id
        }, headers=auth_headers)
        membership_id = response.json()["id"]
        
        # Reject
        response = client.post(f"/org-memberships/{membership_id}/reject", headers=admin_headers)
        assert response.status_code == 200
        assert response.json()["status"] == "REJECTED"
    
    def test_duplicate_request_returns_409(self, client: TestClient, auth_headers: dict, seeded_db):
        """Request duplicado retorna 409."""
        tree = client.get("/org-units/tree").json()
        org_unit_id = tree["sectors"][0]["id"]
        
        # Primeiro request
        response1 = client.post("/org-memberships/request", json={
            "org_unit_id": org_unit_id
        }, headers=auth_headers)
        assert response1.status_code == 201
        
        # Segundo request (duplicado)
        response2 = client.post("/org-memberships/request", json={
            "org_unit_id": org_unit_id
        }, headers=auth_headers)
        assert response2.status_code == 409
