# Lumen+ — Plataforma de Gestão para Comunidades Católicas

Sistema completo para comunidades católicas: gestão de membros, hierarquia organizacional, retiros, formação espiritual e comunicação interna. Disponível para iOS, Android e Web.

---

## Sumário

- [Visão Geral](#visão-geral)
- [Funcionalidades](#funcionalidades)
- [Arquitetura](#arquitetura)
- [Stack Tecnológica](#stack-tecnológica)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Configuração de Desenvolvimento](#configuração-de-desenvolvimento)
- [Variáveis de Ambiente](#variáveis-de-ambiente)
- [API — Referência](#api--referência)
- [Banco de Dados](#banco-de-dados)
- [Migrações](#migrações)
- [Testes](#testes)
- [Deploy em Produção](#deploy-em-produção)

---

## Visão Geral

O Lumen+ é uma plataforma mobile-first desenvolvida para apoiar a gestão de comunidades da Renovação Carismática Católica. O sistema oferece:

- **Gestão de membros** com perfil vocacional completo
- **Hierarquia organizacional** em 5 níveis (Conselho → Setor → Ministério → Grupo)
- **Sistema de convites** para ingresso em ministérios e grupos
- **Inbox interno** para comunicação entre coordenadores e membros
- **Módulo de retiros** com inscrições, casas, taxas e equipes de serviço
- **Formação espiritual** com Bíblia e Catecismo da Igreja Católica
- **Painel administrativo** com auditoria, governança e acesso seguro a documentos

---

## Funcionalidades

### Autenticação e Onboarding
- Cadastro e login via Firebase Authentication (email/senha)
- Verificação de e-mail e telefone (WhatsApp)
- Aceite de Termos de Uso e Política de Privacidade com versionamento
- Onboarding guiado com preenchimento progressivo de perfil

### Perfil do Usuário
- Dados pessoais: nome, nascimento, CPF/RG (criptografados com AES-256-GCM), telefone, cidade, estado
- Estado de vida, estado civil e realidade vocacional (via catálogos)
- Acompanhamento vocacional (sim/não, nome do acompanhador)
- Interesse em ministério com observações livres
- Dados de retiro: preferência de acomodação, restrição alimentar, plano de saúde
- Música e ministério musical: instrumento(s) tocado(s), disponibilidade por dia e turno
- Contato de emergência
- Foto de perfil (URL/upload)

### Hierarquia Organizacional
```
Conselho Geral
└── Conselho Executivo
    └── Setor
        └── Ministério
            └── Grupo (Acolhida, Aprofundamento, Vocacional, Casais, Curso, Projeto)
```
- Criação e edição de unidades por coordenadores
- Visualização da árvore completa por membros
- Listagem de membros por unidade

### Sistema de Convites
- Coordenadores enviam convites para usuários por e-mail
- Usuários aceitam ou rejeitam convites recebidos
- Histórico de convites (pendente, aceito, rejeitado, expirado, cancelado)
- Notificação via inbox ao receber convite

### Inbox (Mensageria Interna)
- Mensagens de coordenadores para membros, unidades ou papéis
- Filtros de destinatário: todos, por realidade vocacional, estado de vida, cidade, estado
- Preview de destinatários antes do envio
- Contador de não lidas em tempo real
- Tipos de mensagem: info, aviso, sucesso, urgente

### Módulo de Retiros
- Criação de retiros com nome, datas, local, capacidade e descrição
- Tipos de participação: Participante ou Equipe de Serviço
- Múltiplos tipos de taxa por retiro (inscrição, hospedagem, alimentação, etc.)
- Casas de acomodação com capacidade configurável
- Regras de elegibilidade separadas para participantes e equipe
- Inscrição com upload de comprovante de pagamento
- Confirmação/rejeição de inscrições pelo coordenador
- Equipes de serviço por função e retiro
- Painel de gestão com visão geral de inscrições e vagas

### Formação Espiritual
- **Bíblia (Sagradas Escrituras)**: Versículo do Dia determinístico e leitor por livro/capítulo/versículo
- **Catecismo da Igreja Católica**: 2.537 parágrafos (§1–§2557), leitura paginada (30 §/página), busca por palavra e navegação por número de parágrafo
- Leitor com contexto (parágrafos vizinhos), controle de tamanho de fonte e breadcrumb hierárquico

### Administração
- Listagem e edição de todos os usuários
- Atribuição de papéis globais (DEV, ADMIN, ANALISTA, COORDINATOR)
- Acesso controlado a documentos sensíveis (CPF/RG) com fluxo request/approve e auditoria
- Criação e gestão de avisos (inbox massivo)
- Histórico de avisos enviados
- Logs de auditoria filtráveis por ação, entidade e usuário
- Gestão completa de retiros (criar, editar, publicar, gerenciar inscrições)

### Segurança e Conformidade
- CPF e RG criptografados com AES-256-GCM antes de armazenar
- HMAC-SHA256 para busca de CPF sem exposição do dado real
- Rate limiting por IP (por minuto e por hora)
- Request ID em todas as requisições para rastreabilidade
- Logs estruturados com Structlog
- Monitoramento de erros com Sentry (configurado sem envio de PII — LGPD)
- Swagger UI disponível apenas em ambiente de desenvolvimento

---

## Arquitetura

```
┌──────────────────────────────────────────────────────────────┐
│                   App Mobile (React Native)                   │
│   Expo Router · Zustand · Firebase Auth · TanStack Query      │
└──────────────────────┬───────────────────────────────────────┘
                       │ HTTPS + Bearer Token (Firebase JWT)
                       ▼
┌──────────────────────────────────────────────────────────────┐
│                       FastAPI Backend                         │
│  Auth · Profile · Org · Inbox · Retiros · Legal · Admin       │
│  Middlewares: CORS · RateLimit · RequestID · ExceptionHandler │
└──────────────┬────────────────────────────┬──────────────────┘
               │                            │
       ┌───────▼──────┐            ┌────────▼───────┐
       │  PostgreSQL  │            │     Redis       │
       │  (dados)     │            │ (rate limiting) │
       └──────────────┘            └────────────────┘
```

---

## Stack Tecnológica

### Backend

| Componente | Tecnologia |
|-----------|------------|
| Linguagem | Python 3.12 |
| Framework | FastAPI 0.115+ |
| ORM | SQLAlchemy 2.x |
| Migrações | Alembic |
| Banco de Dados | PostgreSQL 16 |
| Cache / Rate Limit | Redis 7 |
| Autenticação | Firebase Authentication |
| Criptografia | AES-256-GCM (cryptography 44+) |
| Validação | Pydantic 2.10+ |
| Servidor ASGI | Uvicorn |
| Logs | Structlog 24.4+ |
| Monitoramento | Sentry SDK |
| Upload de arquivos | Cloudinary |

### Mobile

| Componente | Tecnologia |
|-----------|------------|
| Framework | React Native 0.76 + Expo 52 |
| Linguagem | TypeScript 5.3 |
| Roteamento | Expo Router 4 (file-based) |
| Estado global | Zustand 4 |
| Dados do servidor | TanStack React Query 5 |
| Formulários | React Hook Form 7 + Zod 3 |
| Ícones | Expo Vector Icons |
| Autenticação | Firebase SDK 10 |
| Armazenamento seguro | Expo Secure Store |
| Monitoramento | Sentry React Native |
| Plataformas | iOS · Android · Web |

---

## Estrutura do Projeto

```
lumenplus-main/
├── backend/                        # API Python/FastAPI
│   ├── app/
│   │   ├── api/                    # Rotas HTTP
│   │   │   ├── routes/             # auth.py · organization.py · admin.py
│   │   │   ├── profile_routes.py
│   │   │   ├── inbox_routes.py
│   │   │   ├── legal_routes.py
│   │   │   ├── verification_routes.py
│   │   │   ├── retreat_routes.py
│   │   │   ├── admin_routes.py
│   │   │   ├── admin_retreat_routes.py
│   │   │   └── deps.py             # Injeção de dependências
│   │   ├── audit/service.py        # Logs de auditoria
│   │   ├── auth/firebase.py        # Validação de tokens Firebase
│   │   ├── crypto/service.py       # AES-256-GCM para CPF/RG
│   │   ├── db/
│   │   │   ├── models.py           # Modelos SQLAlchemy
│   │   │   └── session.py          # Sessão de banco de dados
│   │   ├── middlewares/            # CORS, rate limit, request ID
│   │   ├── schemas/                # Schemas Pydantic (request/response)
│   │   ├── services/               # Regras de negócio
│   │   ├── main.py                 # Inicialização da aplicação
│   │   └── settings.py             # Configurações (variáveis de ambiente)
│   ├── alembic/versions/           # 21 migrações de banco
│   ├── tests/                      # Testes automatizados
│   ├── pyproject.toml
│   └── requirements.txt
│
├── lumen_mobile/                   # App React Native
│   ├── app/                        # Telas (Expo Router — file-based routing)
│   │   ├── (auth)/                 # Login, cadastro, verificações
│   │   ├── (onboarding)/           # Termos, perfil inicial, documentos
│   │   ├── (tabs)/                 # Tabs principais: home, comunidade, convites, perfil, orações
│   │   ├── admin/                  # Painel administrativo
│   │   ├── biblia/                 # Módulo Bíblia
│   │   ├── catecismo/              # Módulo Catecismo
│   │   ├── retreats/               # Módulo Retiros
│   │   └── coordinator/            # Ferramentas de coordenador
│   ├── src/
│   │   ├── services/               # Clientes de API (api.ts, bible.ts, catecismo.ts)
│   │   ├── stores/                 # Estado global Zustand
│   │   ├── types/index.ts          # Tipos TypeScript (alinhados com backend)
│   │   └── utils/                  # Utilitários (error.ts)
│   ├── assets/
│   │   └── catecismo.json          # CIC completo — 2537 parágrafos (offline)
│   ├── package.json
│   └── app.json
│
├── docker-compose.yml              # PostgreSQL + Redis para desenvolvimento
└── README.md
```

---

## Configuração de Desenvolvimento

### Pré-requisitos

- Python 3.12+
- Node.js 20+
- Docker e Docker Compose
- Expo CLI (`npm install -g expo-cli`)

### Backend

```bash
# 1. Subir banco de dados e Redis
cd lumenplus-main
docker compose up -d

# 2. Criar ambiente virtual e instalar dependências
cd backend
python -m venv .venv
source .venv/bin/activate      # Linux/macOS
.venv\Scripts\activate         # Windows

pip install -e ".[dev]"

# 3. Configurar variáveis de ambiente
cp .env.example .env
# editar .env com os valores de desenvolvimento (ver seção abaixo)

# 4. Aplicar migrações
alembic upgrade head

# 5. Iniciar servidor (com auto-reload)
uvicorn app.main:app --reload
# Acesse: http://localhost:8000/docs
```

### Mobile

```bash
cd lumen_mobile
npm install

# Configurar variável de ambiente
echo "EXPO_PUBLIC_API_URL=http://localhost:8000" > .env

# Iniciar
npx expo start

# Plataformas específicas
npx expo run:ios
npx expo run:android
```

---

## Variáveis de Ambiente

### Backend — Desenvolvimento (`.env`)

```env
ENVIRONMENT=development
AUTH_MODE=DEV
ENABLE_DEV_ENDPOINTS=true
DEBUG_VERIFICATION_CODE=true

DATABASE_URL=postgresql+psycopg://lumen:lumen_secret@localhost:5432/lumen_db
REDIS_URL=redis://localhost:6379/0

SECRET_KEY=dev-secret-key-mude-em-producao
ENCRYPTION_KEY=<base64-de-32-bytes-qualquer>
HMAC_PEPPER=<base64-de-32-bytes-qualquer>
```

> **`AUTH_MODE=DEV`**: aceita tokens no formato `Bearer dev:<uid>:<email>` sem validação Firebase.
> **`ENABLE_DEV_ENDPOINTS=true`**: habilita rotas `/dev/*` (seed, criação de roles, reset).
> **`DEBUG_VERIFICATION_CODE=true`**: retorna o código de verificação telefônica na resposta da API.

### Backend — Produção

```env
ENVIRONMENT=production
AUTH_MODE=PROD
ENABLE_DEV_ENDPOINTS=false
DEBUG_VERIFICATION_CODE=false

DATABASE_URL=postgresql+psycopg://usuario:senha@host:5432/lumen_db
REDIS_URL=redis://host:6379/0

SECRET_KEY=<string-aleatória-longa-32+-chars>
ENCRYPTION_KEY=<base64-de-32-bytes>     # AES-256-GCM para CPF/RG
HMAC_PEPPER=<base64-de-32-bytes>        # HMAC-SHA256 para busca de CPF

FIREBASE_PROJECT_ID=<seu-projeto-firebase>
CORS_ORIGINS=https://seuapp.com

# Opcional — monitoramento de erros
SENTRY_DSN=https://...@sentry.io/...

# Opcional — upload de imagens
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

### Mobile

```env
EXPO_PUBLIC_API_URL=https://api.seudominio.com
```

---

## API — Referência

A documentação interativa (Swagger UI) está disponível em `/docs` no modo desenvolvimento.

### Autenticação

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/auth/register` | Cadastrar novo usuário |
| POST | `/auth/login` | Login (retorna token Firebase) |
| GET | `/auth/me` | Dados do usuário autenticado |
| DELETE | `/auth/me` | Excluir conta |

### Perfil

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/profile` | Buscar perfil com labels resolvidos |
| PUT | `/profile` | Criar ou atualizar perfil |
| GET | `/profile/catalogs` | Opções de catálogos (estado de vida, civil, vocacional) |
| POST | `/profile/emergency-contact` | Adicionar/atualizar contato de emergência |
| GET | `/profile/emergency-contacts` | Listar contatos de emergência |

### Organização

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/org/tree` | Árvore organizacional completa |
| GET | `/org/ministries` | Lista plana de ministérios |
| POST | `/org/units/{id}/children` | Criar unidade filha |
| GET | `/org/units/{id}/members` | Listar membros de uma unidade |
| POST | `/org/units/{id}/invites` | Enviar convite para membro |
| POST | `/org/invites/{id}/accept` | Aceitar convite |
| POST | `/org/invites/{id}/reject` | Rejeitar convite |
| GET | `/org/my/invites` | Meus convites pendentes |
| GET | `/org/my/memberships` | Minhas associações ativas |

### Verificação

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/verify/phone/start` | Iniciar verificação por telefone |
| POST | `/verify/phone/confirm` | Confirmar código de telefone |
| POST | `/verify/email/start` | Iniciar verificação por e-mail |
| POST | `/verify/email/confirm` | Confirmar token de e-mail |

### Inbox

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/inbox` | Listar mensagens recebidas |
| GET | `/inbox/unread` | Contagem de não lidas |
| PATCH | `/inbox/{id}/read` | Marcar como lida |
| POST | `/inbox/send` | Enviar mensagem |
| POST | `/inbox/send/preview` | Pré-visualizar destinatários |
| GET | `/inbox/send/scopes` | Escopos de envio disponíveis |

### Legal

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/legal/latest` | Termos e Política vigentes |
| POST | `/legal/accept` | Registrar aceite |

### Retiros

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/retreats` | Listar retiros disponíveis |
| GET | `/retreats/{id}` | Detalhes do retiro |
| POST | `/retreats/{id}/register` | Inscrever-se no retiro |
| DELETE | `/retreats/{id}/my-registration` | Cancelar inscrição |
| POST | `/retreats/{id}/my-registration/payment` | Enviar comprovante de pagamento |

### Admin

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/admin/users` | Listar todos os usuários |
| PATCH | `/admin/users/{id}` | Editar usuário (papéis, status) |
| GET | `/admin/users/{id}/documents` | Ver CPF/RG (requer aprovação) |
| GET | `/admin/sensitive-access/pending` | Solicitações de acesso pendentes |
| POST | `/admin/sensitive-access/{id}/approve` | Aprovar acesso a documentos |
| GET | `/admin/audit-logs` | Logs de auditoria |
| POST | `/admin/retreats` | Criar retiro |
| PATCH | `/admin/retreats/{id}` | Atualizar retiro |
| GET | `/admin/retreats/{id}/registrations` | Listar inscritos |
| POST | `/admin/retreats/{id}/registrations/{rid}/confirm` | Confirmar inscrição |

### Desenvolvimento (apenas `ENABLE_DEV_ENDPOINTS=true`)

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/dev/seed` | Popular dados iniciais (papéis, docs legais) |
| POST | `/dev/assign-global-role` | Atribuir papel global a um usuário |
| POST | `/dev/org-units` | Criar unidades organizacionais de teste |

---

## Banco de Dados

### Principais Entidades

| Tabela | Descrição |
|--------|-----------|
| `users` | Contas de usuário com múltiplas identidades |
| `user_identities` | Credenciais por provedor (Firebase) |
| `user_profiles` | Perfil completo com dados vocacionais, documentos criptografados e preferências |
| `user_emergency_contacts` | Contatos de emergência (1 por usuário) |
| `org_units` | Hierarquia organizacional (5 níveis) |
| `org_memberships` | Vínculos usuário × unidade organizacional |
| `org_invites` | Convites de ingresso em unidades |
| `org_roles` | Definição de papéis (COORDINATOR, MEMBER, ADMIN, ANALISTA) |
| `user_global_roles` | Papéis globais do sistema |
| `inbox_messages` | Mensagens internas |
| `inbox_recipients` | Destinatários de mensagens com status de leitura |
| `legal_documents` | Termos e Política de Privacidade (versionados) |
| `user_legal_acceptances` | Registro de aceites com timestamp |
| `retreats` | Retiros com datas, vagas, taxas e regras de elegibilidade |
| `retreat_registrations` | Inscrições em retiros |
| `retreat_houses` | Casas/acomodações por retiro |
| `retreat_fees` | Taxas por tipo de participação |
| `retreat_service_teams` | Equipes de serviço por função |
| `profile_catalogs` | Catálogos de opções (estado de vida, civil, vocacional) |
| `profile_catalog_items` | Itens dos catálogos |
| `audit_logs` | Registro de ações para conformidade |

### Criptografia de Documentos

CPF e RG são tratados com duas camadas:

- **`cpf_hash`**: HMAC-SHA256 com pepper — permite busca sem expor o dado
- **`cpf_encrypted`** / **`rg_encrypted`**: AES-256-GCM — armazenamento reversível para exibição autorizada

O acesso administrativo a CPF/RG exige solicitação formal, aprovação por outro admin e fica registrado no audit log.

---

## Migrações

```bash
# Aplicar todas as migrações pendentes
alembic upgrade head

# Verificar estado atual
alembic current

# Criar nova migração com autogenerate
alembic revision --autogenerate -m "descricao_da_mudanca"

# Reverter última migração
alembic downgrade -1
```

Histórico de migrações em `backend/alembic/versions/` (21 migrações, `001` → `021`).

---

## Testes

```bash
cd backend
pytest                          # Todos os testes
pytest tests/test_profile.py    # Módulo específico
pytest -v                       # Verbose
pytest --cov=app                # Com cobertura
```

Suítes disponíveis: `test_auth`, `test_profile`, `test_org_expand`, `test_membership`, `test_legal`, `test_audit`, `test_sensitive_access`, `test_health`, `test_me`.

---

## Deploy em Produção

### Docker Compose (Self-Hosted)

```bash
docker compose -f docker-compose.yml up -d
```

O `docker-compose.yml` sobe PostgreSQL, Redis e o backend com `alembic upgrade head` automático no start.

### Railway / Render / Fly.io

1. Configure as variáveis de ambiente de produção (ver seção acima)
2. O `Procfile` / `railway.toml` aponta para `uvicorn app.main:app --host 0.0.0.0`
3. Execute `alembic upgrade head` como release command

### Setup Inicial de Produção (uma vez)

```bash
# 1. Criar dados base (papéis, docs legais)
POST /dev/seed   # apenas com ENABLE_DEV_ENDPOINTS=true temporariamente

# 2. Atribuir papel DEV ao primeiro usuário
POST /dev/assign-global-role  { "user_id": "...", "role": "DEV" }

# 3. Criar Conselho Geral (raiz da hierarquia)
POST /org/units  { "name": "Conselho Geral", "type": "CONSELHO_GERAL" }

# 4. Desabilitar endpoints de desenvolvimento
ENABLE_DEV_ENDPOINTS=false
```

---

## Próximas Etapas

| Feature | Status |
|---------|--------|
| Upload de foto de perfil (S3/Cloudinary) | 🔶 Endpoint criado, persistência pendente |
| Envio real de SMS/WhatsApp para verificação | 🔶 Código gerado; envio pendente |
| Integração Strapi CMS | ❌ Placeholder presente |
| Rate limiting por usuário autenticado | 🔶 Apenas por IP atualmente |
| Módulo de IA / RAG (Bíblia + Catecismo) | 🔶 Estrutura de dados preparada |
