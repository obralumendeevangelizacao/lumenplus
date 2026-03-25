"""Publica Termos e Privacidade v1.2 — textos definitivos com dados reais da Obra

Revision ID: 011_legal_documents_v1_2
Revises: 010_legal_documents_v1_1
Create Date: 2026-03-19

Diferença em relação à v1.1:
  - CNPJ preenchido: 19.614.384/0001-60
  - Endereço preenchido: Rua Coronel Jucá, 2040, Meireles, Fortaleza/CE
  - Seção DPO atualizada: processo de designação em andamento
  - v1.0 e v1.1 tinham placeholders "[INSERIR ...]"

Todos os usuários serão solicitados a aceitar novamente (novo document_id).
"""

import uuid
from datetime import datetime, timezone
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from app.legal_content import TERMS_V1_2, PRIVACY_V1_2

revision: str = "011_legal_documents_v1_2"
down_revision: Union[str, None] = "010_legal_documents_v1_1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

PUBLISHED_AT = datetime(2026, 3, 19, 0, 0, 2, tzinfo=timezone.utc)


def upgrade() -> None:
    conn = op.get_bind()

    for doc_type, content in [("TERMS", TERMS_V1_2), ("PRIVACY", PRIVACY_V1_2)]:
        existing = conn.execute(
            sa.text("SELECT id FROM legal_documents WHERE type = :t AND version = '1.2'"),
            {"t": doc_type},
        ).fetchone()

        if existing:
            conn.execute(
                sa.text(
                    "UPDATE legal_documents SET content = :c WHERE type = :t AND version = '1.2'"
                ),
                {"c": content, "t": doc_type},
            )
        else:
            conn.execute(
                sa.text(
                    "INSERT INTO legal_documents (id, type, version, content, published_at) "
                    "VALUES (:id, :type, :version, :content, :published_at)"
                ),
                {
                    "id": str(uuid.uuid4()),
                    "type": doc_type,
                    "version": "1.2",
                    "content": content,
                    "published_at": PUBLISHED_AT,
                },
            )


def downgrade() -> None:
    op.execute("DELETE FROM legal_documents WHERE version = '1.2' AND type IN ('TERMS', 'PRIVACY')")
