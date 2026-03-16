#!/bin/bash
# =============================================================================
# Lumen+ API — Script de inicialização para produção
# Executa as migrations do banco antes de subir o servidor.
# =============================================================================

set -e

echo "▶ Rodando migrations do banco de dados..."
alembic upgrade head

echo "▶ Iniciando servidor Uvicorn..."
exec uvicorn app.main:app \
  --host 0.0.0.0 \
  --port "${PORT:-8000}" \
  --workers 1 \
  --log-level info
