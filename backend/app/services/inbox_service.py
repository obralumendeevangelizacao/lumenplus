"""
Inbox Service
=============
Serviço para gerenciamento de avisos/inbox.
"""

from datetime import datetime, timedelta
from typing import Any
from uuid import UUID

from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import Session, joinedload

from app.db.models import (
    InboxMessage, 
    InboxRecipient, 
    InboxMessageType,
    User, 
    UserProfile,
    UserPermission,
    ProfileCatalogItem,
)
from app.schemas.inbox import InboxFilters


# Constantes
INBOX_EXPIRATION_DAYS = 30
PERMISSION_SEND_INBOX = "CAN_SEND_INBOX"


class InboxService:
    """Serviço para operações de inbox."""
    
    def __init__(self, db: Session):
        self.db = db
    
    # === PERMISSÕES ===
    
    def user_has_permission(self, user_id: UUID, permission_code: str) -> bool:
        """Verifica se usuário tem uma permissão específica."""
        result = self.db.execute(
            select(UserPermission)
            .where(
                UserPermission.user_id == user_id,
                UserPermission.permission_code == permission_code
            )
        ).scalar_one_or_none()
        return result is not None
    
    def get_user_permissions(self, user_id: UUID) -> list[str]:
        """Retorna lista de permissões do usuário."""
        result = self.db.execute(
            select(UserPermission.permission_code)
            .where(UserPermission.user_id == user_id)
        ).scalars().all()
        return list(result)
    
    def grant_permission(self, user_id: UUID, permission_code: str, granted_by_user_id: UUID | None = None) -> UserPermission:
        """Concede uma permissão a um usuário."""
        permission = UserPermission(
            user_id=user_id,
            permission_code=permission_code,
            granted_by_user_id=granted_by_user_id,
        )
        self.db.add(permission)
        self.db.commit()
        self.db.refresh(permission)
        return permission
    
    def revoke_permission(self, user_id: UUID, permission_code: str) -> bool:
        """Remove uma permissão de um usuário."""
        result = self.db.execute(
            select(UserPermission)
            .where(
                UserPermission.user_id == user_id,
                UserPermission.permission_code == permission_code
            )
        ).scalar_one_or_none()
        
        if result:
            self.db.delete(result)
            self.db.commit()
            return True
        return False
    
    # === LEITURA DE INBOX ===
    
    def get_user_inbox(
        self, 
        user_id: UUID, 
        include_read: bool = True,
        limit: int = 50,
        offset: int = 0
    ) -> tuple[list[dict], int, int]:
        """
        Retorna mensagens do inbox do usuário.
        Returns: (messages, total, unread_count)
        """
        now = datetime.utcnow()
        
        # Query base
        base_query = (
            select(InboxRecipient, InboxMessage)
            .join(InboxMessage, InboxRecipient.message_id == InboxMessage.id)
            .where(
                InboxRecipient.user_id == user_id,
                InboxMessage.expires_at > now
            )
        )
        
        if not include_read:
            base_query = base_query.where(InboxRecipient.read == False)
        
        # Ordenar por não lidos primeiro, depois por data
        base_query = base_query.order_by(
            InboxRecipient.read.asc(),
            InboxMessage.created_at.desc()
        )
        
        # Contar total
        count_query = (
            select(func.count())
            .select_from(InboxRecipient)
            .join(InboxMessage, InboxRecipient.message_id == InboxMessage.id)
            .where(
                InboxRecipient.user_id == user_id,
                InboxMessage.expires_at > now
            )
        )
        total = self.db.execute(count_query).scalar() or 0
        
        # Contar não lidos
        unread_query = count_query.where(InboxRecipient.read == False)
        unread_count = self.db.execute(unread_query).scalar() or 0
        
        # Buscar mensagens
        results = self.db.execute(
            base_query.limit(limit).offset(offset)
        ).all()
        
        messages = []
        for recipient, message in results:
            # Buscar nome do remetente
            sender = self.db.execute(
                select(UserProfile.full_name)
                .where(UserProfile.user_id == message.created_by_user_id)
            ).scalar_one_or_none()
            
            messages.append({
                "id": str(recipient.id),
                "message_id": str(message.id),
                "title": message.title,
                "message": message.message,
                "type": message.type.value,
                "read": recipient.read,
                "read_at": recipient.read_at,
                "created_at": message.created_at,
                "expires_at": message.expires_at,
                "attachments": message.attachments,
                "sender_name": sender or "Lumen+",
            })
        
        return messages, total, unread_count
    
    def get_unread_messages(self, user_id: UUID, limit: int = 10) -> list[dict]:
        """Retorna apenas mensagens não lidas."""
        messages, _, _ = self.get_user_inbox(user_id, include_read=False, limit=limit)
        return messages
    
    def mark_as_read(self, user_id: UUID, recipient_id: UUID) -> bool:
        """Marca uma mensagem como lida."""
        recipient = self.db.execute(
            select(InboxRecipient)
            .where(
                InboxRecipient.id == recipient_id,
                InboxRecipient.user_id == user_id
            )
        ).scalar_one_or_none()
        
        if recipient and not recipient.read:
            recipient.read = True
            recipient.read_at = datetime.utcnow()
            self.db.commit()
            return True
        return False
    
    def mark_all_as_read(self, user_id: UUID) -> int:
        """Marca todas as mensagens como lidas. Retorna quantidade atualizada."""
        now = datetime.utcnow()
        
        # Buscar IDs dos recipients não lidos
        recipients = self.db.execute(
            select(InboxRecipient)
            .join(InboxMessage, InboxRecipient.message_id == InboxMessage.id)
            .where(
                InboxRecipient.user_id == user_id,
                InboxRecipient.read == False,
                InboxMessage.expires_at > now
            )
        ).scalars().all()
        
        count = 0
        for recipient in recipients:
            recipient.read = True
            recipient.read_at = now
            count += 1
        
        self.db.commit()
        return count
    
    # === ENVIO DE AVISOS ===
    
    def get_filter_options(self) -> dict:
        """Retorna opções disponíveis para filtros de segmentação."""
        # Realidades vocacionais
        vocational = self.db.execute(
            select(ProfileCatalogItem)
            .join(ProfileCatalogItem.catalog)
            .where(ProfileCatalogItem.catalog.has(code="VOCATIONAL_REALITY"))
            .where(ProfileCatalogItem.is_active == True)
            .order_by(ProfileCatalogItem.sort_order)
        ).scalars().all()
        
        # Estados de vida
        life_states = self.db.execute(
            select(ProfileCatalogItem)
            .join(ProfileCatalogItem.catalog)
            .where(ProfileCatalogItem.catalog.has(code="LIFE_STATE"))
            .where(ProfileCatalogItem.is_active == True)
            .order_by(ProfileCatalogItem.sort_order)
        ).scalars().all()
        
        # Estados civis
        marital = self.db.execute(
            select(ProfileCatalogItem)
            .join(ProfileCatalogItem.catalog)
            .where(ProfileCatalogItem.catalog.has(code="MARITAL_STATUS"))
            .where(ProfileCatalogItem.is_active == True)
            .order_by(ProfileCatalogItem.sort_order)
        ).scalars().all()
        
        # Estados (UF) únicos dos perfis
        states = self.db.execute(
            select(UserProfile.state)
            .where(UserProfile.state.isnot(None))
            .distinct()
            .order_by(UserProfile.state)
        ).scalars().all()
        
        # Cidades únicas dos perfis
        cities = self.db.execute(
            select(UserProfile.city)
            .where(UserProfile.city.isnot(None))
            .distinct()
            .order_by(UserProfile.city)
        ).scalars().all()
        
        return {
            "vocational_realities": [{"code": v.code, "label": v.label} for v in vocational],
            "life_states": [{"code": l.code, "label": l.label} for l in life_states],
            "marital_statuses": [{"code": m.code, "label": m.label} for m in marital],
            "states": list(states),
            "cities": list(cities),
        }
    
    def _get_recipient_user_ids(self, send_to_all: bool, filters: InboxFilters | None) -> list[UUID]:
        """Retorna lista de user_ids baseado nos filtros."""
        query = select(User.id).join(UserProfile, User.id == UserProfile.user_id, isouter=True)
        
        if send_to_all:
            # Todos os usuários ativos
            query = query.where(User.is_active == True)
        elif filters:
            conditions = [User.is_active == True]
            
            # Filtro por realidade vocacional
            if filters.vocational_reality_codes:
                subq = select(ProfileCatalogItem.id).where(
                    ProfileCatalogItem.code.in_(filters.vocational_reality_codes)
                )
                conditions.append(UserProfile.vocational_reality_item_id.in_(subq))
            
            # Filtro por estado de vida
            if filters.life_state_codes:
                subq = select(ProfileCatalogItem.id).where(
                    ProfileCatalogItem.code.in_(filters.life_state_codes)
                )
                conditions.append(UserProfile.life_state_item_id.in_(subq))
            
            # Filtro por estado civil
            if filters.marital_status_codes:
                subq = select(ProfileCatalogItem.id).where(
                    ProfileCatalogItem.code.in_(filters.marital_status_codes)
                )
                conditions.append(UserProfile.marital_status_item_id.in_(subq))
            
            # Filtro por UF
            if filters.states:
                conditions.append(UserProfile.state.in_(filters.states))
            
            # Filtro por cidade
            if filters.cities:
                conditions.append(UserProfile.city.in_(filters.cities))
            
            query = query.where(and_(*conditions))
        else:
            return []
        
        return list(self.db.execute(query).scalars().all())
    
    def preview_send(self, send_to_all: bool, filters: InboxFilters | None) -> int:
        """Retorna quantos usuários receberão o aviso."""
        user_ids = self._get_recipient_user_ids(send_to_all, filters)
        return len(user_ids)
    
    def send_message(
        self,
        title: str,
        message: str,
        message_type: str,
        created_by_user_id: UUID,
        send_to_all: bool,
        filters: InboxFilters | None = None,
        attachments: list[dict] | None = None,
    ) -> tuple[UUID, int]:
        """
        Envia uma mensagem para os destinatários.
        Returns: (message_id, recipient_count)
        """
        # Converter tipo
        try:
            msg_type = InboxMessageType(message_type)
        except ValueError:
            msg_type = InboxMessageType.INFO
        
        # Criar mensagem
        inbox_message = InboxMessage(
            title=title,
            message=message,
            type=msg_type,
            created_by_user_id=created_by_user_id,
            expires_at=datetime.utcnow() + timedelta(days=INBOX_EXPIRATION_DAYS),
            attachments=attachments,
            filters=filters.model_dump() if filters else None,
        )
        self.db.add(inbox_message)
        self.db.flush()  # Para obter o ID
        
        # Buscar destinatários
        user_ids = self._get_recipient_user_ids(send_to_all, filters)
        
        # Criar recipients
        for user_id in user_ids:
            recipient = InboxRecipient(
                message_id=inbox_message.id,
                user_id=user_id,
            )
            self.db.add(recipient)
        
        self.db.commit()
        
        return inbox_message.id, len(user_ids)
    
    def get_sent_messages(self, user_id: UUID, limit: int = 20) -> list[dict]:
        """Retorna mensagens enviadas por um usuário."""
        messages = self.db.execute(
            select(InboxMessage)
            .where(InboxMessage.created_by_user_id == user_id)
            .order_by(InboxMessage.created_at.desc())
            .limit(limit)
        ).scalars().all()
        
        result = []
        for msg in messages:
            # Contar destinatários
            recipient_count = self.db.execute(
                select(func.count())
                .select_from(InboxRecipient)
                .where(InboxRecipient.message_id == msg.id)
            ).scalar() or 0
            
            # Contar lidos
            read_count = self.db.execute(
                select(func.count())
                .select_from(InboxRecipient)
                .where(
                    InboxRecipient.message_id == msg.id,
                    InboxRecipient.read == True
                )
            ).scalar() or 0
            
            result.append({
                "id": str(msg.id),
                "title": msg.title,
                "message": msg.message,
                "type": msg.type.value,
                "created_at": msg.created_at,
                "expires_at": msg.expires_at,
                "recipient_count": recipient_count,
                "read_count": read_count,
                "filters": msg.filters,
            })
        
        return result
    
    # === LIMPEZA ===
    
    def cleanup_expired_messages(self) -> int:
        """Remove mensagens expiradas. Retorna quantidade removida."""
        now = datetime.utcnow()
        
        expired = self.db.execute(
            select(InboxMessage)
            .where(InboxMessage.expires_at < now)
        ).scalars().all()
        
        count = len(expired)
        for msg in expired:
            self.db.delete(msg)
        
        self.db.commit()
        return count
