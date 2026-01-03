"""Guest management API routes."""
import json
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.database import get_db
from src.models.db_models import Guest, Bed, BedStatus, GuestStatus, EmploymentStatus
from src.models.schemas import GuestCreate, GuestUpdate, GuestResponse

router = APIRouter(prefix="/api/guests", tags=["guests"])


def _to_response(guest: Guest) -> dict:
    """Convert Guest model to response dict with computed fields."""
    # Calculate days in shelter
    days_in_shelter = 0
    if guest.check_in_date:
        end_date = guest.actual_discharge_date or datetime.now()
        days_in_shelter = (end_date - guest.check_in_date).days
    
    # Parse programs JSON
    programs = []
    if guest.programs:
        try:
            programs = json.loads(guest.programs)
        except json.JSONDecodeError:
            programs = []
    
    return {
        "id": guest.id,
        "bed_id": guest.bed_id,
        "first_name": guest.first_name,
        "last_name": guest.last_name,
        "photo_url": guest.photo_url,
        "date_of_birth": guest.date_of_birth,
        "phone": guest.phone,
        "check_in_date": guest.check_in_date,
        "expected_discharge_date": guest.expected_discharge_date,
        "actual_discharge_date": guest.actual_discharge_date,
        "days_in_shelter": days_in_shelter,
        "status": guest.status.value if guest.status else "active",
        "on_penalty": guest.on_penalty,
        "penalty_reason": guest.penalty_reason,
        "penalty_start_date": guest.penalty_start_date,
        "penalty_end_date": guest.penalty_end_date,
        "programs": programs,
        "life_coach": guest.life_coach,
        "case_manager": guest.case_manager,
        "employment_status": guest.employment_status.value if guest.employment_status else "not_seeking",
        "employer": guest.employer,
        "job_title": guest.job_title,
        "work_schedule": guest.work_schedule,
        "serves_in_kitchen": guest.serves_in_kitchen,
        "kitchen_shift": guest.kitchen_shift,
        "assigned_chore": guest.assigned_chore,
        "chore_schedule": guest.chore_schedule,
        "emergency_contact_name": guest.emergency_contact_name,
        "emergency_contact_phone": guest.emergency_contact_phone,
        "emergency_contact_relationship": guest.emergency_contact_relationship,
        "medical_notes": guest.medical_notes,
        "special_needs": guest.special_needs,
        "notes": guest.notes,
        "created_at": guest.created_at,
        "updated_at": guest.updated_at,
    }


@router.get("/", response_model=List[dict])
async def get_all_guests(db: AsyncSession = Depends(get_db)):
    """Get all guests, sorted by bed number."""
    result = await db.execute(
        select(Guest).order_by(Guest.bed_id)
    )
    guests = result.scalars().all()
    return [_to_response(g) for g in guests]


@router.get("/active", response_model=List[dict])
async def get_active_guests(db: AsyncSession = Depends(get_db)):
    """Get only active guests (not discharged)."""
    result = await db.execute(
        select(Guest).where(
            Guest.status.in_([GuestStatus.ACTIVE, GuestStatus.ON_PENALTY])
        ).order_by(Guest.bed_id)
    )
    guests = result.scalars().all()
    return [_to_response(g) for g in guests]


@router.get("/{guest_id}", response_model=dict)
async def get_guest(guest_id: int, db: AsyncSession = Depends(get_db)):
    """Get a specific guest by ID."""
    result = await db.execute(select(Guest).where(Guest.id == guest_id))
    guest = result.scalar_one_or_none()
    
    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found")
    
    return _to_response(guest)


@router.get("/bed/{bed_id}", response_model=dict)
async def get_guest_by_bed(bed_id: int, db: AsyncSession = Depends(get_db)):
    """Get guest by bed number."""
    result = await db.execute(
        select(Guest).where(Guest.bed_id == bed_id, Guest.status.in_([GuestStatus.ACTIVE, GuestStatus.ON_PENALTY]))
    )
    guest = result.scalar_one_or_none()
    
    if not guest:
        raise HTTPException(status_code=404, detail="No active guest in this bed")
    
    return _to_response(guest)


@router.post("/", response_model=dict)
async def create_guest(guest_data: GuestCreate, db: AsyncSession = Depends(get_db)):
    """Create a new guest and mark bed as occupied."""
    # Check if bed exists and is available
    bed_result = await db.execute(select(Bed).where(Bed.bed_id == guest_data.bed_id))
    bed = bed_result.scalar_one_or_none()
    
    if not bed:
        raise HTTPException(status_code=404, detail="Bed not found")
    
    # Check if bed already has an active guest
    existing_guest = await db.execute(
        select(Guest).where(
            Guest.bed_id == guest_data.bed_id,
            Guest.status.in_([GuestStatus.ACTIVE, GuestStatus.ON_PENALTY])
        )
    )
    if existing_guest.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Bed already has an active guest")
    
    # Create guest
    guest = Guest(
        bed_id=guest_data.bed_id,
        first_name=guest_data.first_name,
        last_name=guest_data.last_name,
        photo_url=guest_data.photo_url,
        date_of_birth=guest_data.date_of_birth,
        phone=guest_data.phone,
        programs=json.dumps(guest_data.programs) if guest_data.programs else None,
        life_coach=guest_data.life_coach,
        case_manager=guest_data.case_manager,
        employment_status=EmploymentStatus(guest_data.employment_status) if guest_data.employment_status else EmploymentStatus.NOT_SEEKING,
        employer=guest_data.employer,
        job_title=guest_data.job_title,
        work_schedule=guest_data.work_schedule,
        serves_in_kitchen=guest_data.serves_in_kitchen,
        kitchen_shift=guest_data.kitchen_shift,
        assigned_chore=guest_data.assigned_chore,
        chore_schedule=guest_data.chore_schedule,
        emergency_contact_name=guest_data.emergency_contact_name,
        emergency_contact_phone=guest_data.emergency_contact_phone,
        emergency_contact_relationship=guest_data.emergency_contact_relationship,
        medical_notes=guest_data.medical_notes,
        special_needs=guest_data.special_needs,
        notes=guest_data.notes,
        status=GuestStatus.ACTIVE,
    )
    
    db.add(guest)
    
    # Mark bed as occupied
    bed.status = BedStatus.OCCUPIED
    
    await db.commit()
    await db.refresh(guest)
    
    return _to_response(guest)


@router.put("/{guest_id}", response_model=dict)
async def update_guest(guest_id: int, guest_data: GuestUpdate, db: AsyncSession = Depends(get_db)):
    """Update guest information."""
    result = await db.execute(select(Guest).where(Guest.id == guest_id))
    guest = result.scalar_one_or_none()
    
    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found")
    
    # Update fields if provided
    update_data = guest_data.model_dump(exclude_unset=True)
    
    for field, value in update_data.items():
        if field == "programs" and value is not None:
            setattr(guest, field, json.dumps(value))
        elif field == "status" and value is not None:
            setattr(guest, field, GuestStatus(value))
        elif field == "employment_status" and value is not None:
            setattr(guest, field, EmploymentStatus(value))
        else:
            setattr(guest, field, value)
    
    # Handle penalty status changes
    if guest_data.on_penalty is True and not guest.penalty_start_date:
        guest.penalty_start_date = datetime.now()
        guest.status = GuestStatus.ON_PENALTY
    elif guest_data.on_penalty is False:
        guest.penalty_end_date = datetime.now() if guest.penalty_start_date else None
        if guest.status == GuestStatus.ON_PENALTY:
            guest.status = GuestStatus.ACTIVE
    
    await db.commit()
    await db.refresh(guest)
    
    return _to_response(guest)


@router.post("/{guest_id}/discharge", response_model=dict)
async def discharge_guest(guest_id: int, db: AsyncSession = Depends(get_db)):
    """Discharge a guest and free up their bed."""
    result = await db.execute(select(Guest).where(Guest.id == guest_id))
    guest = result.scalar_one_or_none()
    
    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found")
    
    # Update guest status
    guest.status = GuestStatus.DISCHARGED
    guest.actual_discharge_date = datetime.now()
    
    # Free up the bed
    bed_result = await db.execute(select(Bed).where(Bed.bed_id == guest.bed_id))
    bed = bed_result.scalar_one_or_none()
    if bed:
        bed.status = BedStatus.AVAILABLE
    
    await db.commit()
    await db.refresh(guest)
    
    return _to_response(guest)


@router.post("/{guest_id}/graduate", response_model=dict)
async def graduate_guest(guest_id: int, db: AsyncSession = Depends(get_db)):
    """Mark guest as graduated from program."""
    result = await db.execute(select(Guest).where(Guest.id == guest_id))
    guest = result.scalar_one_or_none()
    
    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found")
    
    # Update guest status
    guest.status = GuestStatus.GRADUATED
    guest.actual_discharge_date = datetime.now()
    
    # Free up the bed
    bed_result = await db.execute(select(Bed).where(Bed.bed_id == guest.bed_id))
    bed = bed_result.scalar_one_or_none()
    if bed:
        bed.status = BedStatus.AVAILABLE
    
    await db.commit()
    await db.refresh(guest)
    
    return _to_response(guest)


@router.delete("/{guest_id}")
async def delete_guest(guest_id: int, db: AsyncSession = Depends(get_db)):
    """Delete a guest record (admin only)."""
    result = await db.execute(select(Guest).where(Guest.id == guest_id))
    guest = result.scalar_one_or_none()
    
    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found")
    
    # If guest is active, free up the bed first
    if guest.status in [GuestStatus.ACTIVE, GuestStatus.ON_PENALTY]:
        bed_result = await db.execute(select(Bed).where(Bed.bed_id == guest.bed_id))
        bed = bed_result.scalar_one_or_none()
        if bed:
            bed.status = BedStatus.AVAILABLE
    
    await db.delete(guest)
    await db.commit()
    
    return {"message": "Guest deleted successfully"}
