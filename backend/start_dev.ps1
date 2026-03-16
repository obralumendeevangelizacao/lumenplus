# =============================================================================
#  Lumen+ -- Dev Environment Startup
#  Uso: .\start_dev.ps1
#  O que faz:
#    1. Para o container api do Docker (evita conflito na porta 8000)
#    2. Sobe DB + Redis via Docker
#    3. Aguarda o Postgres ficar pronto
#    4. Recria tabelas se o schema estiver vazio
#    5. Faz seed de dados base (roles, legal docs, catalogs)
#    6. Sobe uvicorn local com --reload
# =============================================================================

$ErrorActionPreference = "Stop"
$BACKEND = Split-Path -Parent $MyInvocation.MyCommand.Path
$PYTHON  = "$BACKEND\.venv\Scripts\python.exe"
$UVICORN = "$BACKEND\.venv\Scripts\uvicorn.exe"
$ALEMBIC = "$BACKEND\.venv\Scripts\alembic.exe"

Set-Location $BACKEND

function Log($msg) { Write-Host "  $msg" -ForegroundColor Cyan }
function OK($msg)  { Write-Host "  [OK] $msg" -ForegroundColor Green }
function DIE($msg) { Write-Host "  [ERRO] $msg" -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Lumen+ -- Dev Startup"                 -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# -- 1. Para container api do Docker (evita conflito na porta 8000) -----------
Log "Parando container api do Docker (se existir)..."
try { $null = docker stop backend-api-1 2>&1 } catch {}
OK "Container api parado (ou ja estava parado)"

# -- 2. Sobe db e redis -------------------------------------------------------
Log "Subindo db e redis via Docker..."
try { $null = docker compose up -d db redis 2>&1 } catch {}
Start-Sleep 2
$dbState = docker inspect -f "{{.State.Running}}" backend-db-1 2>&1
if ($dbState -ne "true") {
    DIE "Container backend-db-1 nao esta rodando. Docker Desktop esta ativo?"
}
OK "Docker: db (porta 5433) e redis (porta 6379) no ar"

# -- 3. Aguarda Postgres ficar pronto (max 30s) --------------------------------
Log "Aguardando Postgres..."
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
    $out = docker exec backend-db-1 pg_isready -U lumen -d lumen_db 2>&1
    if ($out -match "accepting connections") { $ready = $true; break }
    Start-Sleep 1
}
if (-not $ready) { DIE "Postgres nao ficou pronto em 30s. Veja: docker logs backend-db-1" }
OK "Postgres pronto"

# -- 4. Garante schema --------------------------------------------------------
Log "Verificando schema do banco..."
$out = & $PYTHON scripts\ensure_schema.py 2>$null
if ($out -match "CREATED") {
    try { $null = & $ALEMBIC stamp head 2>&1 } catch {}
    OK "Schema criado do zero e alembic marcado como head"
} elseif ($out -match "OK:(\d+)") {
    OK "Schema OK ($($Matches[1]) tabelas existentes)"
} else {
    OK "Schema verificado"
}

# -- 5. Seed de dados base ----------------------------------------------------
Log "Rodando seed de dados base..."
$seed = & $PYTHON scripts\seed_dev.py 2>&1
OK "Seed: $seed"

# -- 6. Uvicorn ---------------------------------------------------------------
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Backend pronto!"                       -ForegroundColor Green
Write-Host "  http://127.0.0.1:8000"               -ForegroundColor Green
Write-Host "  http://127.0.0.1:8000/docs"          -ForegroundColor Green
Write-Host "  Ctrl+C para encerrar"                -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

& $UVICORN app.main:app --reload --port 8000
