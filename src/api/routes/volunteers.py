"""Volunteer management API routes."""

import json
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from src.db.database import get_db
from src.models.db_models import Volunteer, VolunteerStatus
from src.models.schemas import (
    VolunteerCreate,
    VolunteerUpdate,
    VolunteerResponse,
    VolunteerStatus as VolunteerStatusSchema,
)

router = APIRouter(prefix="/api/volunteers", tags=["volunteers"])


@router.get("/", response_model=List[VolunteerResponse])
async def get_all_volunteers(db: AsyncSession = Depends(get_db)):
    """Get all volunteers."""
    result = await db.execute(
        select(Volunteer).order_by(Volunteer.name)
    )
    volunteers = result.scalars().all()
    return [_to_response(v) for v in volunteers]


@router.get("/{volunteer_id}", response_model=VolunteerResponse)
async def get_volunteer(volunteer_id: int, db: AsyncSession = Depends(get_db)):
    """Get a specific volunteer."""
    result = await db.execute(
        select(Volunteer).where(Volunteer.id == volunteer_id)
    )
    volunteer = result.scalar_one_or_none()
    if not volunteer:
        raise HTTPException(status_code=404, detail="Volunteer not found")
    return _to_response(volunteer)


@router.post("/", response_model=VolunteerResponse)
async def create_volunteer(
    data: VolunteerCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create a new volunteer."""
    volunteer = Volunteer(
        name=data.name,
        phone=data.phone,
        email=data.email,
        availability=json.dumps(data.availability or []),
        interests=json.dumps(data.interests or []),
        background_check=data.background_check,
        notes=data.notes,
        status=VolunteerStatus.PENDING,
    )
    db.add(volunteer)
    await db.commit()
    await db.refresh(volunteer)
    
    return _to_response(volunteer)


@router.put("/{volunteer_id}", response_model=VolunteerResponse)
async def update_volunteer(
    volunteer_id: int,
    data: VolunteerUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update a volunteer."""
    result = await db.execute(
        select(Volunteer).where(Volunteer.id == volunteer_id)
    )
    volunteer = result.scalar_one_or_none()
    if not volunteer:
        raise HTTPException(status_code=404, detail="Volunteer not found")
    
    # Update fields if provided
    if data.name is not None:
        volunteer.name = data.name
    if data.phone is not None:
        volunteer.phone = data.phone
    if data.email is not None:
        volunteer.email = data.email
    if data.availability is not None:
        volunteer.availability = json.dumps(data.availability)
    if data.interests is not None:
        volunteer.interests = json.dumps(data.interests)
    if data.background_check is not None:
        volunteer.background_check = data.background_check
    if data.notes is not None:
        volunteer.notes = data.notes
    if data.status is not None:
        volunteer.status = VolunteerStatus(data.status.value)
    
    await db.commit()
    await db.refresh(volunteer)
    
    return _to_response(volunteer)


@router.delete("/{volunteer_id}")
async def delete_volunteer(volunteer_id: int, db: AsyncSession = Depends(get_db)):
    """Delete a volunteer."""
    result = await db.execute(
        select(Volunteer).where(Volunteer.id == volunteer_id)
    )
    volunteer = result.scalar_one_or_none()
    if not volunteer:
        raise HTTPException(status_code=404, detail="Volunteer not found")
    
    await db.delete(volunteer)
    await db.commit()
    
    return {"message": "Volunteer deleted"}


@router.post("/{volunteer_id}/activate", response_model=VolunteerResponse)
async def activate_volunteer(volunteer_id: int, db: AsyncSession = Depends(get_db)):
    """Activate a pending volunteer."""
    result = await db.execute(
        select(Volunteer).where(Volunteer.id == volunteer_id)
    )
    volunteer = result.scalar_one_or_none()
    if not volunteer:
        raise HTTPException(status_code=404, detail="Volunteer not found")
    
    volunteer.status = VolunteerStatus.ACTIVE
    await db.commit()
    await db.refresh(volunteer)
    
    return _to_response(volunteer)


@router.post("/{volunteer_id}/deactivate", response_model=VolunteerResponse)
async def deactivate_volunteer(volunteer_id: int, db: AsyncSession = Depends(get_db)):
    """Deactivate a volunteer."""
    result = await db.execute(
        select(Volunteer).where(Volunteer.id == volunteer_id)
    )
    volunteer = result.scalar_one_or_none()
    if not volunteer:
        raise HTTPException(status_code=404, detail="Volunteer not found")
    
    volunteer.status = VolunteerStatus.INACTIVE
    await db.commit()
    await db.refresh(volunteer)
    
    return _to_response(volunteer)


def _to_response(volunteer: Volunteer) -> VolunteerResponse:
    """Convert DB model to response schema."""
    # Parse JSON arrays
    availability = []
    interests = []
    
    if volunteer.availability:
        try:
            availability = json.loads(volunteer.availability)
        except json.JSONDecodeError:
            availability = []
    
    if volunteer.interests:
        try:
            interests = json.loads(volunteer.interests)
        except json.JSONDecodeError:
            interests = []
    
    return VolunteerResponse(
        id=volunteer.id,
        name=volunteer.name,
        phone=volunteer.phone,
        email=volunteer.email,
        availability=availability,
        interests=interests,
        background_check=volunteer.background_check,
        notes=volunteer.notes,
        status=VolunteerStatusSchema(volunteer.status.value),
        last_served=volunteer.last_served,
        created_at=volunteer.created_at,
    )
