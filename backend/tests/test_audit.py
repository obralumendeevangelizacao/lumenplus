"""
Audit Tests
===========
Testes do serviço de auditoria.
"""

import pytest
from app.services.audit_service import sanitize_sensitive_data


class TestSanitizeSensitiveData:
    """Testes de sanitização de dados sensíveis."""
    
    def test_sanitize_cpf_formatted(self):
        """CPF formatado deve ser sanitizado."""
        data = "CPF: 123.456.789-00"
        result = sanitize_sensitive_data(data)
        assert "123.456.789-00" not in result
        assert "[CPF_REDACTED]" in result
    
    def test_sanitize_cpf_unformatted(self):
        """CPF sem formatação deve ser sanitizado."""
        data = "CPF: 12345678900"
        result = sanitize_sensitive_data(data)
        assert "12345678900" not in result
    
    def test_sanitize_phone_e164(self):
        """Telefone E.164 deve ser sanitizado."""
        data = "Phone: +5511999999999"
        result = sanitize_sensitive_data(data)
        assert "+5511999999999" not in result
        assert "[PHONE_REDACTED]" in result
    
    def test_sanitize_dict_with_cpf_key(self):
        """Dict com chave 'cpf' deve ser sanitizado."""
        data = {"name": "João", "cpf": "123.456.789-00"}
        result = sanitize_sensitive_data(data)
        assert result["cpf"] == "[REDACTED]"
        assert result["name"] == "João"
    
    def test_sanitize_dict_with_phone_key(self):
        """Dict com chave 'phone' deve ser sanitizado."""
        data = {"name": "João", "phone": "+5511999999999"}
        result = sanitize_sensitive_data(data)
        assert result["phone"] == "[REDACTED]"
    
    def test_sanitize_nested_dict(self):
        """Dict aninhado deve ser sanitizado."""
        data = {
            "user": {
                "name": "João",
                "cpf": "123.456.789-00"
            }
        }
        result = sanitize_sensitive_data(data)
        assert result["user"]["cpf"] == "[REDACTED]"
    
    def test_sanitize_list_of_dicts(self):
        """Lista de dicts deve ser sanitizada."""
        data = [
            {"name": "João", "cpf": "123.456.789-00"},
            {"name": "Maria", "cpf": "987.654.321-00"}
        ]
        result = sanitize_sensitive_data(data)
        assert result[0]["cpf"] == "[REDACTED]"
        assert result[1]["cpf"] == "[REDACTED]"
    
    def test_sanitize_none_returns_none(self):
        """None deve retornar None."""
        assert sanitize_sensitive_data(None) is None
    
    def test_sanitize_preserves_non_sensitive_data(self):
        """Dados não sensíveis devem ser preservados."""
        data = {"name": "João", "city": "São Paulo", "age": 30}
        result = sanitize_sensitive_data(data)
        assert result == data
