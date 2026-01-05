"""Authentication and authorization models."""

import enum
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    Enum,
    Boolean,
    Text,
    ForeignKey,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from src.db.database import Base


class UserRole(enum.Enum):
    """User role enum.
    
    Permissions:
    - DIRECTOR: Full access (admin), can manage all users, guests, beds, tasks
    - LIFE_COACH: Can assign beds, edit guest case info (programs, employment, etc.)
    - SUPERVISOR: Can accept/check-in reservations, manage volunteers, chapel, donations
    """
    DIRECTOR = "director"
    LIFE_COACH = "life_coach"
    SUPERVISOR = "supervisor"


class TaskStatus(enum.Enum):
    """Task status enum."""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class TaskPriority(enum.Enum):
    """Task priority enum."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class User(Base):
    """
    User model for staff authentication and authorization.
    
    Roles:
    - director: Full admin access
    - life_coach: Bed assignment, guest case management
    - supervisor: Reservations, volunteers, chapel services
    """
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    email = Column(String(256), unique=True, nullable=False, index=True)
    password_hash = Column(String(256), nullable=False)
    
    # Profile
    first_name = Column(String(64), nullable=False)
    last_name = Column(String(64), nullable=False)
    phone = Column(String(20), nullable=True)
    avatar_url = Column(Text, nullable=True)
    bio = Column(Text, nullable=True)
    
    # Role and status
    role = Column(
        Enum(UserRole),
        default=UserRole.SUPERVISOR,
        nullable=False,
        index=True,
    )
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Timestamps
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    last_login = Column(DateTime, nullable=True)
    
    # Relationships
    assigned_tasks = relationship("Task", back_populates="assignee", foreign_keys="Task.assignee_id")
    created_tasks = relationship("Task", back_populates="creator", foreign_keys="Task.creator_id")
    sent_messages = relationship("ChatMessage", back_populates="sender", foreign_keys="ChatMessage.sender_id")

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"


class Task(Base):
    """
    Task assignment model.
    
    Directors can assign tasks to any staff member.
    Tasks can have priority levels and due dates.
    """
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True)
    title = Column(String(256), nullable=False)
    description = Column(Text, nullable=True)
    
    # Assignment
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    assignee_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Status and priority
    status = Column(
        Enum(TaskStatus),
        default=TaskStatus.PENDING,
        nullable=False,
        index=True,
    )
    priority = Column(
        Enum(TaskPriority),
        default=TaskPriority.MEDIUM,
        nullable=False,
    )
    
    # Dates
    due_date = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    creator = relationship("User", back_populates="created_tasks", foreign_keys=[creator_id])
    assignee = relationship("User", back_populates="assigned_tasks", foreign_keys=[assignee_id])


class ChatMessage(Base):
    """
    Real-time chat messages between staff members.
    
    Supports:
    - Direct messages between two users
    - Group messages (recipient_id is null for broadcast)
    - Typing indicators tracked separately
    """
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    recipient_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # null = broadcast to all
    
    content = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False, nullable=False)
    
    # Timestamps
    created_at = Column(DateTime, server_default=func.now())
    read_at = Column(DateTime, nullable=True)
    
    # Relationships
    sender = relationship("User", back_populates="sent_messages", foreign_keys=[sender_id])
    recipient = relationship("User", foreign_keys=[recipient_id])


class UserSession(Base):
    """
    User session for token management.
    
    Tracks active sessions and allows for session invalidation.
    """
    __tablename__ = "user_sessions"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    token_hash = Column(String(256), nullable=False, unique=True, index=True)
    
    # Device info
    device_info = Column(String(256), nullable=True)
    ip_address = Column(String(45), nullable=True)
    
    # Validity
    is_valid = Column(Boolean, default=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    
    # Timestamps
    created_at = Column(DateTime, server_default=func.now())
    last_used = Column(DateTime, server_default=func.now())
    
    # Relationship
    user = relationship("User")
