"""Política de Privacidade v1.3 — DPO formalmente designado

Revision ID: 013_privacy_v1_3_dpo
Revises: 012_add_analista_role
Create Date: 2026-03-20

Mudança em relação à v1.2:
  - Seção 1: nome e e-mail do DPO preenchidos
  - Seção 8: canal de contato atualizado para o DPO designado
  - Seção 9: e-mail de exclusão de conta atualizado
  - Seção 13: redação alterada de "em processo de designação" para
    "designou formalmente" — LGPD art. 41 cumprido
  - Seção 15: contato atualizado

DPO: Elias Sales de Freitas <oeliasandraade@gmail.com>

Apenas a Política de Privacidade muda; os Termos de Uso permanecem em v1.2.
Todos os usuários serão solicitados a aceitar a nova Política de Privacidade.
"""

import uuid
from datetime import datetime, timezone
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from app.legal_content import PRIVACY_V1_3

revision: str = "013_privacy_v1_3_dpo"
down_revision: Union[str, None] = "012_add_analista_role"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

PUBLISHED_AT = datetime(2026, 3, 20, 0, 0, 0, tzinfo=timezone.utc)


def upgrade() -> None:
    conn = op.get_bind()

    existing = conn.execute(
        sa.text("SELECT id FROM legal_documents WHERE type = 'PRIVACY' AND version = '1.3'")
    ).fetchone()

    if existing:
        conn.execute(
            sa.text(
                "UPDATE legal_documents SET content = :c WHERE type = 'PRIVACY' AND version = '1.3'"
            ),
            {"c": PRIVACY_V1_3},
        )
    else:
        conn.execute(
            sa.text(
                "INSERT INTO legal_documents (id, type, version, content, published_at) "
                "VALUES (:id, :type, :version, :content, :published_at)"
            ),
            {
                "id": str(uuid.uuid4()),
                "type": "PRIVACY",
                "version": "1.3",
                "content": PRIVACY_V1_3,
                "published_at": PUBLISHED_AT,
            },
        )


def downgrade() -> None:
    op.execute("DELETE FROM legal_documents WHERE version = '1.3' AND type = 'PRIVACY'")
