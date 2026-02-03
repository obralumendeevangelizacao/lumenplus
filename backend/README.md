# Lumen+ Backend v2

Backend refatorado do Lumen+ com:

## Mudanças Principais

### 1. Sistema de Convites (não solicitações)
- Coordenadores **enviam convites** para usuários
- Usuários **aceitam ou rejeitam** convites
- Não existe mais "solicitar participação"

### 2. Hierarquia Organizacional
```
DEV (cria)
└── Conselho Geral (cria)
    └── Conselho Executivo (cria)
        └── Setores (criam)
            └── Ministérios (criam)
                └── Grupos
```

### 3. Tipos de Grupo
- Acolhida
- Aprofundamento
- Vocacional
- Casais
- Curso
- Projeto

### 4. Visibilidade
- **PUBLIC**: Visível para todos
- **RESTRICTED**: Só para membros

### 5. Perfil Completo
- Foto
- Dados básicos (nome, nascimento, CPF, RG, telefone)
- Estado de vida (Simpatizante → Consagrado Filho da Luz)
- Se Consagrado: ano de consagração
- Acompanhamento vocacional (sim/não, quem)
- Interesse em ministério (sim/não, qual)

## Quick Start

```bash
# 1. Subir banco e redis
docker-compose up -d db redis

# 2. Criar ambiente virtual
python -m venv venv
source venv/bin/activate  # Linux/Mac
venv\Scripts\activate     # Windows

# 3. Instalar dependências
pip install -r requirements.txt

# 4. Rodar migrações
alembic upgrade head

# 5. Rodar servidor
uvicorn app.main:app --reload
```

## Endpoints Principais

### Auth
- `POST /auth/register` - Cadastro
- `POST /auth/login` - Login
- `GET /auth/me` - Dados do usuário

### Profile
- `GET /profile` - Buscar perfil
- `PUT /profile` - Atualizar perfil
- `POST /profile/photo` - Upload de foto
- `GET /profile/catalogs` - Opções de formulário
- `POST /verify/phone/start` - Iniciar verificação
- `POST /verify/phone/confirm` - Confirmar verificação

### Organization
- `GET /org/tree` - Árvore organizacional
- `POST /org/units/{parent_id}/children` - Criar unidade filha
- `GET /org/units/{id}/members` - Listar membros
- `POST /org/units/{id}/invites` - Enviar convite
- `POST /org/invites/{id}/accept` - Aceitar convite
- `POST /org/invites/{id}/reject` - Rejeitar convite

### Dev (só desenvolvimento)
- `POST /dev/seed` - Popular dados iniciais
- `POST /dev/make-me-dev` - Tornar-se DEV
- `POST /dev/create-conselho-geral` - Criar raiz da hierarquia

## Fluxo de Setup

1. Registrar primeiro usuário
2. `POST /dev/seed` - Criar roles e docs legais
3. `POST /dev/make-me-dev` - Tornar usuário DEV
4. `POST /dev/create-conselho-geral` - Criar Conselho Geral
5. A partir daí, criar filhos via `/org/units/{id}/children`

## Variáveis de Ambiente

```env
DATABASE_URL=postgresql://lumen:lumen_secret@localhost:5432/lumen_db
REDIS_URL=redis://localhost:6379/0
ENVIRONMENT=dev
AUTH_MODE=DEV
ENABLE_DEV_ENDPOINTS=true
DEBUG_VERIFICATION_CODE=true
```