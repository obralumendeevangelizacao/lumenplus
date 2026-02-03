"""Fix catalogs and add profile fields

Revision ID: 003_fix_catalogs_profile
Revises: 002_phase1_cadastro
Create Date: 2025-02-01

Corrige os catálogos para os valores corretos:
- Estado de Vida: Leigo, Leigo Consagrado, Noviça, Seminarista, Religioso, 
  Diácono Permanente, Diácono, Sacerdote Religioso, Sacerdote Diocesano, Bispo
- Estado Civil: Solteiro, Noivo, Casado, Divorciado, Viúvo, União Estável
- Realidade Vocacional: Membro do Acolhida, Membro do Aprofundamento, Vocacional,
  Postulante de Primeiro Ano, Postulante de Segundo Ano, Discípulo Vocacional,
  Consagrado Filho da Luz

Adiciona campos faltantes no perfil:
- photo_url: URL da foto do usuário
- consecration_year: Ano de consagração (se Consagrado Filho da Luz)
- has_vocational_accompaniment: Se faz acompanhamento vocacional
- vocational_accompanist_user_id: ID do acompanhador (se usuário do sistema)
- vocational_accompanist_name: Nome do acompanhador (se não for usuário)
- interested_in_ministry: Se tem interesse em servir em ministério
- interested_ministry_id: ID do ministério de interesse
- ministry_interest_notes: Observações sobre interesse em ministério
"""

from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "003_fix_catalogs_profile"
down_revision: Union[str, None] = "002_phase1_cadastro"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # =========================================================================
    # 1. ADICIONAR COLUNAS FALTANTES NO USER_PROFILES
    # =========================================================================
    
    # Foto do usuário
    op.add_column("user_profiles", sa.Column("photo_url", sa.Text(), nullable=True))
    
    # Ano de consagração (se Consagrado Filho da Luz)
    op.add_column("user_profiles", sa.Column("consecration_year", sa.Integer(), nullable=True))
    
    # Acompanhamento Vocacional
    op.add_column("user_profiles", sa.Column("has_vocational_accompaniment", sa.Boolean(), nullable=True))
    op.add_column("user_profiles", sa.Column("vocational_accompanist_user_id", sa.UUID(), nullable=True))
    op.add_column("user_profiles", sa.Column("vocational_accompanist_name", sa.Text(), nullable=True))
    
    # Interesse em Ministério
    op.add_column("user_profiles", sa.Column("interested_in_ministry", sa.Boolean(), nullable=True))
    op.add_column("user_profiles", sa.Column("interested_ministry_id", sa.UUID(), nullable=True))
    op.add_column("user_profiles", sa.Column("ministry_interest_notes", sa.Text(), nullable=True))
    
    # Foreign keys
    op.create_foreign_key(
        "fk_profile_vocational_accompanist",
        "user_profiles", "users",
        ["vocational_accompanist_user_id"], ["id"],
        ondelete="SET NULL"
    )
    op.create_foreign_key(
        "fk_profile_interested_ministry",
        "user_profiles", "org_units",
        ["interested_ministry_id"], ["id"],
        ondelete="SET NULL"
    )
    
    # =========================================================================
    # 2. POPULAR CATÁLOGOS COM VALORES CORRETOS
    # =========================================================================
    
    # Primeiro, limpar os catálogos existentes (se houver)
    op.execute("DELETE FROM profile_catalog_items")
    op.execute("DELETE FROM profile_catalogs")
    
    # Inserir catálogos
    op.execute("""
        INSERT INTO profile_catalogs (id, code, name) VALUES
        (gen_random_uuid(), 'LIFE_STATE', 'Estado de Vida'),
        (gen_random_uuid(), 'MARITAL_STATUS', 'Estado Civil'),
        (gen_random_uuid(), 'VOCATIONAL_REALITY', 'Realidade Vocacional')
    """)
    
    # -------------------------------------------------------------------------
    # ESTADO DE VIDA
    # -------------------------------------------------------------------------
    op.execute("""
        INSERT INTO profile_catalog_items (id, catalog_id, code, label, sort_order)
        SELECT 
            gen_random_uuid(),
            (SELECT id FROM profile_catalogs WHERE code = 'LIFE_STATE'),
            item.code,
            item.label,
            item.sort_order
        FROM (VALUES
            ('LEIGO', 'Leigo', 1),
            ('LEIGO_CONSAGRADO', 'Leigo Consagrado', 2),
            ('NOVICA', 'Noviça', 3),
            ('SEMINARISTA', 'Seminarista', 4),
            ('RELIGIOSO', 'Religioso', 5),
            ('DIACONO_PERMANENTE', 'Diácono Permanente', 6),
            ('DIACONO', 'Diácono', 7),
            ('SACERDOTE_RELIGIOSO', 'Sacerdote Religioso', 8),
            ('SACERDOTE_DIOCESANO', 'Sacerdote Diocesano', 9),
            ('BISPO', 'Bispo', 10)
        ) AS item(code, label, sort_order)
    """)
    
    # -------------------------------------------------------------------------
    # ESTADO CIVIL
    # -------------------------------------------------------------------------
    op.execute("""
        INSERT INTO profile_catalog_items (id, catalog_id, code, label, sort_order)
        SELECT 
            gen_random_uuid(),
            (SELECT id FROM profile_catalogs WHERE code = 'MARITAL_STATUS'),
            item.code,
            item.label,
            item.sort_order
        FROM (VALUES
            ('SOLTEIRO', 'Solteiro', 1),
            ('NOIVO', 'Noivo', 2),
            ('CASADO', 'Casado', 3),
            ('DIVORCIADO', 'Divorciado', 4),
            ('VIUVO', 'Viúvo', 5),
            ('UNIAO_ESTAVEL', 'União Estável', 6)
        ) AS item(code, label, sort_order)
    """)
    
    # -------------------------------------------------------------------------
    # REALIDADE VOCACIONAL
    # -------------------------------------------------------------------------
    op.execute("""
        INSERT INTO profile_catalog_items (id, catalog_id, code, label, sort_order)
        SELECT 
            gen_random_uuid(),
            (SELECT id FROM profile_catalogs WHERE code = 'VOCATIONAL_REALITY'),
            item.code,
            item.label,
            item.sort_order
        FROM (VALUES
            ('MEMBRO_ACOLHIDA', 'Membro do Acolhida', 1),
            ('MEMBRO_APROFUNDAMENTO', 'Membro do Aprofundamento', 2),
            ('VOCACIONAL', 'Vocacional', 3),
            ('POSTULANTE_PRIMEIRO_ANO', 'Postulante de Primeiro Ano', 4),
            ('POSTULANTE_SEGUNDO_ANO', 'Postulante de Segundo Ano', 5),
            ('DISCIPULO_VOCACIONAL', 'Discípulo Vocacional', 6),
            ('CONSAGRADO_FILHO_DA_LUZ', 'Consagrado Filho da Luz', 7)
        ) AS item(code, label, sort_order)
    """)
    
    # =========================================================================
    # 3. ADICIONAR TABELA DE VERIFICAÇÃO DE EMAIL
    # =========================================================================
    op.create_table(
        "email_verifications",
        sa.Column("id", sa.UUID(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("email", sa.Text(), nullable=False),
        sa.Column("token_hash", sa.Text(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    # Drop email verifications table
    op.drop_table("email_verifications")
    
    # Drop foreign keys
    op.drop_constraint("fk_profile_interested_ministry", "user_profiles", type_="foreignkey")
    op.drop_constraint("fk_profile_vocational_accompanist", "user_profiles", type_="foreignkey")
    
    # Drop columns
    op.drop_column("user_profiles", "ministry_interest_notes")
    op.drop_column("user_profiles", "interested_ministry_id")
    op.drop_column("user_profiles", "interested_in_ministry")
    op.drop_column("user_profiles", "vocational_accompanist_name")
    op.drop_column("user_profiles", "vocational_accompanist_user_id")
    op.drop_column("user_profiles", "has_vocational_accompaniment")
    op.drop_column("user_profiles", "consecration_year")
    op.drop_column("user_profiles", "photo_url")
