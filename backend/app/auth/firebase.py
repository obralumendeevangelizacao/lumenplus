import time
from dataclasses import dataclass

import httpx
from cachetools import TTLCache
from jose import jwt
from jose.exceptions import JWTError

FIREBASE_CERTS_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"

_certs_cache: TTLCache[str, dict[str, str]] = TTLCache(maxsize=1, ttl=3600)


@dataclass
class TokenPayload:
    uid: str
    email: str | None
    email_verified: bool
    provider: str


class FirebaseAuth:
    def __init__(self, project_id: str, dev_mode: bool = False):
        self.project_id = project_id
        self.dev_mode = dev_mode
        self._issuer = f"https://securetoken.google.com/{project_id}"

    def verify_token(self, token: str) -> TokenPayload:
        if self.dev_mode:
            return self._verify_dev_token(token)
        return self._verify_production_token(token)

    def _verify_dev_token(self, token: str) -> TokenPayload:
        """
        In DEV mode, we accept tokens in two formats:
        1. A simple string "dev:<uid>:<email>" for quick testing
        2. A real JWT that we decode without signature verification
        """
        if token.startswith("dev:"):
            parts = token.split(":")
            uid = parts[1] if len(parts) > 1 else "dev-user"
            email = parts[2] if len(parts) > 2 else "dev@example.com"
            return TokenPayload(
                uid=uid,
                email=email,
                email_verified=True,
                provider="firebase",
            )

        try:
            unverified = jwt.get_unverified_claims(token)
            return TokenPayload(
                uid=unverified.get("sub", unverified.get("user_id", "unknown")),
                email=unverified.get("email"),
                email_verified=unverified.get("email_verified", False),
                provider="firebase",
            )
        except JWTError:
            return TokenPayload(
                uid="dev-user",
                email="dev@example.com",
                email_verified=True,
                provider="firebase",
            )

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
            return _certs_cache[cache_key]

        try:
            response = httpx.get(FIREBASE_CERTS_URL, timeout=10.0)
            response.raise_for_status()
            keys = response.json()
            _certs_cache[cache_key] = keys
            return keys
        except Exception as e:
            raise ValueError(f"Failed to fetch Firebase public keys: {e}")
