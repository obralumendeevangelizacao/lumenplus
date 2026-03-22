# Lumen+ Backend

API RESTful do Lumen+ construída com Python 3.12 e FastAPI.

---

## Sumário

- [Início Rápido](#início-rápido)
- [Estrutura](#estrutura)
- [Autenticação](#autenticação)
- [Módulos](#módulos)
- [Segurança](#segurança)
- [Configuração](#configuração)
- [Testes](#testes)
- [Migrações](#migrações)

---

## Início Rápido

```bash
# Subir banco e Redis
docker compose up -d

# Ambiente virtual
python -m venv .venv
source .venv/bin/activate   # Linux/macOS
.venv\Scripts\activate      # Windows

# Dependências
pip install -e ".[dev]"

# Migrações
alembic upgrade head

# Servidor
uvicorn app.main:app --reload
# Swagger: http://localhost:8000/docs
```

### Setup inicial (uma vez, em DEV)

```bash
POST /dev/seed                    # Cria roles e documentos legais
POST /dev/assign-global-role      # Atribui papel DEV ao primeiro usuário
POST /org/units  (type=CONSELHO_GERAL)  # Cria raiz da hierarquia
```

---

## Estrutura

```
backend/app/
├── api/
│   ├── routes/
│   │   ├── auth.py               # /auth/*
│   │   ├── organization.py       # /org/*
│   │   ├── admin.py              # /admin/* (usuários, papéis)
│   │   └── dev.py                # /dev/* (apenas desenvolvimento)
│   ├── profile_routes.py         # /profile/*
│   ├── inbox_routes.py           # /inbox/*
│   ├── legal_routes.py           # /legal/*
│   ├── verification_routes.py    # /verify/*
│   ├── retreat_routes.py         # /retreats/*
│   ├── admin_routes.py           # /admin/* (usuários sensíveis)
│   ├── admin_retreat_routes.py   # /admin/retreats/*
│   └── deps.py                   # CurrentUser, DBSession
├── audit/service.py              # create_audit_log()
├── auth/firebase.py              # Validação de tokens Firebase
├── crypto/service.py             # AES-256-GCM + HMAC-SHA256
├── db/
│   ├── models.py                 # Todos os modelos SQLAlchemy
│   └── session.py                # get_db()
├── middlewares/
│   ├── exceptions.py             # Handler global de erros
│   ├── logging.py                # Structured logging (Structlog)
│   ├── rate_limit.py             # Rate limiting por IP (Redis)
│   └── request_id.py             # X-Request-ID em todas as respostas
├── schemas/                      # Schemas Pydantic por domínio
│   ├── profile.py
│   ├── organization.py
│   ├── inbox.py
│   ├── legal.py
│   └── retreat.py
├── services/                     # Regras de negócio (não usadas pelo caminho principal)
├── main.py                       # FastAPI app + registro de rotas
└── settings.py                   # Configurações via Pydantic Settings
```

---

## Autenticação

### Modo Produção (`AUTH_MODE=PROD`)

Todas as rotas protegidas exigem header:
```
Authorization: Bearer <firebase-id-token>
```

O backend valida o token contra a chave pública do Firebase (`FIREBASE_PROJECT_ID`).

### Modo Desenvolvimento (`AUTH_MODE=DEV`)

Aceita tokens simplificados sem Firebase:
```
Authorization: Bearer dev:<user-uid>:<email>
```

Exemplo: `Bearer dev:abc123:joao@email.com`

### Dependências de Rota

```python
from app.api.deps import CurrentUser, DBSession

@router.get("/minha-rota")
async def rota(current_user: CurrentUser, db: DBSession):
    ...
```

`CurrentUser` retorna o objeto `User` completo do banco após validar o token.

---

## Módulos

### Auth (`/auth`)

| Endpoint | Descrição |
|----------|-----------|
| `POST /auth/register` | Cria usuário + perfil vazio + registra identidade |
| `POST /auth/login` | Valida token Firebase, retorna dados do usuário |
| `GET /auth/me` | Retorna usuário atual com memberships, convites e papéis |
| `DELETE /auth/me` | Exclusão de conta (soft delete + Firebase) |

### Profile (`/profile`)

| Endpoint | Descrição |
|----------|-----------|
| `GET /profile` | Retorna `ProfileWithLabelsOut` — labels de catálogo resolvidos |
| `PUT /profile` | Cria ou atualiza perfil (idempotente) |
| `GET /profile/catalogs` | Lista catálogos: LIFE_STATE, MARITAL_STATUS, VOCATIONAL_REALITY |
| `POST /profile/emergency-contact` | Upsert de contato de emergência (1 por usuário) |
| `GET /profile/emergency-contacts` | Lista contatos de emergência |

**Campos condicionais:**
- `consecration_year` → obrigatório se `vocational_reality = CONSAGRADO_FILHO_DA_LUZ`
- `vocational_accompanist_name` → obrigatório se `has_vocational_accompaniment = true`
- `instrument_names` → presente se `plays_instrument = true`
- `music_availability` → presente se `plays_instrument = true` e `available_for_group = true`

### Organization (`/org`)

Hierarquia em 5 níveis: `CONSELHO_GERAL → CONSELHO_EXECUTIVO → SETOR → MINISTERIO → GRUPO`

| Endpoint | Descrição |
|----------|-----------|
| `GET /org/tree` | Árvore completa com filhos recursivos |
| `GET /org/ministries` | Lista plana de ministérios |
| `POST /org/units/{id}/children` | Criar filho de uma unidade |
| `PATCH /org/units/{id}` | Atualizar unidade |
| `GET /org/units/{id}/members` | Listar membros com papéis |
| `POST /org/units/{id}/invites` | Enviar convite |
| `POST /org/invites/{id}/accept` | Aceitar convite |
| `POST /org/invites/{id}/reject` | Rejeitar convite |
| `GET /org/my/invites` | Convites pendentes do usuário atual |
| `GET /org/my/memberships` | Memberships ativas do usuário atual |

**Papéis em unidades:**
- `COORDINATOR` — gerencia a unidade e filhos imediatos
- `MEMBER` — participação simples

### Inbox (`/inbox`)

Sistema de mensagens internas com escopo flexível de destinatários.

**Filtros de envio disponíveis:**
- Por unidade organizacional (escopo)
- Por realidade vocacional
- Por estado de vida
- Por estado civil
- Por estado (UF)
- Por cidade
- Todos os usuários (requer papel global)

### Legal (`/legal`)

- Documentos versionados (TERMS, PRIVACY)
- Aceite registrado com timestamp, versão e flag de analytics/push opt-in
- Frontend bloqueia acesso até aceite das versões vigentes

### Verification (`/verify`)

- **Telefone**: gera código de 6 dígitos, envia via WhatsApp/SMS (produção), retorna na resposta em DEV
- **E-mail**: gera token de 32+ chars, envia por e-mail, verifica via URL de confirmação
- Expiração configurável

### Retiros (`/retreats`, `/admin/retreats`)

**Estrutura de um retiro:**
```
Retiro
├── Casas (acomodações com capacidade)
├── Taxas (por tipo de participação)
├── Regras de Elegibilidade
│   ├── Para participantes
│   └── Para equipe de serviço
├── Inscrições
│   ├── PARTICIPANT
│   └── SERVICE_TEAM
└── Equipes de Serviço (por função)
```

**Fluxo de inscrição:**
1. Usuário se inscreve (`POST /retreats/{id}/register`)
2. Faz upload de comprovante (`POST .../payment`)
3. Admin confirma ou rejeita (`POST /admin/retreats/{id}/registrations/{rid}/confirm`)

### Admin (`/admin`)

Acesso exclusivo para usuários com papel global `ADMIN` ou `DEV`.

**Acesso a documentos sensíveis (CPF/RG):**
1. Admin solicita acesso → cria `SensitiveAccessRequest` com justificativa
2. Segundo admin aprova → acesso liberado por janela de tempo
3. Acesso registrado em `audit_logs` com IP e user-agent

---

## Segurança

### Criptografia de Documentos

```python
# CPF
cpf_hash = HMAC-SHA256(cpf_digits, pepper)  # para busca/unicidade
cpf_encrypted = AES-256-GCM(cpf_digits, ENCRYPTION_KEY)  # para recuperação

# RG
rg_encrypted = AES-256-GCM(rg_string, ENCRYPTION_KEY)
```

Gerar chaves para produção:
```bash
python -c "import os, base64; print(base64.b64encode(os.urandom(32)).decode())"
```

### Rate Limiting

Configurado por IP via Redis:
- Limite por minuto: configurável em `settings.py`
- Limite por hora: configurável em `settings.py`
- Retorna `HTTP 429` ao exceder

### Middlewares (ordem de execução)

1. `RequestIDMiddleware` — adiciona `X-Request-ID` a todas as respostas
2. `CORSMiddleware` — origens configuradas via `CORS_ORIGINS`
3. `RateLimitMiddleware` — controle por IP via Redis
4. `LoggingMiddleware` — log estruturado de cada requisição
5. `ExceptionHandler` — captura exceções não tratadas sem vazar detalhes

### Audit Log

Todas as ações sensíveis são registradas:
```python
create_audit_log(
    db=db,
    actor_user_id=user_id,
    action="profile_updated",      # ação
    entity_type="user_profile",    # entidade
    entity_id=str(user_id),
    ip=request.client.host,
    user_agent=request.headers.get("user-agent"),
    metadata={"status": "COMPLETE"},
)
```

---

## Configuração

Todos os parâmetros são lidos via `app/settings.py` (Pydantic Settings):

```python
class Settings(BaseSettings):
    environment: str = "development"
    auth_mode: str = "DEV"            # DEV | PROD
    enable_dev_endpoints: bool = False
    debug_verification_code: bool = False
    database_url: str
    redis_url: str
    secret_key: str
    encryption_key: str               # base64 de 32 bytes
    hmac_pepper: str                  # base64 de 32 bytes
    firebase_project_id: str = ""
    cors_origins: list[str] = ["*"]
    enable_audit: bool = True
    sentry_dsn: str = ""
    app_version: str = "0.3.0"
```

---

## Testes

```bash
# Todos os testes
pytest

# Com verbose e cobertura
pytest -v --cov=app --cov-report=term-missing

# Arquivo específico
pytest tests/test_profile.py -v

# Teste específico
pytest tests/test_auth.py::test_register -v
```

**Fixtures principais** (`tests/conftest.py`):
- `client` — TestClient do FastAPI com banco de teste em memória
- `db` — sessão de banco SQLite isolada por teste
- `auth_headers` — headers de autenticação DEV para testes autenticados
- `test_user` — usuário de teste criado no banco

---

## Migrações

```bash
# Ver estado atual
alembic current

# Aplicar todas as pendentes
alembic upgrade head

# Ir para revisão específica
alembic upgrade 010_legal_v2

# Reverter uma migração
alembic downgrade -1

# Criar nova migração (autogenerate pelo diff do modelo)
alembic revision --autogenerate -m "descricao"

# Criar migração manual
alembic revision -m "descricao"
```

**Convenção de nomes:** `NNN_descricao_snake_case.py` (ex: `022_add_notification_preferences.py`)

### Histórico

| Migração | Descrição |
|----------|-----------|
| 001 | Schema inicial |
| 002 | Sistema de cadastro fase 1 |
| 003 | Catálogos e perfil |
| 004 | Inbox com escopo de organização |
| 005 | Sistema de permissões |
| 006–007 | Correções de enum org_unit_type |
| 008 | Campos extras de perfil (retiros, missões) |
| 009 | Documentos legais + módulo de retiros |
| 010–011 | Refinamentos legais e privacidade |
| 012 | Papel Analista |
| 013 | DPO formal |
| 014–015 | Retiros: casas e taxas |
| 016 | Taxas híbridas por retiro |
| 017 | Regras de elegibilidade |
| 018 | Equipes de serviço |
| 019 | Coordenadores de retiro |
| 020 | retreat_scope em org_units |
| 021 | Campos de música/instrumentos no perfil |
