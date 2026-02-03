"""Development-only endpoints with Phase 1 seed."""

from uuid import UUID

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel

from app.api.deps import CurrentUser, DBSession
from app.audit.service import create_audit_log
from app.db.models import OrgRole, OrgUnit, OrgUnitType

router = APIRouter(prefix="/dev", tags=["Development"])


# =============================================================================
# Models for Phase 1 (imported dynamically to avoid circular imports)
# =============================================================================
def get_phase1_models():
    """Get Phase 1 models if they exist."""
    try:
        from app.db.models import GlobalRole, UserGlobalRole, ProfileCatalog, ProfileCatalogItem, LegalDocument
        return {
            "GlobalRole": GlobalRole,
            "UserGlobalRole": UserGlobalRole,
            "ProfileCatalog": ProfileCatalog,
            "ProfileCatalogItem": ProfileCatalogItem,
            "LegalDocument": LegalDocument,
        }
    except ImportError:
        return None


class CreateOrgUnitRequest(BaseModel):
    type: str
    name: str
    slug: str
    parent_id: UUID | None = None


class OrgUnitResponse(BaseModel):
    id: UUID
    type: str
    name: str
    slug: str
    parent_id: UUID | None
    is_active: bool


@router.post("/org-units", response_model=OrgUnitResponse, status_code=status.HTTP_201_CREATED)
async def create_org_unit(
    request: Request,
    body: CreateOrgUnitRequest,
    db: DBSession,
    current_user: CurrentUser,
) -> OrgUnitResponse:
    try:
        org_type = OrgUnitType(body.type)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "bad_request", "message": f"Invalid type: {body.type}"},
        )

    existing = db.query(OrgUnit).filter(OrgUnit.slug == body.slug).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error": "conflict", "message": f"Slug already exists: {body.slug}"},
        )

    if org_type == OrgUnitType.MINISTRY:
        if not body.parent_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"error": "bad_request", "message": "MINISTRY requires a parent_id"},
            )
        parent = db.query(OrgUnit).filter(OrgUnit.id == body.parent_id).first()
        if not parent or parent.type != OrgUnitType.SECTOR:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"error": "bad_request", "message": "MINISTRY parent must be a SECTOR"},
            )

    if org_type == OrgUnitType.SECTOR and body.parent_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "bad_request", "message": "SECTOR cannot have a parent"},
        )

    org_unit = OrgUnit(
        type=org_type,
        name=body.name,
        slug=body.slug,
        parent_id=body.parent_id,
        created_by_user_id=current_user.id,
        is_active=True,
    )
    db.add(org_unit)

    create_audit_log(
        db=db,
        actor_user_id=current_user.id,
        action="org_unit_created",
        entity_type="org_unit",
        entity_id=str(org_unit.id),
        ip=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        metadata={"type": org_type.value, "name": body.name, "slug": body.slug},
    )

    db.commit()
    db.refresh(org_unit)

    return OrgUnitResponse(
        id=org_unit.id,
        type=org_unit.type.value,
        name=org_unit.name,
        slug=org_unit.slug,
        parent_id=org_unit.parent_id,
        is_active=org_unit.is_active,
    )


class SeedResponse(BaseModel):
    message: str
    org_roles_created: int
    org_units_created: int
    global_roles_created: int
    catalogs_created: int
    catalog_items_created: int
    legal_docs_created: int


@router.post("/seed", response_model=SeedResponse)
async def seed_data(request: Request, db: DBSession, current_user: CurrentUser) -> SeedResponse:
    """Seed all required data for development (Phase 0 + Phase 1)."""
    roles_created = 0
    units_created = 0
    global_roles_created = 0
    catalogs_created = 0
    catalog_items_created = 0
    legal_docs_created = 0

    # =========================================================================
    # PHASE 0: Org Roles
    # =========================================================================
    existing_roles = {r.code for r in db.query(OrgRole).all()}
    default_roles = [
        {"code": "MEMBER", "name": "Membro"},
        {"code": "COORDINATOR", "name": "Coordenador"},
    ]
    for role_data in default_roles:
        if role_data["code"] not in existing_roles:
            role = OrgRole(code=role_data["code"], name=role_data["name"])
            db.add(role)
            roles_created += 1
    db.flush()

    # =========================================================================
    # PHASE 0: Org Units
    # =========================================================================
    existing_slugs = {u.slug for u in db.query(OrgUnit).all()}
    sample_data = [
        {"type": OrgUnitType.SECTOR, "name": "Setor de Formação", "slug": "formacao", "parent": None},
        {"type": OrgUnitType.SECTOR, "name": "Setor de Liturgia", "slug": "liturgia", "parent": None},
        {"type": OrgUnitType.MINISTRY, "name": "Ministério de Catequese", "slug": "catequese", "parent": "formacao"},
        {"type": OrgUnitType.MINISTRY, "name": "Ministério de Casais", "slug": "casais", "parent": "formacao"},
        {"type": OrgUnitType.MINISTRY, "name": "Ministério de Música", "slug": "musica", "parent": "liturgia"},
        {"type": OrgUnitType.GROUP, "name": "Grupo de Jovens", "slug": "jovens", "parent": None},
        {"type": OrgUnitType.GROUP, "name": "Grupo de Oração", "slug": "oracao", "parent": None},
    ]
    slug_to_id: dict[str, UUID] = {}
    for item in sample_data:
        if item["slug"] in existing_slugs:
            existing = db.query(OrgUnit).filter(OrgUnit.slug == item["slug"]).first()
            if existing:
                slug_to_id[item["slug"]] = existing.id
            continue
        parent_id = slug_to_id.get(item["parent"]) if item["parent"] else None
        org_unit = OrgUnit(
            type=item["type"],
            name=item["name"],
            slug=item["slug"],
            parent_id=parent_id,
            created_by_user_id=current_user.id,
            is_active=True,
        )
        db.add(org_unit)
        db.flush()
        slug_to_id[item["slug"]] = org_unit.id
        units_created += 1

    # =========================================================================
    # PHASE 1: Global Roles, Catalogs, Legal Docs
    # =========================================================================
    models = get_phase1_models()
    
    if models:
        GlobalRole = models["GlobalRole"]
        ProfileCatalog = models["ProfileCatalog"]
        ProfileCatalogItem = models["ProfileCatalogItem"]
        LegalDocument = models["LegalDocument"]

        # Global Roles
        existing_global = {r.code for r in db.query(GlobalRole).all()}
        global_roles_data = [
            {"code": "DEV", "name": "Desenvolvedor"},
            {"code": "COUNCIL_GENERAL", "name": "Conselho Geral"},
            {"code": "SECRETARY", "name": "Secretaria"},
            {"code": "COMMS", "name": "Comunicação"},
        ]
        for role_data in global_roles_data:
            if role_data["code"] not in existing_global:
                role = GlobalRole(code=role_data["code"], name=role_data["name"])
                db.add(role)
                global_roles_created += 1
        db.flush()

        # Profile Catalogs
        catalogs_data = {
            "LIFE_STATE": {
                "name": "Estado de Vida",
                "items": [
                    "Leigo",
                    "Leigo Consagrado", 
                    "Noviça",
                    "Seminarista",
                    "Religioso",
                    "Diácono Permanente",
                    "Diácono",
                    "Sacerdote Religioso",
                    "Sacerdote Diocesano",
                    "Bispo",
                ],
            },
            "MARITAL_STATUS": {
                "name": "Estado Civil",
                "items": [
                    "Solteiro",
                    "Noivo",
                    "Casado",
                    "Divorciado",
                    "Viúvo",
                    "União Estável",
                ],
            },
            "VOCATIONAL_REALITY": {
                "name": "Realidade Vocacional",
                "items": [
                    "Membro do Acolhida",
                    "Membro do Aprofundamento",
                    "Vocacional",
                    "Postulante de Primeiro Ano",
                    "Postulante de Segundo Ano",
                    "Discípulo Vocacional",
                    "Consagrado Filho da Luz",
                ],
            },
        }

        existing_catalogs = {c.code for c in db.query(ProfileCatalog).all()}
        
        for code, data in catalogs_data.items():
            if code in existing_catalogs:
                continue
            
            catalog = ProfileCatalog(code=code, name=data["name"])
            db.add(catalog)
            db.flush()
            catalogs_created += 1

            for i, label in enumerate(data["items"]):
                # Create a safe code from label
                item_code = (
                    label.upper()
                    .replace(" ", "_")
                    .replace("Ã", "A")
                    .replace("Ç", "C")
                    .replace("Á", "A")
                    .replace("É", "E")
                    .replace("Í", "I")
                    .replace("Ó", "O")
                    .replace("Ú", "U")
                    .replace("Â", "A")
                    .replace("Ê", "E")
                    .replace("Ô", "O")
                )[:50]
                
                item = ProfileCatalogItem(
                    catalog_id=catalog.id,
                    code=item_code,
                    label=label,
                    sort_order=i,
                    is_active=True,
                )
                db.add(item)
                catalog_items_created += 1
        
        db.flush()

        # Legal Documents
        existing_terms = db.query(LegalDocument).filter(LegalDocument.type == "TERMS").first()
        existing_privacy = db.query(LegalDocument).filter(LegalDocument.type == "PRIVACY").first()

        if not existing_terms:
            terms = LegalDocument(
                type="TERMS",
                version="1.0",
                content="""TERMOS DE USO DO APLICATIVO LUMEN+

1. ACEITAÇÃO DOS TERMOS
Ao utilizar o aplicativo Lumen+, você concorda com estes Termos de Uso.

2. DESCRIÇÃO DO SERVIÇO
O Lumen+ é um aplicativo de gestão para comunidades católicas, oferecendo recursos de cadastro, formação e comunicação.

3. CADASTRO
O usuário é responsável pela veracidade das informações fornecidas no cadastro.

4. PRIVACIDADE
Seus dados são tratados conforme nossa Política de Privacidade e a Lei Geral de Proteção de Dados (LGPD).

5. USO ADEQUADO
O usuário compromete-se a utilizar o aplicativo de forma ética e respeitosa.

6. ALTERAÇÕES
Estes termos podem ser alterados a qualquer momento, com notificação prévia aos usuários.

Data de vigência: Janeiro de 2025
""",
            )
            db.add(terms)
            legal_docs_created += 1

        if not existing_privacy:
            privacy = LegalDocument(
                type="PRIVACY",
                version="1.0",
                content="""POLÍTICA DE PRIVACIDADE DO APLICATIVO LUMEN+

1. DADOS COLETADOS
- Dados de identificação: nome, CPF, RG, data de nascimento
- Dados de contato: telefone, email, endereço
- Dados de emergência: contato de emergência
- Dados vocacionais: estado de vida, estado civil, realidade vocacional

2. FINALIDADE
Os dados são utilizados exclusivamente para:
- Gestão de membros da comunidade
- Comunicação institucional
- Organização de eventos e retiros
- Acompanhamento formativo

3. PROTEÇÃO DE DADOS SENSÍVEIS
CPF e RG são armazenados de forma criptografada e acessíveis apenas por pessoal autorizado mediante aprovação.

4. COMPARTILHAMENTO
Seus dados não são compartilhados com terceiros, exceto quando exigido por lei.

5. SEUS DIREITOS (LGPD)
Você tem direito a: acesso, correção, exclusão, portabilidade e revogação do consentimento.

6. CONTATO
Para exercer seus direitos ou tirar dúvidas: privacidade@lumenplus.app

Data de vigência: Janeiro de 2025
""",
            )
            db.add(privacy)
            legal_docs_created += 1

    db.commit()

    return SeedResponse(
        message="Seed completed successfully",
        org_roles_created=roles_created,
        org_units_created=units_created,
        global_roles_created=global_roles_created,
        catalogs_created=catalogs_created,
        catalog_items_created=catalog_items_created,
        legal_docs_created=legal_docs_created,
    )


class AssignGlobalRoleRequest(BaseModel):
    user_id: UUID
    role_code: str


class AssignGlobalRoleResponse(BaseModel):
    message: str
    user_id: UUID
    role_code: str


@router.post("/assign-global-role", response_model=AssignGlobalRoleResponse)
async def assign_global_role(
    body: AssignGlobalRoleRequest,
    current_user: CurrentUser,
    db: DBSession,
) -> AssignGlobalRoleResponse:
    """Assign a global role to a user (DEV only)."""
    models = get_phase1_models()
    if not models:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail={"error": "not_implemented", "message": "Phase 1 models not available"},
        )
    
    GlobalRole = models["GlobalRole"]
    UserGlobalRole = models["UserGlobalRole"]

    role = db.query(GlobalRole).filter(GlobalRole.code == body.role_code).first()
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "not_found", "message": f"Role {body.role_code} not found"},
        )

    existing = (
        db.query(UserGlobalRole)
        .filter(
            UserGlobalRole.user_id == body.user_id,
            UserGlobalRole.global_role_id == role.id,
        )
        .first()
    )

    if existing:
        return AssignGlobalRoleResponse(
            message="Role already assigned",
            user_id=body.user_id,
            role_code=body.role_code,
        )

    assignment = UserGlobalRole(
        user_id=body.user_id,
        global_role_id=role.id,
        granted_by_user_id=current_user.id,
    )
    db.add(assignment)
    db.commit()

    return AssignGlobalRoleResponse(
        message="Role assigned successfully",
        user_id=body.user_id,
        role_code=body.role_code,
    )