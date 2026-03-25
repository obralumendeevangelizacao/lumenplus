import logging
import time
from dataclasses import dataclass
from typing import cast

import httpx
from cachetools import TTLCache  # type: ignore[import-untyped]
from jose import jwt
from jose.exceptions import JWTError

FIREBASE_CERTS_URL = (
    "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"
)

_certs_cache: TTLCache[str, dict[str, str]] = TTLCache(maxsize=1, ttl=3600)
logger = logging.getLogger(__name__)


@dataclass
class TokenPayload:
    uid: str
    email: str | None
    email_verified: bool
    provider: str


class FirebaseAuth:
    """
    Verifica tokens Firebase Auth.

    ISOLAMENTO DEV vs PROD:
      - dev_mode=True  : ativado SOMENTE quando AUTH_MODE=DEV nas settings.
                         Aceita tokens no formato "dev:<uid>:<email>" e JWTs sem verificação.
                         NUNCA deve estar True em produção (validate_production_settings() detecta isso).
      - dev_mode=False : caminho de produção — exige JWT RS256 válido assinado pelo Firebase.

    A instância singleton é criada em app/api/deps.py com:
        FirebaseAuth(project_id=..., dev_mode=(settings.auth_mode == "DEV"))
    """

    def __init__(self, project_id: str, dev_mode: bool = False):
        self.project_id = project_id
        self.dev_mode = dev_mode
        self._issuer = f"https://securetoken.google.com/{project_id}"

        if dev_mode:
            logger.warning(
                "FirebaseAuth: modo DEV ativo. "
                "Tokens 'dev:<uid>:<email>' são aceitos SEM VERIFICAÇÃO. "
                "Garanta que AUTH_MODE=DEV nunca seja usado em produção."
            )

    def verify_token(self, token: str) -> TokenPayload:
        """
        Ponto de entrada principal.
        Despacha para DEV ou PROD conforme o modo configurado.
        """
        if self.dev_mode:
            return self._verify_dev_token(token)
        # Caminho de produção: rejeita explicitamente qualquer token com prefixo "dev:"
        if token.startswith("dev:"):
            raise ValueError(
                "Tokens com prefixo 'dev:' são rejeitados em modo PROD. "
                "Configure AUTH_MODE=DEV apenas em ambiente de desenvolvimento."
            )
        return self._verify_production_token(token)

    def _verify_dev_token(self, token: str) -> TokenPayload:
        """
        DEV ONLY: aceita dois formatos:
          1. "dev:<uid>:<email>"  — formato de teste rápido (CLI/curl)
          2. JWT qualquer         — decodificado sem verificação de assinatura (útil com emulador Firebase)

        AVISO: Este método NÃO valida assinaturas. Use apenas em DEV.
        """
        # Formato 1: dev:<uid>:<email>
        if token.startswith("dev:"):
            parts = token.split(":", 2)
            uid = parts[1] if len(parts) > 1 and parts[1] else "dev-user"
            email = parts[2] if len(parts) > 2 and parts[2] else "dev@example.com"
            return TokenPayload(
                uid=uid,
                email=email,
                email_verified=True,
                provider="firebase",
            )

        # Formato 2: JWT sem verificação de assinatura (emulador Firebase ou tokens de teste)
        try:
            unverified = jwt.get_unverified_claims(token)
            uid = unverified.get("sub") or unverified.get("user_id")
            if not uid:
                raise ValueError("JWT sem campo 'sub'/'user_id'")
            logger.debug("FirebaseAuth DEV: aceitando JWT sem verificacao de assinatura")
            return TokenPayload(
                uid=uid,
                email=unverified.get("email"),
                email_verified=bool(unverified.get("email_verified", False)),
                provider="firebase",
            )
        except (JWTError, ValueError) as exc:
            # Em DEV, JWT malformado vira erro explícito (não mais fallback silencioso)
            raise ValueError(
                f"Token invalido em modo DEV: {exc}. "
                "Use o formato 'dev:<uid>:<email>' ou um JWT valido."
            ) from exc

    def _verify_production_token(self, token: str) -> TokenPayload:
        try:
            unverified_header = jwt.get_unverified_header(token)
        except JWTError as e:
            raise ValueError(f"Invalid token header: {e}")

        kid = unverified_header.get("kid")
        if not kid:
            raise ValueError("Token missing key ID")

        public_keys = self._get_firebase_public_keys()
        public_key = public_keys.get(kid)
        if not public_key:
            raise ValueError("Unknown key ID")

        try:
            payload = jwt.decode(
                token,
                public_key,
                algorithms=["RS256"],
                audience=self.project_id,
                issuer=self._issuer,
            )
        except JWTError as e:
            raise ValueError(f"Token verification failed: {e}")

        if payload.get("exp", 0) < time.time():
            raise ValueError("Token expired")

        if payload.get("iat", float("inf")) > time.time():
            raise ValueError("Token issued in the future")

        uid = payload.get("sub") or payload.get("user_id")
        if not uid:
            raise ValueError("Token missing user ID")

        return TokenPayload(
            uid=uid,
            email=payload.get("email"),
            email_verified=payload.get("email_verified", False),
            provider="firebase",
        )

    def _get_firebase_public_keys(self) -> dict[str, str]:
        cache_key = "firebase_certs"

        if cache_key in _certs_cache:
            return cast(dict[str, str], _certs_cache[cache_key])

        try:
            response = httpx.get(FIREBASE_CERTS_URL, timeout=10.0)
            response.raise_for_status()
            keys: dict[str, str] = response.json()
            _certs_cache[cache_key] = keys
            return keys
        except Exception as e:
            raise ValueError(f"Failed to fetch Firebase public keys: {e}")
