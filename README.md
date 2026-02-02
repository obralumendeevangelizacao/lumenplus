# Lumen+ — Backend & Infrastructure

Sistema de gestão para comunidades católicas. Esta é a **FASE 0** do projeto, contendo a fundação técnica.

## Stack

- **Backend**: Python 3.12, FastAPI, SQLAlchemy 2.x, Alembic
- **Database**: PostgreSQL 16
- **Cache/Rate Limit**: Redis 7
- **CMS**: Strapi 4.x
- **Auth**: Firebase Authentication (modo DEV disponível)

## Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                        Cliente (App)                         │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      FastAPI Backend                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────┐ │
│  │   Auth   │  │   Org    │  │  Audit   │  │ Rate Limit  │ │
│  │(Firebase)│  │ Service  │  │ Service  │  │  (Redis)    │ │
│  └──────────┘  └──────────┘  └──────────┘  └─────────────┘ │
└─────────────────────────────┬───────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
   ┌────────────┐      ┌────────────┐      ┌────────────┐
   │ PostgreSQL │      │   Redis    │      │   Strapi   │
   │ (dados)    │      │ (cache)    │      │   (CMS)    │
   └────────────┘      └────────────┘      └────────────┘
```

## Modelo Organizacional

```
SECTOR (Setor)
└── MINISTRY (Ministério)  ← herda visibilidade do Setor pai

GROUP (Grupo) ← independente
```

**Regra de herança**: Se um usuário é membro de um MINISTRY, ele automaticamente é considerado membro do SECTOR pai para fins de **visibilidade** (não autoridade).

## Início Rápido

### Pré-requisitos

- Docker e Docker Compose
- Make (opcional)

### 1. Subir a infraestrutura

```bash
# Clonar e entrar no diretório
cd lumen-plus

# Subir todos os serviços
docker compose up -d

# Verificar logs
docker compose logs -f api
```

### 2. Verificar se está funcionando

```bash
# Health check
curl http://localhost:8000/health

# Resposta esperada:
# {"status":"healthy","timestamp":"2025-01-22T..."}
```

### 3. Criar dados de seed (desenvolvimento)

```bash
# Primeiro, criar um usuário fazendo uma requisição autenticada
curl -X GET http://localhost:8000/me \
  -H "Authorization: Bearer dev:admin:admin@example.com"

# Executar seed (criar roles e org units de exemplo)
curl -X POST http://localhost:8000/dev/seed \
  -H "Authorization: Bearer dev:admin:admin@example.com"
```

### 4. Verificar estrutura organizacional

```bash
curl http://localhost:8000/org-units/tree | jq
```

## Endpoints

| Método | Endpoint | Auth | Descrição |
|--------|----------|------|-----------|
| GET | `/health` | Não | Health check |
| GET | `/me` | Sim | Dados do usuário autenticado |
| GET | `/org-units/tree` | Não* | Árvore organizacional |
| POST | `/dev/seed` | Sim | Criar dados de exemplo (dev only) |
| POST | `/dev/org-units` | Sim | Criar org unit (dev only) |

*Rate limited

## Autenticação

### Modo DEV (padrão)

Em desenvolvimento, use tokens no formato:
```
Authorization: Bearer dev:<uid>:<email>
```

Exemplo:
```bash
curl http://localhost:8000/me \
  -H "Authorization: Bearer dev:user123:user@example.com"
```

### Modo PROD

Em produção, use tokens reais do Firebase. Configure:
```bash
AUTH_MODE=PROD
FIREBASE_PROJECT_ID=seu-projeto-firebase
```

## Strapi CMS

O Strapi estará disponível em `http://localhost:1337`.

### Primeira execução

1. Acesse `http://localhost:1337/admin`
2. Crie um usuário administrador
3. Crie o Content Type `formation_post`:

**Campos:**
- `title` (Text, required)
- `slug` (UID, based on title)
- `cover_image` (Media, single, optional)
- `content` (Rich text)
- `published_at` (Datetime)
- `visibility` (Enumeration: public, logged_in, restricted)
- `audience_attributes` (JSON)
- `audience_org_units_any` (JSON)

**Importante**: Mantenha as permissões de API restritas. O Strapi não deve ser acessível publicamente.

## Desenvolvimento Local

### Sem Docker

```bash
cd backend

# Criar venv
python -m venv .venv
source .venv/bin/activate

# Instalar dependências
pip install -e ".[dev]"

# Configurar variáveis
cp .env.example .env
# Edite .env conforme necessário

# Rodar migrações
alembic upgrade head

# Rodar servidor
uvicorn app.main:app --reload
```

### Comandos úteis

```bash
# Lint
ruff check .

# Format
ruff format .

# Type check
mypy app

# Testes
pytest -v
```

## Decisões de Design (Suposições)

1. **UUID como PK**: Todas as tabelas usam UUID para evitar problemas de collision em sistemas distribuídos.

2. **Soft inheritance**: A herança MINISTRY→SECTOR é apenas para visibilidade de conteúdo, não para autoridade administrativa.

3. **Audit log imutável**: Logs de auditoria nunca são deletados ou modificados.

4. **Rate limit por IP**: Implementação simples via Redis. Em produção, considerar rate limit por usuário também.

5. **Strapi isolado**: O CMS não expõe API pública. O backend consumirá via rede interna.

6. **Token provisioning**: Usuários são criados automaticamente no primeiro login válido.

## Estrutura de Diretórios

```
backend/
├── alembic/          # Migrações de banco
├── app/
│   ├── api/          # Rotas e dependências
│   ├── audit/        # Serviço de auditoria
│   ├── auth/         # Verificação Firebase
│   ├── db/           # Models e sessão
│   ├── middlewares/  # Logging e rate limit
│   ├── org/          # Lógica organizacional
│   ├── schemas/      # Pydantic schemas
│   ├── main.py       # App FastAPI
│   └── settings.py   # Configurações
└── tests/            # Testes pytest
```

## CI/CD

O GitHub Actions workflow em `.github/workflows/ci.yml` executa:

1. **Lint**: ruff check
2. **Format check**: ruff format --check
3. **Type check**: mypy
4. **Testes**: pytest

## Próximas Fases

- [ ] FASE 1: Atributos de usuário, fluxo de convite
- [ ] FASE 2: Sistema de formação (conteúdo + progresso)
- [ ] FASE 3: Eventos e notificações
- [ ] FASE 4: Relatórios e analytics

## Licença

Proprietário — uso restrito.
