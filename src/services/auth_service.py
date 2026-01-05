"""Authentication service for user management and token handling."""

import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Optional

import jwt
from passlib.context import CryptContext
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.config import get_settings
from src.models.auth_models import User, UserSession, UserRole
from src.models.auth_schemas import (
    UserCreate, UserUpdate, UserUpdateByAdmin, 
    UserResponse, LoginResponse, TokenPayload, PasswordChange
)

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Settings
settings = get_settings()
SECRET_KEY = settings.openai_api_key[:32] if settings.openai_api_key else "dev-secret-key-change-in-prod"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24


def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(user: User, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token."""
    if expires_delta is None:
        expires_delta = timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    
    expire = datetime.utcnow() + expires_delta
    payload = {
        "user_id": user.id,
        "email": user.email,
        "role": user.role.value,
        "exp": expire,
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> Optional[TokenPayload]:
    """Decode and validate a JWT access token."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return TokenPayload(
            user_id=payload["user_id"],
            email=payload["email"],
            role=UserRole(payload["role"]),
            exp=datetime.fromtimestamp(payload["exp"]),
        )
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def hash_token(token: str) -> str:
    """Hash a token for storage."""
    return hashlib.sha256(token.encode()).hexdigest()


class AuthService:
    """Authentication and user management service."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_user(self, user_data: UserCreate) -> User:
        """Create a new user."""
        user = User(
            email=user_data.email.lower(),
            password_hash=hash_password(user_data.password),
            first_name=user_data.first_name,
            last_name=user_data.last_name,
            phone=user_data.phone,
            bio=user_data.bio,
            role=user_data.role,
        )
        self.db.add(user)
        await self.db.flush()
        await self.db.refresh(user)
        return user

    async def authenticate(self, email: str, password: str) -> Optional[User]:
        """Authenticate a user by email and password."""
        user = await self.get_user_by_email(email)
        if not user:
            return None
        if not user.is_active:
            return None
        if not verify_password(password, user.password_hash):
            return None
        
        # Update last login
        user.last_login = datetime.utcnow()
        await self.db.flush()
        
        return user

    async def login(self, email: str, password: str) -> Optional[LoginResponse]:
        """Authenticate and return a login response with token."""
        user = await self.authenticate(email, password)
        if not user:
            return None
        
        token = create_access_token(user)
        
        # Create session
        session = UserSession(
            user_id=user.id,
            token_hash=hash_token(token),
            expires_at=datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS),
        )
        self.db.add(session)
        await self.db.flush()
        
        return LoginResponse(
            access_token=token,
            user=UserResponse.model_validate(user),
            expires_in=ACCESS_TOKEN_EXPIRE_HOURS * 3600,
        )

    async def logout(self, token: str) -> bool:
        """Invalidate a user session."""
        token_hash = hash_token(token)
        result = await self.db.execute(
            update(UserSession)
            .where(UserSession.token_hash == token_hash)
            .values(is_valid=False)
        )
        return result.rowcount > 0

    async def validate_token(self, token: str) -> Optional[User]:
        """Validate a token and return the associated user."""
        payload = decode_access_token(token)
        if not payload:
            return None
        
        # Check session is still valid
        token_hash = hash_token(token)
        result = await self.db.execute(
            select(UserSession).where(
                UserSession.token_hash == token_hash,
                UserSession.is_valid == True,
                UserSession.expires_at > datetime.utcnow(),
            )
        )
        session = result.scalar_one_or_none()
        if not session:
            return None
        
        # Update last used
        session.last_used = datetime.utcnow()
        await self.db.flush()
        
        return await self.get_user_by_id(payload.user_id)

    async def get_user_by_id(self, user_id: int) -> Optional[User]:
        """Get a user by ID."""
        result = await self.db.execute(
            select(User).where(User.id == user_id)
        )
        return result.scalar_one_or_none()

    async def get_user_by_email(self, email: str) -> Optional[User]:
        """Get a user by email."""
        result = await self.db.execute(
            select(User).where(User.email == email.lower())
        )
        return result.scalar_one_or_none()

    async def get_all_users(self, include_inactive: bool = False) -> list[User]:
        """Get all users."""
        query = select(User).order_by(User.last_name, User.first_name)
        if not include_inactive:
            query = query.where(User.is_active == True)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_users_by_role(self, role: UserRole) -> list[User]:
        """Get all users with a specific role."""
        result = await self.db.execute(
            select(User)
            .where(User.role == role, User.is_active == True)
            .order_by(User.last_name, User.first_name)
        )
        return list(result.scalars().all())

    async def update_user(self, user_id: int, user_data: UserUpdate) -> Optional[User]:
        """Update a user's profile."""
        user = await self.get_user_by_id(user_id)
        if not user:
            return None
        
        update_data = user_data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(user, key, value)
        
        await self.db.flush()
        await self.db.refresh(user)
        return user

    async def update_user_by_admin(self, user_id: int, user_data: UserUpdateByAdmin) -> Optional[User]:
        """Admin update of a user (can change role and active status)."""
        user = await self.get_user_by_id(user_id)
        if not user:
            return None
        
        update_data = user_data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(user, key, value)
        
        await self.db.flush()
        await self.db.refresh(user)
        return user

    async def change_password(self, user_id: int, password_data: PasswordChange) -> bool:
        """Change a user's password."""
        user = await self.get_user_by_id(user_id)
        if not user:
            return False
        
        if not verify_password(password_data.current_password, user.password_hash):
            return False
        
        user.password_hash = hash_password(password_data.new_password)
        await self.db.flush()
        return True

    async def reset_password(self, user_id: int, new_password: str) -> bool:
        """Admin reset of a user's password."""
        user = await self.get_user_by_id(user_id)
        if not user:
            return False
        
        user.password_hash = hash_password(new_password)
        await self.db.flush()
        return True

    async def delete_user(self, user_id: int) -> bool:
        """Soft delete a user by deactivating them."""
        user = await self.get_user_by_id(user_id)
        if not user:
            return False
        
        user.is_active = False
        await self.db.flush()
        return True

    async def create_default_users(self) -> None:
        """Create default admin users if they don't exist."""
        defaults = [
            {
                "email": "director@bethesdamission.org",
                "password": "director123",
                "first_name": "Admin",
                "last_name": "Director",
                "role": UserRole.DIRECTOR,
            },
            {
                "email": "lifecoach@bethesdamission.org", 
                "password": "lifecoach123",
                "first_name": "Life",
                "last_name": "Coach",
                "role": UserRole.LIFE_COACH,
            },
            {
                "email": "supervisor@bethesdamission.org",
                "password": "supervisor123",
                "first_name": "Shift",
                "last_name": "Supervisor",
                "role": UserRole.SUPERVISOR,
            },
        ]
        
        for user_data in defaults:
            existing = await self.get_user_by_email(user_data["email"])
            if not existing:
                user = User(
                    email=user_data["email"],
                    password_hash=hash_password(user_data["password"]),
                    first_name=user_data["first_name"],
                    last_name=user_data["last_name"],
                    role=user_data["role"],
                )
                self.db.add(user)
        
        await self.db.flush()
