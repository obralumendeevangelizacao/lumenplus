"""Database session management."""

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.settings import settings

# SQLite (usado nos testes) não suporta pool_size/max_overflow.
# Para qualquer outro banco (PostgreSQL em dev/prod) os parâmetros são aplicados.
_is_sqlite = settings.database_url.startswith("sqlite")

engine = create_engine(
    settings.database_url,
    pool_pre_ping=not _is_sqlite,
    **({} if _is_sqlite else {"pool_size": settings.database_pool_size, "max_overflow": settings.database_max_overflow}),
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    """Dependency para obter sessão do banco."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
