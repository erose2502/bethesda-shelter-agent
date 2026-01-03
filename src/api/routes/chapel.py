"""Chapel service scheduling API routes."""

from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from src.db.database import get_db
from src.models.db_models import ChapelService, ChapelStatus
from src.models.schemas import (
    ChapelServiceCreate,
    ChapelServiceUpdate,
    ChapelServiceResponse,
    ChapelStatus as ChapelStatusSchema,
)

router = APIRouter(prefix="/api/chapel", tags=["chapel"])


@router.get("/", response_model=List[ChapelServiceResponse])
async def get_all_chapel_services(db: AsyncSession = Depends(get_db)):
    """Get all chapel services."""
    result = await db.execute(
        select(ChapelService).order_by(ChapelService.date, ChapelService.time)
    )
    services = result.scalars().all()
    return [_to_response(s) for s in services]


@router.get("/{service_id}", response_model=ChapelServiceResponse)
async def get_chapel_service(service_id: int, db: AsyncSession = Depends(get_db)):
    """Get a specific chapel service."""
    result = await db.execute(
        select(ChapelService).where(ChapelService.id == service_id)
    )
    service = result.scalar_one_or_none()
    if not service:
        raise HTTPException(status_code=404, detail="Chapel service not found")
    return _to_response(service)


@router.post("/", response_model=ChapelServiceResponse)
async def create_chapel_service(
    data: ChapelServiceCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create a new chapel service."""
    # Validate weekday only
    from datetime import datetime
    try:
        date_obj = datetime.strptime(data.date, "%Y-%m-%d")
        if date_obj.weekday() >= 5:  # Saturday = 5, Sunday = 6
            raise HTTPException(
                status_code=400,
                detail="Chapel services are only available on weekdays (Monday-Friday)"
            )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    # Validate time slot
    valid_times = ["10:00", "13:00", "19:00"]
    if data.time not in valid_times:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid time. Must be one of: {', '.join(valid_times)}"
        )
    
    # Check for conflicts (same date and time)
    result = await db.execute(
        select(ChapelService).where(
            ChapelService.date == data.date,
            ChapelService.time == data.time,
            ChapelService.status != ChapelStatus.CANCELLED
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=400,
            detail="A chapel service is already scheduled for this date and time"
        )
    
    service = ChapelService(
        date=data.date,
        time=data.time,
        group_name=data.group_name,
        contact_name=data.contact_name,
        contact_phone=data.contact_phone,
        contact_email=data.contact_email,
        notes=data.notes,
        status=ChapelStatus.PENDING,
    )
    db.add(service)
    await db.commit()
    await db.refresh(service)
    
    return _to_response(service)


@router.put("/{service_id}", response_model=ChapelServiceResponse)
async def update_chapel_service(
    service_id: int,
    data: ChapelServiceUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update a chapel service."""
    result = await db.execute(
        select(ChapelService).where(ChapelService.id == service_id)
    )
    service = result.scalar_one_or_none()
    if not service:
        raise HTTPException(status_code=404, detail="Chapel service not found")
    
    # Update fields if provided
    if data.date is not None:
        # Validate weekday
        from datetime import datetime
        try:
            date_obj = datetime.strptime(data.date, "%Y-%m-%d")
            if date_obj.weekday() >= 5:
                raise HTTPException(
                    status_code=400,
                    detail="Chapel services are only available on weekdays"
                )
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format")
        service.date = data.date
    
    if data.time is not None:
        valid_times = ["10:00", "13:00", "19:00"]
        if data.time not in valid_times:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid time. Must be one of: {', '.join(valid_times)}"
            )
        service.time = data.time
    
    if data.group_name is not None:
        service.group_name = data.group_name
    if data.contact_name is not None:
        service.contact_name = data.contact_name
    if data.contact_phone is not None:
        service.contact_phone = data.contact_phone
    if data.contact_email is not None:
        service.contact_email = data.contact_email
    if data.notes is not None:
        service.notes = data.notes
    if data.status is not None:
        service.status = ChapelStatus(data.status.value)
    
    await db.commit()
    await db.refresh(service)
    
    return _to_response(service)


@router.delete("/{service_id}")
async def delete_chapel_service(service_id: int, db: AsyncSession = Depends(get_db)):
    """Delete a chapel service."""
    result = await db.execute(
        select(ChapelService).where(ChapelService.id == service_id)
    )
    service = result.scalar_one_or_none()
    if not service:
        raise HTTPException(status_code=404, detail="Chapel service not found")
    
    await db.delete(service)
    await db.commit()
    
    return {"message": "Chapel service deleted"}


@router.post("/{service_id}/confirm", response_model=ChapelServiceResponse)
async def confirm_chapel_service(service_id: int, db: AsyncSession = Depends(get_db)):
    """Confirm a pending chapel service."""
    result = await db.execute(
        select(ChapelService).where(ChapelService.id == service_id)
    )
    service = result.scalar_one_or_none()
    if not service:
        raise HTTPException(status_code=404, detail="Chapel service not found")
    
    service.status = ChapelStatus.CONFIRMED
    await db.commit()
    await db.refresh(service)
    
    return _to_response(service)


@router.post("/{service_id}/complete", response_model=ChapelServiceResponse)
async def complete_chapel_service(service_id: int, db: AsyncSession = Depends(get_db)):
    """Mark a chapel service as completed."""
    result = await db.execute(
        select(ChapelService).where(ChapelService.id == service_id)
    )
    service = result.scalar_one_or_none()
    if not service:
        raise HTTPException(status_code=404, detail="Chapel service not found")
    
    service.status = ChapelStatus.COMPLETED
    await db.commit()
    await db.refresh(service)
    
    return _to_response(service)


def _to_response(service: ChapelService) -> ChapelServiceResponse:
    """Convert DB model to response schema."""
    return ChapelServiceResponse(
        id=service.id,
        date=service.date,
        time=service.time,
        group_name=service.group_name,
        contact_name=service.contact_name,
        contact_phone=service.contact_phone,
        contact_email=service.contact_email,
        notes=service.notes,
        status=ChapelStatusSchema(service.status.value),
        created_at=service.created_at,
    )
