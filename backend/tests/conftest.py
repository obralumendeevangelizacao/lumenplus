"""
Test Configuration
==================
Fixtures e configurações para pytest.
"""

import os
from typing import Generator
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

# Configura ambiente de teste ANTES de importar app
os.environ["ENVIRONMENT"] = "test"
os.environ["AUTH_MODE"] = "DEV"
os.environ["ENABLE_DEV_ENDPOINTS"] = "true"
os.environ["DEBUG_VERIFICATION_CODE"] = "true"
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["ENCRYPTION_KEY"] = "dGVzdC1lbmNyeXB0aW9uLWtleS0zMi1ieXRlcyE="  # 32 bytes base64
os.environ["HMAC_PEPPER"] = "dGVzdC1obWFjLXBlcHBlci0zMi1ieXRlcyEh"  # 32 bytes base64

from app.db.models import Base
from app.db.session import get_db
from app.main import app


# =============================================================================
# DATABASE FIXTURES
# =============================================================================
@pytest.fixture(scope="function")
def db_engine():
    """Cria engine de teste em memória."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def db_session(db_engine) -> Generator[Session, None, None]:
    """Cria sessão de teste."""
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=db_engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture(scope="function")
def client(db_session: Session) -> Generator[TestClient, None, None]:
    """Cliente de teste com banco isolado."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass
    
    app.dependency_overrides[get_db] = override_get_db
    
    with TestClient(app) as test_client:
        yield test_client
    
    app.dependency_overrides.clear()


# =============================================================================
# AUTH FIXTURES
# =============================================================================
@pytest.fixture
def auth_headers() -> dict:
    """Headers de autenticação para usuário de teste."""
    return {"Authorization": "Bearer dev:test-user:test@example.com"}


@pytest.fixture
def admin_headers() -> dict:
    """Headers de autenticação para admin."""
    return {"Authorization": "Bearer dev:admin:admin@example.com"}


@pytest.fixture
def secretary_headers() -> dict:
    """Headers de autenticação para secretaria."""
    return {"Authorization": "Bearer dev:secretary:secretary@example.com"}


# =============================================================================
# DATA FIXTURES
# =============================================================================
@pytest.fixture
def seeded_db(client: TestClient, admin_headers: dict) -> None:
    """Popula banco com dados de seed."""
    response = client.post("/dev/seed", headers=admin_headers)
    assert response.status_code == 200


@pytest.fixture
def sample_profile_data() -> dict:
    """Dados de perfil para testes."""
    return {
        "full_name": "João da Silva",
        "birth_date": "1990-01-15",
        "cpf": "123.456.789-00",
        "rg": "12.345.678-9",
        "phone_e164": "+5511999999999",
        "city": "São Paulo",
        "state": "SP",
        "life_state_item_id": None,  # Será preenchido após seed
        "marital_status_item_id": None,
        "vocational_reality_item_id": None,
    }
