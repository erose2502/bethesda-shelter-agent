"""Pydantic schemas for authentication and authorization."""
from datetime import datetime
from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, Field, EmailStr


# ===================
# ENUMS
# ===================
class UserRole(str, Enum):
    DIRECTOR = "director"
    LIFE_COACH = "life_coach"
    SUPERVISOR = "supervisor"


class TaskStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class TaskPriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


# ===================
# USER SCHEMAS
# ===================
class UserBase(BaseModel):
    email: EmailStr
    first_name: str = Field(..., min_length=1, max_length=64)
    last_name: str = Field(..., min_length=1, max_length=64)
    phone: Optional[str] = Field(None, max_length=20)
    bio: Optional[str] = None


class UserCreate(UserBase):
    password: str = Field(..., min_length=6, max_length=128)
    role: UserRole = UserRole.SUPERVISOR


class UserUpdate(BaseModel):
    first_name: Optional[str] = Field(None, min_length=1, max_length=64)
    last_name: Optional[str] = Field(None, min_length=1, max_length=64)
    phone: Optional[str] = Field(None, max_length=20)
    bio: Optional[str] = None
    avatar_url: Optional[str] = None


class UserUpdateByAdmin(UserUpdate):
    """Admin can also update role and active status."""
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=6, max_length=128)


class UserResponse(BaseModel):
    id: int
    email: str
    first_name: str
    last_name: str
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    role: UserRole
    is_active: bool
    created_at: datetime
    last_login: Optional[datetime] = None

    class Config:
        from_attributes = True

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"


class UserListResponse(BaseModel):
    users: List[UserResponse]
    total: int


# ===================
# AUTH SCHEMAS
# ===================
class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
    expires_in: int  # seconds


class TokenPayload(BaseModel):
    user_id: int
    email: str
    role: UserRole
    exp: datetime


# ===================
# TASK SCHEMAS
# ===================
class TaskBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=256)
    description: Optional[str] = None
    priority: TaskPriority = TaskPriority.MEDIUM
    due_date: Optional[datetime] = None


class TaskCreate(TaskBase):
    assignee_id: Optional[int] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=256)
    description: Optional[str] = None
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    assignee_id: Optional[int] = None
    due_date: Optional[datetime] = None


class TaskResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    status: TaskStatus
    priority: TaskPriority
    due_date: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    creator: UserResponse
    assignee: Optional[UserResponse] = None

    class Config:
        from_attributes = True


class TaskListResponse(BaseModel):
    tasks: List[TaskResponse]
    total: int


# ===================
# CHAT SCHEMAS
# ===================
class ChatMessageCreate(BaseModel):
    recipient_id: Optional[int] = None  # null = broadcast
    content: str = Field(..., min_length=1, max_length=4096)


class ChatMessageResponse(BaseModel):
    id: int
    sender_id: int
    sender_name: str
    sender_avatar: Optional[str] = None
    recipient_id: Optional[int] = None
    content: str
    is_read: bool
    created_at: datetime
    read_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ChatMessageListResponse(BaseModel):
    messages: List[ChatMessageResponse]
    total: int


class TypingIndicator(BaseModel):
    user_id: int
    user_name: str
    is_typing: bool
    recipient_id: Optional[int] = None  # who they're typing to


class UnreadCount(BaseModel):
    total: int
    by_sender: dict[int, int] = {}  # sender_id -> count


# ===================
# PERMISSION SCHEMAS
# ===================
class PermissionSet(BaseModel):
    """Describes what a role can do."""
    # Bed management
    can_view_beds: bool = True
    can_assign_beds: bool = False
    can_unassign_beds: bool = False
    
    # Reservation management
    can_view_reservations: bool = True
    can_create_reservations: bool = False
    can_accept_reservations: bool = False
    can_check_in_reservations: bool = False
    can_cancel_reservations: bool = False
    
    # Guest management
    can_view_guests: bool = True
    can_create_guests: bool = False
    can_edit_guest_basic: bool = False  # name, phone, etc.
    can_edit_guest_case: bool = False   # programs, employment, life coach
    can_delete_guests: bool = False
    
    # Volunteer management
    can_view_volunteers: bool = True
    can_manage_volunteers: bool = False
    
    # Chapel management
    can_view_chapel: bool = True
    can_manage_chapel: bool = False
    
    # Task management
    can_view_tasks: bool = True
    can_create_tasks: bool = False
    can_assign_tasks: bool = False
    can_update_own_tasks: bool = True
    
    # User management
    can_view_users: bool = False
    can_manage_users: bool = False
    
    # Chat
    can_use_chat: bool = True


# Role permission mappings
ROLE_PERMISSIONS = {
    UserRole.DIRECTOR: PermissionSet(
        can_assign_beds=True,
        can_unassign_beds=True,
        can_create_reservations=True,
        can_accept_reservations=True,
        can_check_in_reservations=True,
        can_cancel_reservations=True,
        can_create_guests=True,
        can_edit_guest_basic=True,
        can_edit_guest_case=True,
        can_delete_guests=True,
        can_manage_volunteers=True,
        can_manage_chapel=True,
        can_create_tasks=True,
        can_assign_tasks=True,
        can_view_users=True,
        can_manage_users=True,
    ),
    UserRole.LIFE_COACH: PermissionSet(
        can_assign_beds=True,
        can_unassign_beds=True,
        can_create_reservations=False,
        can_accept_reservations=False,
        can_check_in_reservations=False,
        can_cancel_reservations=False,
        can_create_guests=True,
        can_edit_guest_basic=True,
        can_edit_guest_case=True,
        can_delete_guests=False,
        can_manage_volunteers=False,
        can_manage_chapel=False,
        can_create_tasks=False,
        can_assign_tasks=False,
        can_view_users=True,
        can_manage_users=False,
    ),
    UserRole.SUPERVISOR: PermissionSet(
        can_assign_beds=False,
        can_unassign_beds=False,
        can_create_reservations=False,
        can_accept_reservations=True,
        can_check_in_reservations=True,
        can_cancel_reservations=True,
        can_create_guests=False,
        can_edit_guest_basic=False,
        can_edit_guest_case=False,
        can_delete_guests=False,
        can_manage_volunteers=True,
        can_manage_chapel=True,
        can_create_tasks=False,
        can_assign_tasks=False,
        can_view_users=True,
        can_manage_users=False,
    ),
}


def get_permissions(role: UserRole) -> PermissionSet:
    """Get permissions for a given role."""
    return ROLE_PERMISSIONS.get(role, PermissionSet())
