"""Task management service for directors to assign tasks to staff."""

from datetime import datetime
from typing import Optional, List

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.models.auth_models import Task, User, TaskStatus, TaskPriority
from src.models.auth_schemas import TaskCreate, TaskUpdate, TaskResponse


class TaskService:
    """Task management service."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_task(self, creator_id: int, task_data: TaskCreate) -> Task:
        """Create a new task."""
        task = Task(
            title=task_data.title,
            description=task_data.description,
            creator_id=creator_id,
            assignee_id=task_data.assignee_id,
            priority=task_data.priority,
            due_date=task_data.due_date,
        )
        self.db.add(task)
        await self.db.flush()
        await self.db.refresh(task)
        return task

    async def get_task_by_id(self, task_id: int) -> Optional[Task]:
        """Get a task by ID."""
        result = await self.db.execute(
            select(Task)
            .options(
                selectinload(Task.creator),
                selectinload(Task.assignee),
            )
            .where(Task.id == task_id)
        )
        return result.scalar_one_or_none()

    async def get_all_tasks(
        self,
        status: Optional[TaskStatus] = None,
        assignee_id: Optional[int] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[Task]:
        """Get all tasks with optional filters."""
        query = (
            select(Task)
            .options(
                selectinload(Task.creator),
                selectinload(Task.assignee),
            )
        )
        
        conditions = []
        if status:
            conditions.append(Task.status == status)
        if assignee_id:
            conditions.append(Task.assignee_id == assignee_id)
        
        if conditions:
            query = query.where(and_(*conditions))
        
        query = query.order_by(
            Task.priority.desc(),
            Task.due_date.asc().nullslast(),
            Task.created_at.desc()
        ).limit(limit).offset(offset)
        
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_tasks_for_user(self, user_id: int) -> List[Task]:
        """Get all tasks assigned to a user."""
        result = await self.db.execute(
            select(Task)
            .options(
                selectinload(Task.creator),
                selectinload(Task.assignee),
            )
            .where(Task.assignee_id == user_id)
            .order_by(
                Task.status.asc(),
                Task.priority.desc(),
                Task.due_date.asc().nullslast(),
            )
        )
        return list(result.scalars().all())

    async def get_tasks_created_by_user(self, user_id: int) -> List[Task]:
        """Get all tasks created by a user."""
        result = await self.db.execute(
            select(Task)
            .options(
                selectinload(Task.creator),
                selectinload(Task.assignee),
            )
            .where(Task.creator_id == user_id)
            .order_by(Task.created_at.desc())
        )
        return list(result.scalars().all())

    async def update_task(self, task_id: int, task_data: TaskUpdate) -> Optional[Task]:
        """Update a task."""
        task = await self.get_task_by_id(task_id)
        if not task:
            return None
        
        update_data = task_data.model_dump(exclude_unset=True)
        
        # If completing the task, set completed_at
        if update_data.get("status") == TaskStatus.COMPLETED:
            update_data["completed_at"] = datetime.utcnow()
        
        for key, value in update_data.items():
            setattr(task, key, value)
        
        await self.db.flush()
        await self.db.refresh(task)
        return task

    async def delete_task(self, task_id: int) -> bool:
        """Delete a task."""
        task = await self.get_task_by_id(task_id)
        if not task:
            return False
        
        await self.db.delete(task)
        await self.db.flush()
        return True

    async def assign_task(self, task_id: int, assignee_id: int) -> Optional[Task]:
        """Assign a task to a user."""
        task = await self.get_task_by_id(task_id)
        if not task:
            return None
        
        task.assignee_id = assignee_id
        await self.db.flush()
        await self.db.refresh(task)
        return task

    async def unassign_task(self, task_id: int) -> Optional[Task]:
        """Remove assignment from a task."""
        task = await self.get_task_by_id(task_id)
        if not task:
            return None
        
        task.assignee_id = None
        await self.db.flush()
        await self.db.refresh(task)
        return task

    async def update_task_status(
        self, 
        task_id: int, 
        status: TaskStatus,
        user_id: int
    ) -> Optional[Task]:
        """Update task status (assignee can update their own tasks)."""
        task = await self.get_task_by_id(task_id)
        if not task:
            return None
        
        # Only assignee or creator can update status
        if task.assignee_id != user_id and task.creator_id != user_id:
            return None
        
        task.status = status
        if status == TaskStatus.COMPLETED:
            task.completed_at = datetime.utcnow()
        
        await self.db.flush()
        await self.db.refresh(task)
        return task

    async def get_task_stats(self) -> dict:
        """Get task statistics."""
        result = await self.db.execute(select(Task))
        tasks = result.scalars().all()
        
        stats = {
            "total": len(tasks),
            "pending": sum(1 for t in tasks if t.status == TaskStatus.PENDING),
            "in_progress": sum(1 for t in tasks if t.status == TaskStatus.IN_PROGRESS),
            "completed": sum(1 for t in tasks if t.status == TaskStatus.COMPLETED),
            "cancelled": sum(1 for t in tasks if t.status == TaskStatus.CANCELLED),
            "overdue": sum(
                1 for t in tasks 
                if t.due_date and t.due_date < datetime.utcnow() 
                and t.status not in [TaskStatus.COMPLETED, TaskStatus.CANCELLED]
            ),
        }
        
        return stats


def task_to_response(task: Task) -> TaskResponse:
    """Convert a Task model to a response schema."""
    from src.models.auth_schemas import UserResponse
    
    return TaskResponse(
        id=task.id,
        title=task.title,
        description=task.description,
        status=task.status,
        priority=task.priority,
        due_date=task.due_date,
        completed_at=task.completed_at,
        created_at=task.created_at,
        updated_at=task.updated_at,
        creator=UserResponse.model_validate(task.creator) if task.creator else None,
        assignee=UserResponse.model_validate(task.assignee) if task.assignee else None,
    )
