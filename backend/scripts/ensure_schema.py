"""Cria tabelas se o schema estiver vazio. Idempotente."""
import sys, os, logging
# Silencia warnings do app durante a checagem
logging.disable(logging.CRITICAL)
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.db.session import engine
from app.db.models import Base
from sqlalchemy import inspect

insp = inspect(engine)
tables = insp.get_table_names()

if not tables:
    Base.metadata.create_all(engine)
    sys.stdout.write("CREATED\n")
else:
    sys.stdout.write(f"OK:{len(tables)}\n")
