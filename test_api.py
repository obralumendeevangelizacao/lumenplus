#!/usr/bin/env python3
"""
Lumen+ Backend Test Suite
=========================
Testes completos via API HTTP.
Execute com: python test_api.py
"""

import sys
import json
import time
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

BASE_URL = "http://localhost:8000"

# Contadores
tests_passed = 0
tests_failed = 0
tests_total = 0


def make_request(method, path, headers=None, data=None):
    """Faz requisição HTTP."""
    url = f"{BASE_URL}{path}"
    headers = headers or {}
    headers["Content-Type"] = "application/json"
    
    body = json.dumps(data).encode() if data else None
    req = Request(url, data=body, headers=headers, method=method)
    
    try:
        with urlopen(req, timeout=10) as response:
            return response.status, json.loads(response.read().decode())
    except HTTPError as e:
        try:
            body = json.loads(e.read().decode())
        except:
            body = {"error": str(e)}
        return e.code, body
    except URLError as e:
        return 0, {"error": str(e)}


def test(name, condition, details=""):
    """Registra resultado de teste."""
    global tests_passed, tests_failed, tests_total
    tests_total += 1
    
    if condition:
        tests_passed += 1
        print(f"  ✅ {name}")
    else:
        tests_failed += 1
        print(f"  ❌ {name}")
        if details:
            print(f"     → {details}")


def auth_header(user="test", email="test@example.com"):
    """Gera header de autenticação DEV."""
    return {"Authorization": f"Bearer dev:{user}:{email}"}


# =============================================================================
# TESTES
# =============================================================================

def test_health():
    """Testa endpoint de health."""
    print("\n📋 HEALTH")
    
    status, data = make_request("GET", "/health")
    test("GET /health retorna 200", status == 200, f"status={status}")
    test("Status é 'healthy'", data.get("status") == "healthy", f"status={data.get('status')}")
    test("Versão está presente", "version" in data)
    test("Timestamp está presente", "timestamp" in data)


def test_auth():
    """Testa autenticação."""
    print("\n🔐 AUTENTICAÇÃO")
    
    # Sem auth
    status, _ = make_request("GET", "/me")
    test("GET /me sem auth retorna 401", status == 401, f"status={status}")
    
    # Com auth válido
    status, data = make_request("GET", "/me", auth_header())
    test("GET /me com auth retorna 200", status == 200, f"status={status}")
    test("Retorna user_id", "user_id" in data)
    test("Retorna identities", "identities" in data)
    test("Retorna profile_status", data.get("profile_status") == "INCOMPLETE")
    test("Retorna consents", "consents" in data)
    test("Retorna global_roles", "global_roles" in data)


def test_catalogs():
    """Testa catálogos de perfil."""
    print("\n📚 CATÁLOGOS")
    
    status, data = make_request("GET", "/profile/catalogs")
    test("GET /profile/catalogs retorna 200", status == 200, f"status={status}")
    test("Retorna 3 catálogos", len(data) == 3, f"count={len(data)}")
    
    codes = [c["code"] for c in data]
    test("Contém LIFE_STATE", "LIFE_STATE" in codes)
    test("Contém MARITAL_STATUS", "MARITAL_STATUS" in codes)
    test("Contém VOCATIONAL_REALITY", "VOCATIONAL_REALITY" in codes)
    
    # Verifica itens
    for catalog in data:
        has_items = len(catalog.get("items", [])) > 0
        test(f"Catálogo {catalog['code']} tem itens", has_items)


def test_legal():
    """Testa documentos legais."""
    print("\n📜 LEGAL")
    
    status, data = make_request("GET", "/legal/latest")
    test("GET /legal/latest retorna 200", status == 200, f"status={status}")
    test("Retorna terms", data.get("terms") is not None)
    test("Retorna privacy", data.get("privacy") is not None)
    test("Terms versão 1.0", data.get("terms", {}).get("version") == "1.0")
    test("Privacy versão 1.0", data.get("privacy", {}).get("version") == "1.0")


def test_legal_accept():
    """Testa aceitação de termos."""
    print("\n✍️ CONSENTIMENTO")
    
    # Gera usuário único para este teste
    import time
    unique_user = f"consent_{int(time.time())}"
    
    # Sem auth
    status, _ = make_request("POST", "/legal/accept", data={
        "terms_version": "1.0",
        "privacy_version": "1.0"
    })
    test("POST /legal/accept sem auth retorna 401", status == 401)
    
    # Com auth (usuário novo)
    status, data = make_request("POST", "/legal/accept", auth_header(unique_user, f"{unique_user}@test.com"), {
        "terms_version": "1.0",
        "privacy_version": "1.0"
    })
    test("POST /legal/accept com auth retorna 200", status == 200, f"status={status}")
    test("Terms aceito (primeiro accept)", data.get("terms_accepted") == True)
    test("Privacy aceito (primeiro accept)", data.get("privacy_accepted") == True)
    
    # Idempotente (segundo accept, mesmo usuário)
    status, data = make_request("POST", "/legal/accept", auth_header(unique_user, f"{unique_user}@test.com"), {
        "terms_version": "1.0",
        "privacy_version": "1.0"
    })
    test("Accept idempotente retorna 200", status == 200)
    test("Terms já aceito (false)", data.get("terms_accepted") == False)


def test_org_tree():
    """Testa árvore organizacional."""
    print("\n🏢 ORGANIZAÇÃO")
    
    status, data = make_request("GET", "/org-units/tree")
    test("GET /org-units/tree retorna 200", status == 200, f"status={status}")
    test("Retorna sectors", "sectors" in data)
    test("Retorna groups", "groups" in data)
    test("Tem setores", len(data.get("sectors", [])) > 0)
    test("Tem grupos", len(data.get("groups", [])) > 0)
    
    # Verifica estrutura de setor
    if data.get("sectors"):
        sector = data["sectors"][0]
        test("Setor tem id", "id" in sector)
        test("Setor tem name", "name" in sector)
        test("Setor tem ministries", "ministries" in sector)


def test_profile():
    """Testa perfil."""
    print("\n👤 PERFIL")
    
    # Sem auth
    status, _ = make_request("GET", "/profile")
    test("GET /profile sem auth retorna 401", status == 401)
    
    # Com auth (perfil vazio)
    status, data = make_request("GET", "/profile", auth_header("profile_user", "profile@test.com"))
    test("GET /profile retorna 200", status == 200, f"status={status}")
    test("Status INCOMPLETE para perfil vazio", data.get("status") == "INCOMPLETE")
    test("has_documents é False", data.get("has_documents") == False)
    
    # Resposta NÃO contém CPF
    response_str = json.dumps(data)
    test("Resposta não contém 'cpf_encrypted'", "cpf_encrypted" not in response_str)
    test("Resposta não contém 'rg_encrypted'", "rg_encrypted" not in response_str)


def test_profile_update():
    """Testa atualização de perfil."""
    print("\n📝 ATUALIZAÇÃO DE PERFIL")
    
    # Primeiro, pega IDs dos catálogos
    _, catalogs = make_request("GET", "/profile/catalogs")
    
    life_state_id = catalogs[0]["items"][0]["id"]
    marital_id = catalogs[1]["items"][0]["id"]
    vocational_id = catalogs[2]["items"][0]["id"]
    
    profile_data = {
        "full_name": "Teste da Silva",
        "birth_date": "1990-05-15",
        "cpf": "123.456.789-00",
        "rg": "12.345.678-9",
        "phone_e164": "+5511999887766",
        "city": "São Paulo",
        "state": "SP",
        "life_state_item_id": life_state_id,
        "marital_status_item_id": marital_id,
        "vocational_reality_item_id": vocational_id,
    }
    
    status, data = make_request("PUT", "/profile", auth_header("update_user", "update@test.com"), profile_data)
    test("PUT /profile retorna 200", status == 200, f"status={status}, data={data}")
    
    if status == 200:
        test("Nome salvo corretamente", data.get("full_name") == "Teste da Silva")
        test("Status é PENDING_VERIFICATION", data.get("status") == "PENDING_VERIFICATION")
        test("has_documents é True", data.get("has_documents") == True)
        
        # CRÍTICO: CPF e RG não vazam
        response_str = json.dumps(data)
        test("CPF não aparece na resposta", "123.456.789-00" not in response_str)
        test("RG não aparece na resposta", "12.345.678-9" not in response_str)
        test("CPF digits não aparecem", "12345678900" not in response_str)


def test_membership_flow():
    """Testa fluxo de membership."""
    print("\n🤝 MEMBERSHIP")
    
    import time
    unique_id = int(time.time())
    
    # Pega um org_unit
    _, tree = make_request("GET", "/org-units/tree")
    org_unit_id = tree["groups"][0]["id"]
    
    user_headers = auth_header(f"member_{unique_id}", f"member_{unique_id}@test.com")
    admin_headers = auth_header("admin", "admin@example.com")
    
    # IMPORTANTE: Atribuir role DEV ao admin antes de aprovar
    _, admin_me = make_request("GET", "/me", admin_headers)
    make_request("POST", "/dev/assign-global-role", admin_headers, {
        "user_id": admin_me["user_id"],
        "role_code": "DEV"
    })
    
    # Sem auth
    status, _ = make_request("POST", "/org-memberships/request", data={"org_unit_id": org_unit_id})
    test("Request sem auth retorna 401", status == 401)
    
    # Request membership (usuário único)
    status, data = make_request("POST", "/org-memberships/request", user_headers, {"org_unit_id": org_unit_id})
    test("POST /org-memberships/request retorna 201", status == 201, f"status={status}")
    
    if status == 201:
        membership_id = data["id"]
        test("Status é PENDING", data.get("status") == "PENDING")
        
        # Verifica em /my
        status, my_data = make_request("GET", "/org-memberships/my", user_headers)
        test("GET /org-memberships/my retorna 200", status == 200)
        test("Membership aparece em /my", len(my_data) > 0)
        
        # Admin aprova
        status, approved = make_request("POST", f"/org-memberships/{membership_id}/approve", admin_headers)
        test("Admin pode aprovar", status == 200, f"status={status}")
        test("Status muda para ACTIVE", approved.get("status") == "ACTIVE")
        
        # Request duplicado (mesmo usuário, mesma org)
        status, _ = make_request("POST", "/org-memberships/request", user_headers, {"org_unit_id": org_unit_id})
        test("Request duplicado retorna 409", status == 409)
    else:
        # Se falhou, pula testes dependentes
        test("Status é PENDING", False, "Skipped - request failed")
        test("GET /org-memberships/my retorna 200", False, "Skipped")
        test("Membership aparece em /my", False, "Skipped")
        test("Admin pode aprovar", False, "Skipped")
        test("Status muda para ACTIVE", False, "Skipped")
        test("Request duplicado retorna 409", False, "Skipped")


def test_sensitive_access_denied():
    """Testa negação de acesso a dados sensíveis."""
    print("\n🔒 ACESSO SENSÍVEL")
    
    import time
    unique_id = int(time.time())
    user_headers = auth_header(f"normal_{unique_id}", f"normal_{unique_id}@test.com")
    
    # Usuário comum não pode ver documentos
    status, _ = make_request("GET", "/admin/users/00000000-0000-0000-0000-000000000000/documents", user_headers)
    test("Usuário comum não acessa documentos (403)", status == 403, f"status={status}")
    
    # Usuário comum não pode solicitar acesso (precisa ser SECRETARY ou DEV)
    status, data = make_request("POST", "/admin/sensitive-access/request", user_headers, {
        "target_user_id": "00000000-0000-0000-0000-000000000000",
        "reason": "Teste de acesso não autorizado"
    })
    test("Usuário comum não pode solicitar acesso (403)", status == 403, f"status={status}")
    
    # Usuário comum não pode ver pendências
    status, _ = make_request("GET", "/admin/sensitive-access/pending", user_headers)
    test("Usuário comum não vê pendências (403)", status == 403, f"status={status}")


def test_dev_endpoints():
    """Testa endpoints de desenvolvimento."""
    print("\n🛠️ DEV ENDPOINTS")
    
    admin_headers = auth_header("admin", "admin@example.com")
    
    # Assign global role
    _, me_data = make_request("GET", "/me", admin_headers)
    user_id = me_data["user_id"]
    
    status, data = make_request("POST", "/dev/assign-global-role", admin_headers, {
        "user_id": user_id,
        "role_code": "DEV"
    })
    test("POST /dev/assign-global-role funciona", status == 200, f"status={status}")
    
    # Verifica que role foi atribuído
    _, me_after = make_request("GET", "/me", admin_headers)
    test("Role DEV aparece em global_roles", "DEV" in me_after.get("global_roles", []))


def test_emergency_contact():
    """Testa contato de emergência."""
    print("\n🆘 CONTATO DE EMERGÊNCIA")
    
    user_headers = auth_header("emergency_user", "emergency@test.com")
    
    # Precisa criar perfil primeiro
    _, catalogs = make_request("GET", "/profile/catalogs")
    profile_data = {
        "full_name": "Emergency Test",
        "birth_date": "1985-01-01",
        "cpf": "111.222.333-44",
        "rg": "11.222.333-4",
        "phone_e164": "+5511888777666",
        "city": "Rio",
        "state": "RJ",
        "life_state_item_id": catalogs[0]["items"][0]["id"],
        "marital_status_item_id": catalogs[1]["items"][0]["id"],
        "vocational_reality_item_id": catalogs[2]["items"][0]["id"],
    }
    make_request("PUT", "/profile", user_headers, profile_data)
    
    # Adiciona contato de emergência
    contact_data = {
        "name": "Maria da Silva",
        "phone_e164": "+5511999888777",
        "relationship": "Mãe"
    }
    status, data = make_request("POST", "/profile/emergency-contact", user_headers, contact_data)
    test("POST /profile/emergency-contact retorna 201", status == 201, f"status={status}")
    
    if status == 201:
        test("Nome do contato salvo", data.get("name") == "Maria da Silva")
        test("Relacionamento salvo", data.get("relationship") == "Mãe")


# =============================================================================
# MAIN
# =============================================================================

def main():
    print("=" * 60)
    print("🧪 LUMEN+ BACKEND - SUITE DE TESTES")
    print("=" * 60)
    
    # Verifica se servidor está rodando
    try:
        status, _ = make_request("GET", "/health")
        if status != 200:
            print(f"\n❌ Servidor não está respondendo corretamente (status={status})")
            print("   Execute: docker compose up -d")
            sys.exit(1)
    except Exception as e:
        print(f"\n❌ Não foi possível conectar ao servidor: {e}")
        print("   Execute: docker compose up -d")
        sys.exit(1)
    
    # Executa testes
    test_health()
    test_auth()
    test_catalogs()
    test_legal()
    test_legal_accept()
    test_org_tree()
    test_profile()
    test_profile_update()
    test_membership_flow()
    test_sensitive_access_denied()
    test_dev_endpoints()
    test_emergency_contact()
    
    # Resultado
    print("\n" + "=" * 60)
    print(f"📊 RESULTADO: {tests_passed}/{tests_total} testes passaram")
    print("=" * 60)
    
    if tests_failed > 0:
        print(f"\n⚠️  {tests_failed} teste(s) falharam")
        sys.exit(1)
    else:
        print("\n🎉 TODOS OS TESTES PASSARAM!")
        sys.exit(0)


if __name__ == "__main__":
    main()