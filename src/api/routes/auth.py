"""Authentication API routes."""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.database import get_db
from src.services.auth_service import AuthService, decode_access_token
from src.models.auth_models import User, UserRole
from src.models.auth_schemas import (
    UserCreate, UserUpdate, UserUpdateByAdmin, UserResponse, 
    UserListResponse, LoginRequest, LoginResponse, PasswordChange,
    get_permissions, PermissionSet
)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


async def get_current_user(
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Get the current authenticated user from the Authorization header."""
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Extract token from "Bearer <token>"
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token = parts[1]
    auth_service = AuthService(db)
    user = await auth_service.validate_token(token)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return user


async def get_optional_user(
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    """Get the current user if authenticated, or None."""
    if not authorization:
        return None
    
    try:
        return await get_current_user(authorization, db)
    except HTTPException:
        return None


def require_role(*roles: UserRole):
    """Dependency factory that requires specific roles."""
    async def check_role(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"This action requires one of these roles: {', '.join(r.value for r in roles)}",
            )
        return user
    return check_role


def require_permission(permission_name: str):
    """Dependency factory that checks a specific permission."""
    async def check_permission(user: User = Depends(get_current_user)) -> User:
        permissions = get_permissions(user.role)
        if not getattr(permissions, permission_name, False):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"You don't have permission for this action",
            )
        return user
    return check_permission


# ===================
# AUTH ENDPOINTS
# ===================

@router.post("/login", response_model=LoginResponse)
async def login(
    request: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """Authenticate and get an access token."""
    auth_service = AuthService(db)
    result = await auth_service.login(request.email, request.password)
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    
    return result


@router.post("/logout")
async def logout(
    authorization: str = Header(...),
    db: AsyncSession = Depends(get_db),
):
    """Invalidate the current session."""
    token = authorization.replace("Bearer ", "")
    auth_service = AuthService(db)
    await auth_service.logout(token)
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    user: User = Depends(get_current_user),
):
    """Get the current user's information."""
    return UserResponse.model_validate(user)


@router.get("/me/permissions", response_model=PermissionSet)
async def get_current_user_permissions(
    user: User = Depends(get_current_user),
):
    """Get the current user's permissions."""
    return get_permissions(user.role)


@router.put("/me", response_model=UserResponse)
async def update_current_user(
    user_data: UserUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update the current user's profile."""
    auth_service = AuthService(db)
    updated = await auth_service.update_user(user.id, user_data)
    return UserResponse.model_validate(updated)


@router.post("/me/change-password")
async def change_password(
    password_data: PasswordChange,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Change the current user's password."""
    auth_service = AuthService(db)
    success = await auth_service.change_password(user.id, password_data)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )
    
    return {"message": "Password changed successfully"}


# ===================
# USER MANAGEMENT (DIRECTOR ONLY)
# ===================

@router.get("/users", response_model=UserListResponse)
async def list_users(
    include_inactive: bool = False,
    user: User = Depends(require_permission("can_view_users")),
    db: AsyncSession = Depends(get_db),
):
    """List all users (requires can_view_users permission)."""
    auth_service = AuthService(db)
    users = await auth_service.get_all_users(include_inactive)
    return UserListResponse(
        users=[UserResponse.model_validate(u) for u in users],
        total=len(users),
    )


@router.post("/users", response_model=UserResponse)
async def create_user(
    user_data: UserCreate,
    user: User = Depends(require_permission("can_manage_users")),
    db: AsyncSession = Depends(get_db),
):
    """Create a new user (requires can_manage_users permission)."""
    auth_service = AuthService(db)
    
    # Check if email already exists
    existing = await auth_service.get_user_by_email(user_data.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email already exists",
        )
    
    new_user = await auth_service.create_user(user_data)
    return UserResponse.model_validate(new_user)


@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    user: User = Depends(require_permission("can_view_users")),
    db: AsyncSession = Depends(get_db),
):
    """Get a user by ID (requires can_view_users permission)."""
    auth_service = AuthService(db)
    target_user = await auth_service.get_user_by_id(user_id)
    
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    
    return UserResponse.model_validate(target_user)


@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    user_data: UserUpdateByAdmin,
    user: User = Depends(require_permission("can_manage_users")),
    db: AsyncSession = Depends(get_db),
):
    """Update a user (requires can_manage_users permission)."""
    auth_service = AuthService(db)
    updated = await auth_service.update_user_by_admin(user_id, user_data)
    
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    
    return UserResponse.model_validate(updated)


@router.post("/users/{user_id}/reset-password")
async def reset_user_password(
    user_id: int,
    new_password: str,
    user: User = Depends(require_permission("can_manage_users")),
    db: AsyncSession = Depends(get_db),
):
    """Reset a user's password (requires can_manage_users permission)."""
    auth_service = AuthService(db)
    success = await auth_service.reset_password(user_id, new_password)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    
    return {"message": "Password reset successfully"}


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    user: User = Depends(require_permission("can_manage_users")),
    db: AsyncSession = Depends(get_db),
):
    """Deactivate a user (requires can_manage_users permission)."""
    if user_id == user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot deactivate your own account",
        )
    
    auth_service = AuthService(db)
    success = await auth_service.delete_user(user_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    
    return {"message": "User deactivated successfully"}
