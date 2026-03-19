"""Seed de dados base para ambiente DEV. Idempotente."""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.db.session import SessionLocal
from app.db.models import GlobalRole, LegalDocument, ProfileCatalog, ProfileCatalogItem
from sqlalchemy import select

db = SessionLocal()
try:
    counts = {"roles": 0, "docs": 0, "catalogs": 0, "items": 0}

    for code, name in [
        ("DEV", "Desenvolvedor"),
        ("ADMIN", "Administrador"),
        ("SECRETARY", "Secretario Geral"),
    ]:
        if not db.execute(select(GlobalRole).where(GlobalRole.code == code)).scalar_one_or_none():
            db.add(GlobalRole(code=code, name=name))
            counts["roles"] += 1

    for t, v, c in [
        ("TERMS", "1.0", "Termos de Uso Lumen+"),
        ("PRIVACY", "1.0", "Politica de Privacidade Lumen+"),
    ]:
        if not db.execute(
            select(LegalDocument).where(LegalDocument.type == t, LegalDocument.version == v)
        ).scalar_one_or_none():
            db.add(LegalDocument(type=t, version=v, content=c))
            counts["docs"] += 1

    catalogs_seed = [
        (
            "LIFE_STATE",
            "Estado de Vida",
            [
                "Leigo",
                "Leigo Consagrado",
                "Novica",
                "Seminarista",
                "Religioso",
                "Diacono Permanente",
                "Diacono",
                "Sacerdote Religioso",
                "Sacerdote Diocesano",
                "Bispo",
            ],
        ),
        (
            "MARITAL_STATUS",
            "Estado Civil",
            [
                "Solteiro",
                "Noivo",
                "Casado",
                "Divorciado",
                "Viuvo",
                "Uniao Estavel",
            ],
        ),
        (
            "VOCATIONAL_REALITY",
            "Realidade Vocacional",
            [
                "Membro do Acolhida",
                "Membro do Aprofundamento",
                "Vocacional",
                "Postulante de Primeiro Ano",
                "Postulante de Segundo Ano",
                "Discipulo Vocacional",
                "Consagrado Filho da Luz",
            ],
        ),
    ]
    existing = {c.code for c in db.execute(select(ProfileCatalog)).scalars().all()}
    for code, name, items in catalogs_seed:
        if code not in existing:
            cat = ProfileCatalog(code=code, name=name)
            db.add(cat)
            db.flush()
            counts["catalogs"] += 1
            for i, lbl in enumerate(items):
                db.add(
                    ProfileCatalogItem(
                        catalog_id=cat.id,
                        code=lbl.upper().replace(" ", "_")[:50],
                        label=lbl,
                        sort_order=i,
                    )
                )
                counts["items"] += 1

    db.commit()
    print(
        f"roles={counts['roles']} docs={counts['docs']} catalogs={counts['catalogs']} items={counts['items']}"
    )
finally:
    db.close()
