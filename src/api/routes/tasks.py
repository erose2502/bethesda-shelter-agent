"""Task management API routes."""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.database import get_db
from src.api.routes.auth import get_current_user, require_permission
from src.services.task_service import TaskService, task_to_response
from src.models.auth_models import User, TaskStatus
from src.models.auth_schemas import (
    TaskCreate, TaskUpdate, TaskResponse, TaskListResponse
)

router = APIRouter(prefix="/api/tasks", tags=["Tasks"])


# ===================
# TASK ENDPOINTS
# ===================

@router.get("/", response_model=TaskListResponse)
async def list_tasks(
    status: Optional[TaskStatus] = None,
    assignee_id: Optional[int] = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all tasks (optionally filtered by status or assignee)."""
    task_service = TaskService(db)
    tasks = await task_service.get_all_tasks(status=status, assignee_id=assignee_id)
    
    return TaskListResponse(
        tasks=[task_to_response(t) for t in tasks],
        total=len(tasks),
    )


@router.get("/mine", response_model=TaskListResponse)
async def get_my_tasks(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get tasks assigned to the current user."""
    task_service = TaskService(db)
    tasks = await task_service.get_tasks_for_user(user.id)
    
    return TaskListResponse(
        tasks=[task_to_response(t) for t in tasks],
        total=len(tasks),
    )


@router.get("/created", response_model=TaskListResponse)
async def get_created_tasks(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get tasks created by the current user."""
    task_service = TaskService(db)
    tasks = await task_service.get_tasks_created_by_user(user.id)
    
    return TaskListResponse(
        tasks=[task_to_response(t) for t in tasks],
        total=len(tasks),
    )


@router.get("/stats")
async def get_task_stats(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get task statistics."""
    task_service = TaskService(db)
    return await task_service.get_task_stats()


@router.post("/", response_model=TaskResponse)
async def create_task(
    task_data: TaskCreate,
    user: User = Depends(require_permission("can_create_tasks")),
    db: AsyncSession = Depends(get_db),
):
    """Create a new task (requires can_create_tasks permission - Director only)."""
    task_service = TaskService(db)
    task = await task_service.create_task(user.id, task_data)
    
    # Reload with relationships
    task = await task_service.get_task_by_id(task.id)
    return task_to_response(task)


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a task by ID."""
    task_service = TaskService(db)
    task = await task_service.get_task_by_id(task_id)
    
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )
    
    return task_to_response(task)


@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: int,
    task_data: TaskUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a task.
    
    - Directors can update any task
    - Assignees can update status of their assigned tasks
    - Creators can update their created tasks
    """
    from src.models.auth_schemas import get_permissions
    
    task_service = TaskService(db)
    task = await task_service.get_task_by_id(task_id)
    
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )
    
    permissions = get_permissions(user.role)
    
    # Check permissions
    can_update = (
        permissions.can_assign_tasks or  # Directors can do anything
        task.creator_id == user.id or    # Creators can update their tasks
        task.assignee_id == user.id      # Assignees can update status
    )
    
    if not can_update:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to update this task",
        )
    
    # Non-directors can only update status
    if not permissions.can_assign_tasks and task.assignee_id == user.id:
        # Only allow status updates
        task_data = TaskUpdate(status=task_data.status)
    
    updated = await task_service.update_task(task_id, task_data)
    return task_to_response(updated)


@router.post("/{task_id}/assign/{assignee_id}", response_model=TaskResponse)
async def assign_task(
    task_id: int,
    assignee_id: int,
    user: User = Depends(require_permission("can_assign_tasks")),
    db: AsyncSession = Depends(get_db),
):
    """Assign a task to a user (requires can_assign_tasks permission - Director only)."""
    task_service = TaskService(db)
    task = await task_service.assign_task(task_id, assignee_id)
    
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )
    
    return task_to_response(task)


@router.post("/{task_id}/unassign", response_model=TaskResponse)
async def unassign_task(
    task_id: int,
    user: User = Depends(require_permission("can_assign_tasks")),
    db: AsyncSession = Depends(get_db),
):
    """Remove assignment from a task (requires can_assign_tasks permission)."""
    task_service = TaskService(db)
    task = await task_service.unassign_task(task_id)
    
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )
    
    return task_to_response(task)


@router.post("/{task_id}/status/{status_value}", response_model=TaskResponse)
async def update_task_status(
    task_id: int,
    status_value: TaskStatus,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update task status (assignee or creator can update)."""
    task_service = TaskService(db)
    task = await task_service.update_task_status(task_id, status_value, user.id)
    
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found or you don't have permission to update it",
        )
    
    return task_to_response(task)


@router.delete("/{task_id}")
async def delete_task(
    task_id: int,
    user: User = Depends(require_permission("can_create_tasks")),
    db: AsyncSession = Depends(get_db),
):
    """Delete a task (requires can_create_tasks permission - Director only)."""
    task_service = TaskService(db)
    
    # Verify task exists
    task = await task_service.get_task_by_id(task_id)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )
    
    await task_service.delete_task(task_id)
    return {"message": "Task deleted successfully"}
