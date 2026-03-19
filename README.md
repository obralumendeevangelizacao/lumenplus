# Lumen+ — Plataforma para Comunidades Católicas

Sistema de gestão para comunidades católicas. App já está online.

## Stack

| Camada | Tecnologia |
|--------|-----------|
| **Backend** | Python 3.12, FastAPI 0.115+, SQLAlchemy 2.x, Alembic |
| **Banco de Dados** | PostgreSQL 16 |
| **Cache / Rate Limit** | Redis 7 |
| **Autenticação** | Firebase Authentication (modo DEV disponível para desenvolvimento local) |
| **Mobile** | React Native 0.76 + Expo 52, TypeScript, Expo Router 4 |
| **Estado (Mobile)** | Zustand 4 |
| **Dados (Mobile)** | TanStack React Query 5 |

## Arquitetura

```
┌──────────────────────────────────────────────────────────────┐
│                   App Mobile (React Native)                   │
│   Expo Router · Zustand · Firebase Auth · fetch nativo       │
└──────────────────────────────┬───────────────────────────────┘
                               │ HTTPS + Bearer Token
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                       FastAPI Backend                         │
│  Auth · Profile · Org · Inbox · Verify · Legal · Admin       │
└──────────────────┬───────────────────────┬───────────────────┘
                   │                       │
           ┌───────▼──────┐       ┌────────▼───────┐
           │  PostgreSQL  │       │     Redis       │
           │   (dados)    │       │ (rate limiting) │
           └──────────────┘       └────────────────┘
```

## Módulos implementados

### Backend (`backend/app/`)

| Módulo | Rotas | Status |
|--------|-------|--------|
| **Auth** | `POST /auth/register`, `GET /auth/me` | ✅ Estável |
| **Profile** | `GET /PUT /profile`, `/profile/catalogs`, `/profile/emergency-contact` | ✅ Estável |
| **Organization** | `/org/tree`, `/org/ministries`, `/org/units/*`, `/org/my/*` | ✅ Estável |
| **Invites** | `/org/units/{id}/invites`, `/org/invites/{id}/accept|reject` | ✅ Estável |
| **Inbox** | `/inbox`, `/inbox/send`, `/inbox/send/scopes`, `/inbox/permissions` | ✅ Estável |
| **Legal** | `GET /legal/latest`, `POST /legal/accept` | ✅ Estável |
| **Verification** | `POST /verify/phone/start|confirm`, `POST /verify/email/start|confirm` | ✅ Estável |
| **Admin** | `GET /admin/users`, `PATCH /admin/users/{id}`, `/toggle-avisos` | ✅ Estável |

### Mobile (`lumen_mobile/app/`)

| Tela | Status |
|------|--------|
| Login (Firebase email/senha) | ✅ Estável |
| Cadastro | ✅ Estável |
| Onboarding: Termos | ✅ Estável |
| Onboarding: Perfil | ✅ Estável |
| Onboarding: Documentos (CPF/RG) | ✅ Estável |
| Home / Inbox | ✅ Estável |
| Convites | ✅ Estável |
| Comunidade (árvore org) | ✅ Estável |
| Perfil (tabs) | ✅ Estável |
| Admin: Usuários | ✅ Estável |
| Admin: Entidades Org | ✅ Estável |
| Admin: Criar Aviso | ✅ Estável |
| Admin: Avisos Enviados | ✅ Estável |

## O que é DEV-only

| Recurso | Detalhe |
|---------|---------|
| `AUTH_MODE=DEV` | Aceita tokens no formato `Bearer dev:<uid>:<email>` sem Firebase |
| `ENABLE_DEV_ENDPOINTS=true` | Habilita rotas `/dev/*` (reset de banco, seed, etc.) |
| `DEBUG_VERIFICATION_CODE=true` | Retorna o código de verificação de telefone na resposta (nunca em produção) |
| `docs_url=/docs` | Swagger UI disponível apenas em modo dev |

Para desenvolvimento local, configure no `backend/.env`:
```
AUTH_MODE=DEV
ENABLE_DEV_ENDPOINTS=true
DEBUG_VERIFICATION_CODE=true
```

## Variáveis de ambiente obrigatórias em produção

**Backend:**
```
ENVIRONMENT=production
AUTH_MODE=PROD
SECRET_KEY=<chave-aleatória-longa>
ENCRYPTION_KEY=<base64-de-32-bytes>   # Para criptografia AES-256-GCM de CPF/RG
HMAC_PEPPER=<base64-de-32-bytes>      # Para HMAC-SHA256 de CPF
DATABASE_URL=postgresql+psycopg://...
REDIS_URL=redis://...
FIREBASE_PROJECT_ID=<seu-projeto>
CORS_ORIGINS=https://seuapp.com
```

**Mobile:**
```
EXPO_PUBLIC_API_URL=https://api.seudominio.com
```

## Setup de desenvolvimento

### Backend

```bash
cd backend
docker compose up -d          # PostgreSQL + Redis
pip install -e ".[dev]"
alembic upgrade head
uvicorn app.main:app --reload
```

### Mobile

```bash
cd lumen_mobile
npm install
npx expo start
```

## O que está adiado (próximas etapas)

| Feature | Status |
|---------|--------|
| **Módulo de Retiros** | ❌ NÃO implementado — planejado para etapa futura |
| Upload de foto de perfil (S3/GCS) | ❌ NÃO implementado — endpoint aceita mas não persiste arquivo |
| Envio de SMS/WhatsApp para verificação | ❌ NÃO implementado — código retornado na resposta em modo dev |
| Integração Strapi CMS | ❌ NÃO implementado — diretório placeholder presente |
| Rate limiting por usuário (além de por IP) | 🔶 Parcial — só por IP |
| Acesso admin a CPF/RG (fluxo request/approve) | 🔶 Parcial — lógica em `api/admin_routes.py`, não registrado |

## Estrutura de diretórios relevante

```
lumenplus-main/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── profile_routes.py      # Rotas de perfil (canônico)
│   │   │   ├── inbox_routes.py        # Rotas de inbox
│   │   │   ├── legal_routes.py        # Rotas legais
│   │   │   ├── verification_routes.py # Rotas de verificação
│   │   │   └── routes/
│   │   │       ├── auth.py            # Autenticação
│   │   │       ├── organization.py    # Organização
│   │   │       └── admin.py           # Admin
│   │   ├── audit/service.py           # Serviço de auditoria (canônico)
│   │   ├── crypto/service.py          # AES-256-GCM para CPF/RG
│   │   ├── db/models.py               # Modelos SQLAlchemy
│   │   ├── schemas/                   # Schemas Pydantic
│   │   └── settings.py                # Configurações (fonte canônica)
│   └── alembic/versions/              # Migrações de banco
└── lumen_mobile/
    ├── app/                           # Telas (Expo Router)
    └── src/
        ├── services/                  # Clientes de API
        ├── stores/                    # Estado global (Zustand)
        ├── types/                     # Tipos TypeScript
        └── utils/                     # Utilitários (error parsing, etc.)
```

## Migrações de banco

```bash
# Aplicar todas as migrações
alembic upgrade head

# Criar nova migração
alembic revision --autogenerate -m "descrição"
```

Histórico de migrações em `backend/alembic/versions/`.
