"""Cryptographic services for sensitive data."""
import base64, hashlib, hmac, os, secrets
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from app.settings import settings

class CryptoService:
    def __init__(self):
        self._encryption_key = None
        self._hmac_pepper = None
        if settings.encryption_key:
            try: self._encryption_key = base64.b64decode(settings.encryption_key)
            except: pass
        if settings.hmac_pepper:
            try: self._hmac_pepper = base64.b64decode(settings.hmac_pepper)
            except: pass
        if settings.is_dev:
            if not self._encryption_key: self._encryption_key = secrets.token_bytes(32)
            if not self._hmac_pepper: self._hmac_pepper = secrets.token_bytes(32)

    @property
    def is_configured(self): return self._encryption_key and self._hmac_pepper

    def hash_cpf(self, cpf: str) -> str:
        normalized = "".join(c for c in cpf if c.isdigit())
        if len(normalized) != 11: raise ValueError("CPF must have 11 digits")
        return hmac.new(self._hmac_pepper, normalized.encode(), hashlib.sha256).hexdigest()

    def encrypt(self, plaintext: str) -> bytes:
        aesgcm = AESGCM(self._encryption_key)
        nonce = os.urandom(12)
        return nonce + aesgcm.encrypt(nonce, plaintext.encode(), None)

    def decrypt(self, ciphertext: bytes) -> str:
        aesgcm = AESGCM(self._encryption_key)
        return aesgcm.decrypt(ciphertext[:12], ciphertext[12:], None).decode()

    def encrypt_cpf(self, cpf: str):
        normalized = "".join(c for c in cpf if c.isdigit())
        return self.hash_cpf(normalized), self.encrypt(normalized)

    def encrypt_rg(self, rg: str) -> bytes:
        return self.encrypt("".join(c for c in rg if c.isalnum()))

crypto_service = CryptoService()
