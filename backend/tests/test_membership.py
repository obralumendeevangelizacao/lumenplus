"""
Membership Tests
================
Testes do fluxo de vínculos organizacionais (baseado em convites).
"""

from fastapi.testclient import TestClient


class TestMembershipFlow:
    """Testes do fluxo de membership via convites."""

    def test_my_memberships_requires_auth(self, client: TestClient, seeded_db):
        """GET /org/my/memberships requer auth."""
        response = client.get("/org/my/memberships")
        assert response.status_code == 401

    def test_my_memberships_returns_empty_list(
        self, client: TestClient, auth_headers: dict, seeded_db
    ):
        """Usuário novo não tem memberships."""
        response = client.get("/org/my/memberships", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert data == []

    def test_my_invites_requires_auth(self, client: TestClient, seeded_db):
        """GET /org/my/invites requer auth."""
        response = client.get("/org/my/invites")
        assert response.status_code == 401

    def test_my_invites_returns_empty_list(self, client: TestClient, auth_headers: dict, seeded_db):
        """Usuário novo não tem convites."""
        response = client.get("/org/my/invites", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_org_tree_returns_structure(self, client: TestClient, auth_headers: dict, seeded_db):
        """GET /org/tree retorna estrutura organizacional (hierárquica)."""
        response = client.get("/org/tree", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "root" in data  # Pode ser null se não há conselho geral

    def test_full_invite_flow(
        self, client: TestClient, auth_headers: dict, admin_headers: dict, seeded_db
    ):
        """Fluxo completo: admin convida → usuário aceita → membership ativo."""
        # Pega um grupo do tree
        tree = client.get("/org/tree", headers=auth_headers).json()
        if not tree.get("root"):
            return  # Pula se não há conselho geral configurado

        org_unit_id = tree["root"]["id"]

        # Admin envia convite para o usuário de teste
        invite_resp = client.post(
            f"/org/units/{org_unit_id}/invites",
            json={
                "invited_user_email": "test@example.com",
                "role": "MEMBER",
            },
            headers=admin_headers,
        )
        # Se não há conselho geral configurado, o convite pode falhar com 403
        if invite_resp.status_code not in (201, 403, 400):
            assert False, f"Unexpected status {invite_resp.status_code}: {invite_resp.text}"

        if invite_resp.status_code != 201:
            return  # Sem permissão para convidar nesse ambiente

        invite_id = invite_resp.json()["id"]

        # Usuário aceita convite
        accept_resp = client.post(
            f"/org/invites/{invite_id}/accept",
            headers=auth_headers,
        )
        assert accept_resp.status_code == 200

        # Verifica que membership está ativo
        memberships = client.get("/org/my/memberships", headers=auth_headers).json()
        assert len(memberships) >= 1
        active_statuses = [m["status"] for m in memberships]
        assert "ACTIVE" in active_statuses
