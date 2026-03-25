"""Notification provider."""

import structlog
from abc import ABC, abstractmethod
from app.settings import settings

logger = structlog.get_logger()


class NotificationProvider(ABC):
    @abstractmethod
    def send_sms(self, phone: str, msg: str) -> bool:
        pass

    @abstractmethod
    def send_whatsapp(self, phone: str, msg: str) -> bool:
        pass


class MockNotificationProvider(NotificationProvider):
    def __init__(self) -> None:
        self._last_code: str | None = None

    def send_sms(self, phone: str, msg: str) -> bool:
        logger.info("mock_sms", phone=phone[:4] + "****")
        return True

    def send_whatsapp(self, phone: str, msg: str) -> bool:
        logger.info("mock_whatsapp", phone=phone[:4] + "****")
        return True

    def get_last_code(self) -> str | None:
        return self._last_code

    def set_last_code(self, code: str) -> None:
        self._last_code = code


notification_provider = MockNotificationProvider() if settings.is_dev else None
