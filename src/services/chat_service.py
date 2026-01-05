"""Chat service for real-time messaging between staff."""

from datetime import datetime
from typing import Optional, List

from sqlalchemy import select, update, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.models.auth_models import ChatMessage, User
from src.models.auth_schemas import (
    ChatMessageCreate, ChatMessageResponse, 
    ChatMessageListResponse, UnreadCount
)


class ChatService:
    """Real-time chat service for staff communication."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def send_message(
        self, 
        sender_id: int, 
        message_data: ChatMessageCreate
    ) -> ChatMessage:
        """Send a new chat message."""
        message = ChatMessage(
            sender_id=sender_id,
            recipient_id=message_data.recipient_id,
            content=message_data.content,
        )
        self.db.add(message)
        await self.db.flush()
        await self.db.refresh(message)
        return message

    async def get_message_by_id(self, message_id: int) -> Optional[ChatMessage]:
        """Get a message by ID."""
        result = await self.db.execute(
            select(ChatMessage)
            .options(selectinload(ChatMessage.sender))
            .where(ChatMessage.id == message_id)
        )
        return result.scalar_one_or_none()

    async def get_messages_between_users(
        self,
        user1_id: int,
        user2_id: int,
        limit: int = 100,
        offset: int = 0,
    ) -> List[ChatMessage]:
        """Get messages between two users (direct messages)."""
        result = await self.db.execute(
            select(ChatMessage)
            .options(selectinload(ChatMessage.sender))
            .where(
                or_(
                    and_(
                        ChatMessage.sender_id == user1_id,
                        ChatMessage.recipient_id == user2_id,
                    ),
                    and_(
                        ChatMessage.sender_id == user2_id,
                        ChatMessage.recipient_id == user1_id,
                    ),
                )
            )
            .order_by(ChatMessage.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(reversed(result.scalars().all()))

    async def get_broadcast_messages(
        self,
        limit: int = 100,
        offset: int = 0,
    ) -> List[ChatMessage]:
        """Get broadcast messages (recipient_id is null)."""
        result = await self.db.execute(
            select(ChatMessage)
            .options(selectinload(ChatMessage.sender))
            .where(ChatMessage.recipient_id.is_(None))
            .order_by(ChatMessage.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(reversed(result.scalars().all()))

    async def get_all_messages_for_user(
        self,
        user_id: int,
        limit: int = 100,
        offset: int = 0,
    ) -> List[ChatMessage]:
        """Get all messages visible to a user (sent to them, from them, or broadcast)."""
        result = await self.db.execute(
            select(ChatMessage)
            .options(selectinload(ChatMessage.sender))
            .where(
                or_(
                    ChatMessage.sender_id == user_id,
                    ChatMessage.recipient_id == user_id,
                    ChatMessage.recipient_id.is_(None),  # Broadcast
                )
            )
            .order_by(ChatMessage.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(reversed(result.scalars().all()))

    async def mark_as_read(self, message_id: int, user_id: int) -> bool:
        """Mark a message as read."""
        message = await self.get_message_by_id(message_id)
        if not message:
            return False
        
        # Only recipient can mark as read
        if message.recipient_id != user_id and message.recipient_id is not None:
            return False
        
        message.is_read = True
        message.read_at = datetime.utcnow()
        await self.db.flush()
        return True

    async def mark_conversation_as_read(
        self, 
        user_id: int, 
        other_user_id: Optional[int] = None
    ) -> int:
        """Mark all messages in a conversation as read."""
        if other_user_id:
            # Mark direct messages as read
            result = await self.db.execute(
                update(ChatMessage)
                .where(
                    ChatMessage.sender_id == other_user_id,
                    ChatMessage.recipient_id == user_id,
                    ChatMessage.is_read == False,
                )
                .values(is_read=True, read_at=datetime.utcnow())
            )
        else:
            # Mark broadcast messages as read for this user
            # Note: This is tricky with broadcast - we'd need per-user read tracking
            # For simplicity, we'll skip broadcast read tracking
            return 0
        
        return result.rowcount

    async def get_unread_count(self, user_id: int) -> UnreadCount:
        """Get unread message count for a user."""
        # Direct messages
        result = await self.db.execute(
            select(
                ChatMessage.sender_id,
                func.count(ChatMessage.id).label('count')
            )
            .where(
                ChatMessage.recipient_id == user_id,
                ChatMessage.is_read == False,
            )
            .group_by(ChatMessage.sender_id)
        )
        
        by_sender = {}
        total = 0
        for row in result:
            by_sender[row.sender_id] = row.count
            total += row.count
        
        return UnreadCount(total=total, by_sender=by_sender)

    async def get_recent_conversations(self, user_id: int) -> List[dict]:
        """Get list of recent conversations for a user."""
        # This is a complex query - get the most recent message from each conversation
        # For simplicity, we'll get all unique conversation partners
        
        result = await self.db.execute(
            select(User)
            .where(User.is_active == True, User.id != user_id)
            .order_by(User.last_name, User.first_name)
        )
        users = result.scalars().all()
        
        conversations = []
        for user in users:
            # Get last message
            msg_result = await self.db.execute(
                select(ChatMessage)
                .where(
                    or_(
                        and_(
                            ChatMessage.sender_id == user_id,
                            ChatMessage.recipient_id == user.id,
                        ),
                        and_(
                            ChatMessage.sender_id == user.id,
                            ChatMessage.recipient_id == user_id,
                        ),
                    )
                )
                .order_by(ChatMessage.created_at.desc())
                .limit(1)
            )
            last_message = msg_result.scalar_one_or_none()
            
            # Get unread count
            unread_result = await self.db.execute(
                select(func.count(ChatMessage.id))
                .where(
                    ChatMessage.sender_id == user.id,
                    ChatMessage.recipient_id == user_id,
                    ChatMessage.is_read == False,
                )
            )
            unread_count = unread_result.scalar() or 0
            
            conversations.append({
                "user": {
                    "id": user.id,
                    "name": f"{user.first_name} {user.last_name}",
                    "avatar": user.avatar_url,
                    "role": user.role.value,
                },
                "last_message": {
                    "content": last_message.content if last_message else None,
                    "created_at": last_message.created_at.isoformat() if last_message else None,
                    "is_mine": last_message.sender_id == user_id if last_message else None,
                } if last_message else None,
                "unread_count": unread_count,
            })
        
        # Sort by last message time (most recent first)
        conversations.sort(
            key=lambda x: x["last_message"]["created_at"] if x["last_message"] else "0",
            reverse=True
        )
        
        return conversations

    async def delete_message(self, message_id: int, user_id: int) -> bool:
        """Delete a message (only sender can delete)."""
        message = await self.get_message_by_id(message_id)
        if not message or message.sender_id != user_id:
            return False
        
        await self.db.delete(message)
        await self.db.flush()
        return True


def message_to_response(message: ChatMessage) -> ChatMessageResponse:
    """Convert a ChatMessage model to a response schema."""
    return ChatMessageResponse(
        id=message.id,
        sender_id=message.sender_id,
        sender_name=f"{message.sender.first_name} {message.sender.last_name}" if message.sender else "Unknown",
        sender_avatar=message.sender.avatar_url if message.sender else None,
        recipient_id=message.recipient_id,
        content=message.content,
        is_read=message.is_read,
        created_at=message.created_at,
        read_at=message.read_at,
    )
