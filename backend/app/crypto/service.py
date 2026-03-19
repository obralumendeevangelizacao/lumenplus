"""
Serviço de criptografia para dados sensíveis.
==============================================

Estratégia:
  - CPF  → HMAC-SHA256 (para unicidade/comparação) + AES-256-GCM (para recuperação)
  - RG   → AES-256-GCM

Carregamento de chaves (ordem de prioridade):
  1. Variáveis de ambiente ENCRYPTION_KEY e HMAC_PEPPER (base64, 32 bytes)
  2. Chaves efêmeras geradas automaticamente em DEV (dados não persistem entre reinícios)
  3. Falha explícita em PROD se as variáveis não estiverem configuradas

Geração de chaves para produção:
  python -c "import secrets, base64; print(base64.b64encode(secrets.token_bytes(32)).decode())"
"""

import base64
import hashlib
import hmac
import logging
import os
import secrets
from typing import Optional

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.settings import settings

logger = logging.getLogger(__name__)

_REQUIRED_KEY_BYTES = 32  # AES-256 exige exatamente 32 bytes


class CryptoConfigError(RuntimeError):
    """
    Levantado quando as chaves de criptografia estão ausentes ou inválidas.
    Em produção, causa falha na inicialização do serviço.
    """


class CryptoService:
    """
    Wrapper sobre AES-256-GCM + HMAC-SHA256.

    Sempre use a instância singleton `crypto_service` no módulo raiz.
    Não instancie diretamente.
    """

    def __init__(self) -> None:
        self._encryption_key: Optional[bytes] = None
        self._hmac_pepper: Optional[bytes] = None
        self._using_ephemeral_keys = False

        # Carrega chaves configuradas
        if settings.encryption_key:
            self._encryption_key = self._decode_and_validate_key(
                "ENCRYPTION_KEY", settings.encryption_key
            )
        if settings.hmac_pepper:
            self._hmac_pepper = self._decode_and_validate_key("HMAC_PEPPER", settings.hmac_pepper)

        # DEV: gera chaves efêmeras se não configuradas, com aviso explícito
        if settings.is_dev:
            if not self._encryption_key:
                self._encryption_key = secrets.token_bytes(_REQUIRED_KEY_BYTES)
                self._using_ephemeral_keys = True
                logger.warning(
                    "SEGURANÇA: ENCRYPTION_KEY não configurada. "
                    "Usando chave efêmera — dados criptografados são PERDIDOS ao reiniciar. "
                    "Defina ENCRYPTION_KEY no .env para persistência em DEV."
                )
            if not self._hmac_pepper:
                self._hmac_pepper = secrets.token_bytes(_REQUIRED_KEY_BYTES)
                self._using_ephemeral_keys = True
                logger.warning(
                    "SEGURANÇA: HMAC_PEPPER não configurado. "
                    "Usando pepper efêmero — hashes de CPF mudam a cada reinício. "
                    "Defina HMAC_PEPPER no .env para persistência em DEV."
                )
        else:
            # PROD: falha imediata se alguma chave estiver ausente
            missing = []
            if not self._encryption_key:
                missing.append("ENCRYPTION_KEY")
            if not self._hmac_pepper:
                missing.append("HMAC_PEPPER")
            if missing:
                raise CryptoConfigError(
                    f"Variáveis obrigatórias em PROD não configuradas: {', '.join(missing)}. "
                    "Gere as chaves com: "
                    'python -c "import secrets,base64; print(base64.b64encode(secrets.token_bytes(32)).decode())"'
                )

    # =========================================================================
    # INTERFACE PÚBLICA
    # =========================================================================

    @property
    def is_configured(self) -> bool:
        """True se as chaves estão disponíveis (configuradas ou efêmeras em DEV)."""
        return bool(self._encryption_key and self._hmac_pepper)

    @property
    def is_using_ephemeral_keys(self) -> bool:
        """True se está usando chaves auto-geradas (não persistentes). Somente em DEV."""
        return self._using_ephemeral_keys

    def hash_cpf(self, cpf: str) -> str:
        """
        Gera HMAC-SHA256 do CPF normalizado (somente dígitos).
        Usado para consultas de unicidade sem expor o valor original.
        """
        normalized = _normalize_digits(cpf)
        if len(normalized) != 11:
            raise ValueError(
                f"CPF deve ter 11 dígitos após normalização, recebeu {len(normalized)}"
            )
        return hmac.new(  # type: ignore[arg-type]
            self._hmac_pepper, normalized.encode(), hashlib.sha256
        ).hexdigest()

    def encrypt(self, plaintext: str) -> bytes:
        """
        Criptografa com AES-256-GCM.
        Formato de saída: nonce(12 bytes) + ciphertext.
        """
        aesgcm = AESGCM(self._encryption_key)  # type: ignore[arg-type]
        nonce = os.urandom(12)
        return nonce + aesgcm.encrypt(nonce, plaintext.encode("utf-8"), None)

    def decrypt(self, ciphertext: bytes) -> str:
        """Decripta valor gerado por encrypt()."""
        if len(ciphertext) < 13:
            raise ValueError(
                "Ciphertext muito curto — esperado pelo menos 13 bytes (nonce + 1 byte de dado)"
            )
        aesgcm = AESGCM(self._encryption_key)  # type: ignore[arg-type]
        return aesgcm.decrypt(ciphertext[:12], ciphertext[12:], None).decode("utf-8")

    def encrypt_cpf(self, cpf: str) -> tuple[str, bytes]:
        """
        Retorna (hmac_hash, aes_encrypted).
        - Use hmac_hash para unicidade e deduplicação.
        - Use aes_encrypted para armazenar e recuperar o valor real.
        """
        normalized = _normalize_digits(cpf)
        cpf_hash = self.hash_cpf(normalized)
        cpf_encrypted = self.encrypt(normalized)
        return cpf_hash, cpf_encrypted

    def encrypt_rg(self, rg: str) -> bytes:
        """Criptografa RG normalizado (somente alfanumérico)."""
        normalized = "".join(c for c in rg if c.isalnum())
        if not normalized:
            raise ValueError("RG não pode ser vazio após normalização")
        return self.encrypt(normalized)

    # =========================================================================
    # HELPERS INTERNOS
    # =========================================================================

    @staticmethod
    def _decode_and_validate_key(name: str, value: str) -> bytes:
        """
        Decodifica base64 e valida que o resultado tem exatamente 32 bytes.
        Levanta CryptoConfigError em caso de falha (não ignora silenciosamente).
        """
        try:
            key = base64.b64decode(value)
        except Exception as exc:
            raise CryptoConfigError(
                f"{name} contém valor base64 inválido: {exc}. "
                "Gere uma chave válida com: "
                'python -c "import secrets,base64; print(base64.b64encode(secrets.token_bytes(32)).decode())"'
            ) from exc

        if len(key) != _REQUIRED_KEY_BYTES:
            raise CryptoConfigError(
                f"{name} deve ter exatamente {_REQUIRED_KEY_BYTES} bytes após decodificação base64, "
                f"mas tem {len(key)} bytes. "
                "Gere uma chave correta com: "
                'python -c "import secrets,base64; print(base64.b64encode(secrets.token_bytes(32)).decode())"'
            )
        return key


def _normalize_digits(value: str) -> str:
    """Remove tudo que não seja dígito."""
    return "".join(c for c in value if c.isdigit())


# Singleton: importar `crypto_service` em outros módulos
crypto_service = CryptoService()
