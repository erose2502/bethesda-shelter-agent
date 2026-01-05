"""Chat API routes for real-time messaging."""

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
import json

from src.db.database import get_db
from src.api.routes.auth import get_current_user, require_permission
from src.services.chat_service import ChatService, message_to_response
from src.services.auth_service import AuthService, decode_access_token
from src.models.auth_models import User
from src.models.auth_schemas import (
    ChatMessageCreate, ChatMessageResponse, 
    ChatMessageListResponse, TypingIndicator, UnreadCount
)

router = APIRouter(prefix="/api/chat", tags=["Chat"])


# WebSocket connection manager
class ConnectionManager:
    """Manages WebSocket connections for real-time chat."""
    
    def __init__(self):
        # user_id -> list of WebSocket connections
        self.active_connections: dict[int, list[WebSocket]] = {}
        # Track typing status: (sender_id, recipient_id) -> is_typing
        self.typing_status: dict[tuple[int, Optional[int]], bool] = {}

    async def connect(self, websocket: WebSocket, user_id: int):
        """Accept a new WebSocket connection."""
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)

    def disconnect(self, websocket: WebSocket, user_id: int):
        """Remove a WebSocket connection."""
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
        
        # Clear typing status for this user
        keys_to_remove = [k for k in self.typing_status if k[0] == user_id]
        for key in keys_to_remove:
            del self.typing_status[key]

    async def send_to_user(self, user_id: int, message: dict):
        """Send a message to all connections of a specific user."""
        if user_id in self.active_connections:
            for connection in self.active_connections[user_id]:
                try:
                    await connection.send_json(message)
                except:
                    pass

    async def broadcast(self, message: dict, exclude_user_id: Optional[int] = None):
        """Broadcast a message to all connected users."""
        for user_id, connections in self.active_connections.items():
            if exclude_user_id and user_id == exclude_user_id:
                continue
            for connection in connections:
                try:
                    await connection.send_json(message)
                except:
                    pass

    def get_online_users(self) -> List[int]:
        """Get list of online user IDs."""
        return list(self.active_connections.keys())

    def set_typing(self, sender_id: int, recipient_id: Optional[int], is_typing: bool):
        """Set typing status for a user."""
        key = (sender_id, recipient_id)
        self.typing_status[key] = is_typing

    def get_typing_users(self, user_id: int) -> List[int]:
        """Get list of users currently typing to a specific user."""
        typing = []
        for (sender_id, recipient_id), is_typing in self.typing_status.items():
            if is_typing and (recipient_id == user_id or recipient_id is None):
                typing.append(sender_id)
        return typing


# Global connection manager
manager = ConnectionManager()


# ===================
# REST ENDPOINTS
# ===================

@router.get("/messages", response_model=ChatMessageListResponse)
async def get_messages(
    recipient_id: Optional[int] = None,
    limit: int = 100,
    offset: int = 0,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get messages for the current user.
    
    If recipient_id is provided, gets messages between current user and recipient.
    If recipient_id is None, gets all messages visible to the user.
    """
    chat_service = ChatService(db)
    
    if recipient_id:
        messages = await chat_service.get_messages_between_users(
            user.id, recipient_id, limit, offset
        )
    else:
        messages = await chat_service.get_all_messages_for_user(
            user.id, limit, offset
        )
    
    return ChatMessageListResponse(
        messages=[message_to_response(m) for m in messages],
        total=len(messages),
    )


@router.get("/broadcast", response_model=ChatMessageListResponse)
async def get_broadcast_messages(
    limit: int = 100,
    offset: int = 0,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get broadcast (group) messages."""
    chat_service = ChatService(db)
    messages = await chat_service.get_broadcast_messages(limit, offset)
    
    return ChatMessageListResponse(
        messages=[message_to_response(m) for m in messages],
        total=len(messages),
    )


@router.post("/messages", response_model=ChatMessageResponse)
async def send_message(
    message_data: ChatMessageCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Send a new message."""
    chat_service = ChatService(db)
    message = await chat_service.send_message(user.id, message_data)
    
    # Load sender info
    message.sender = user
    response = message_to_response(message)
    
    # Notify via WebSocket
    ws_message = {
        "type": "new_message",
        "message": response.model_dump(mode='json'),
    }
    
    if message_data.recipient_id:
        # Direct message - send to recipient
        await manager.send_to_user(message_data.recipient_id, ws_message)
    else:
        # Broadcast - send to all except sender
        await manager.broadcast(ws_message, exclude_user_id=user.id)
    
    # Clear typing status
    manager.set_typing(user.id, message_data.recipient_id, False)
    
    return response


@router.post("/messages/{message_id}/read")
async def mark_message_read(
    message_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark a message as read."""
    chat_service = ChatService(db)
    success = await chat_service.mark_as_read(message_id, user.id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found or you cannot mark it as read",
        )
    
    return {"message": "Marked as read"}


@router.post("/conversations/{other_user_id}/read")
async def mark_conversation_read(
    other_user_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark all messages in a conversation as read."""
    chat_service = ChatService(db)
    count = await chat_service.mark_conversation_as_read(user.id, other_user_id)
    return {"message": f"Marked {count} messages as read"}


@router.get("/unread", response_model=UnreadCount)
async def get_unread_count(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get unread message count for the current user."""
    chat_service = ChatService(db)
    return await chat_service.get_unread_count(user.id)


@router.get("/conversations")
async def get_conversations(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get recent conversations for the current user."""
    chat_service = ChatService(db)
    conversations = await chat_service.get_recent_conversations(user.id)
    return {"conversations": conversations}


@router.get("/online")
async def get_online_users(
    user: User = Depends(get_current_user),
):
    """Get list of online users."""
    online_ids = manager.get_online_users()
    return {"online_user_ids": online_ids}


@router.delete("/messages/{message_id}")
async def delete_message(
    message_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a message (only sender can delete)."""
    chat_service = ChatService(db)
    success = await chat_service.delete_message(message_id, user.id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found or you cannot delete it",
        )
    
    return {"message": "Message deleted"}


# ===================
# WEBSOCKET ENDPOINT
# ===================

@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str,
):
    """WebSocket endpoint for real-time chat.
    
    Connect with: ws://host/api/chat/ws?token=<access_token>
    
    Message types:
    - send: Send a message {"type": "send", "recipient_id": null|int, "content": "..."}
    - typing: Typing indicator {"type": "typing", "recipient_id": null|int, "is_typing": bool}
    - read: Mark messages read {"type": "read", "message_id": int}
    
    Server sends:
    - new_message: New message received
    - typing: User typing indicator
    - user_online: User came online
    - user_offline: User went offline
    """
    # Validate token
    payload = decode_access_token(token)
    if not payload:
        await websocket.close(code=4001, reason="Invalid token")
        return
    
    user_id = payload.user_id
    user_name = payload.email  # Will be replaced with actual name
    
    # Get user info from database
    async for db in get_db():
        auth_service = AuthService(db)
        user = await auth_service.get_user_by_id(user_id)
        if user:
            user_name = f"{user.first_name} {user.last_name}"
        break
    
    # Connect
    await manager.connect(websocket, user_id)
    
    # Notify others that user is online
    await manager.broadcast({
        "type": "user_online",
        "user_id": user_id,
        "user_name": user_name,
    }, exclude_user_id=user_id)
    
    try:
        while True:
            # Receive message
            data = await websocket.receive_json()
            msg_type = data.get("type")
            
            if msg_type == "typing":
                # Handle typing indicator
                recipient_id = data.get("recipient_id")
                is_typing = data.get("is_typing", False)
                
                manager.set_typing(user_id, recipient_id, is_typing)
                
                # Send typing indicator to recipient
                typing_msg = {
                    "type": "typing",
                    "user_id": user_id,
                    "user_name": user_name,
                    "is_typing": is_typing,
                }
                
                if recipient_id:
                    await manager.send_to_user(recipient_id, typing_msg)
                else:
                    await manager.broadcast(typing_msg, exclude_user_id=user_id)
            
            elif msg_type == "send":
                # Handle sending a message
                async for db in get_db():
                    chat_service = ChatService(db)
                    message_data = ChatMessageCreate(
                        recipient_id=data.get("recipient_id"),
                        content=data.get("content", ""),
                    )
                    message = await chat_service.send_message(user_id, message_data)
                    message.sender = user
                    
                    response = message_to_response(message)
                    ws_message = {
                        "type": "new_message",
                        "message": response.model_dump(mode='json'),
                    }
                    
                    # Send to recipient or broadcast
                    if data.get("recipient_id"):
                        await manager.send_to_user(data["recipient_id"], ws_message)
                        # Also send back to sender
                        await manager.send_to_user(user_id, ws_message)
                    else:
                        await manager.broadcast(ws_message)
                    
                    # Clear typing status
                    manager.set_typing(user_id, data.get("recipient_id"), False)
                    break
            
            elif msg_type == "read":
                # Handle marking message as read
                message_id = data.get("message_id")
                if message_id:
                    async for db in get_db():
                        chat_service = ChatService(db)
                        await chat_service.mark_as_read(message_id, user_id)
                        break
            
            elif msg_type == "ping":
                # Keepalive
                await websocket.send_json({"type": "pong"})
    
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)
        
        # Notify others that user is offline
        await manager.broadcast({
            "type": "user_offline",
            "user_id": user_id,
            "user_name": user_name,
        })
    except Exception as e:
        print(f"WebSocket error: {e}")
        manager.disconnect(websocket, user_id)
