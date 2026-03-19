"""Cria tabelas se o schema estiver vazio. Idempotente."""

import sys
import os
import logging

# Silencia warnings do app durante a checagem
logging.disable(logging.CRITICAL)
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.db.session import engine  # noqa: E402
from app.db.models import Base  # noqa: E402
from sqlalchemy import inspect  # noqa: E402

insp = inspect(engine)
tables = insp.get_table_names()

if not tables:
    Base.metadata.create_all(engine)
    sys.stdout.write("CREATED\n")
else:
    sys.stdout.write(f"OK:{len(tables)}\n")
