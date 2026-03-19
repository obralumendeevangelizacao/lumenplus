"""Publica Termos e Privacidade v1.1 — força re-aceitação de todos os usuários

Revision ID: 010_legal_documents_v1_1
Revises: 009_legal_documents_v1
Create Date: 2026-03-19

Por que v1.1?
  A migration 009 fez UPSERT na v1.0, mantendo o mesmo document_id.
  Usuários que aceitaram o placeholder antes da 009 continuaram marcados
  como "ok". A v1.1 é um novo documento (novo ID), então todo usuário
  existente ficará com pending_terms=True e pending_privacy=True até
  aceitar novamente pelo app.
"""

import uuid
from datetime import datetime, timezone
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from app.legal_content import TERMS_V1_1, PRIVACY_V1_1

revision: str = "010_legal_documents_v1_1"
down_revision: Union[str, None] = "009_legal_documents_v1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

PUBLISHED_AT = datetime(2026, 3, 19, 0, 0, 1, tzinfo=timezone.utc)


def upgrade() -> None:
    conn = op.get_bind()

    for doc_type, content in [("TERMS", TERMS_V1_1), ("PRIVACY", PRIVACY_V1_1)]:
        existing = conn.execute(
            sa.text(
                "SELECT id FROM legal_documents WHERE type = :t AND version = '1.1'"
            ),
            {"t": doc_type},
        ).fetchone()

        if existing:
            conn.execute(
                sa.text(
                    "UPDATE legal_documents SET content = :c WHERE type = :t AND version = '1.1'"
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
                    "version": "1.1",
                    "content": content,
                    "published_at": PUBLISHED_AT,
                },
            )


def downgrade() -> None:
    op.execute(
        "DELETE FROM legal_documents WHERE version = '1.1' AND type IN ('TERMS', 'PRIVACY')"
    )
