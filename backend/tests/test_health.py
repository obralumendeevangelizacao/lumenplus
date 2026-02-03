"""
Health Tests
============
Testes do endpoint de health check.
"""

import pytest
from fastapi.testclient import TestClient


class TestHealth:
    """Testes do endpoint /health."""
    
    def test_health_returns_200(self, client: TestClient):
        """Health check deve retornar 200."""
        response = client.get("/health")
        assert response.status_code == 200
    
    def test_health_returns_healthy_status(self, client: TestClient):
        """Health check deve retornar status healthy."""
        response = client.get("/health")
        data = response.json()
        assert data["status"] == "healthy"
    
    def test_health_returns_timestamp(self, client: TestClient):
        """Health check deve retornar timestamp."""
        response = client.get("/health")
        data = response.json()
        assert "timestamp" in data
    
    def test_health_returns_version(self, client: TestClient):
        """Health check deve retornar versão."""
        response = client.get("/health")
        data = response.json()
        assert "version" in data
