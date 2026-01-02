"""Bed management endpoints - 108 beds, no more, no less."""

from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.database import get_db
from src.services.bed_service import BedService
from src.models.schemas import BedStatus, BedSummary, BedDetail

router = APIRouter()


@router.get("/", response_model=BedSummary)
async def get_bed_summary(db: AsyncSession = Depends(get_db)) -> BedSummary:
    """Get current bed availability summary."""
    bed_service = BedService(db)
    return await bed_service.get_summary()


@router.get("/list", response_model=List[BedDetail])
async def get_all_beds_list(db: AsyncSession = Depends(get_db)) -> List[BedDetail]:
    """
    Get detailed list of all 108 beds.
    Crucial for the Dashboard to show real status.
    """
    bed_service = BedService(db)
    return await bed_service.get_all_beds()


@router.get("/available")
async def get_available_beds(db: AsyncSession = Depends(get_db)) -> dict:
    """Get count of currently available beds."""
    bed_service = BedService(db)
    count = await bed_service.get_available_count()
    return {
        "available": count,
        "message": f"{count} beds available" if count > 0 else "No beds available at this time",
    }


@router.get("/{bed_id}")
async def get_bed_status(bed_id: int, db: AsyncSession = Depends(get_db)) -> dict:
    """Get status of a specific bed."""
    if bed_id < 1 or bed_id > 108:
        raise HTTPException(status_code=404, detail="Bed not found. Valid beds: 1-108")
    
    bed_service = BedService(db)
    status = await bed_service.get_bed_status(bed_id)
    return {"bed_id": bed_id, "status": status}


@router.post("/{bed_id}/hold")
async def hold_bed_manual(bed_id: int, db: AsyncSession = Depends(get_db)) -> dict:
    """
    Manually mark a bed as HELD (Reserved).
    This is what the 'Mark Reserved' button calls.
    """
    if bed_id < 1 or bed_id > 108:
        raise HTTPException(status_code=404, detail="Bed not found")
    
    bed_service = BedService(db)
    success = await bed_service.hold_bed(bed_id)
    
    if not success:
        # If we can't hold it (e.g. it's already occupied), 400 error
        raise HTTPException(status_code=400, detail="Bed is not available to hold")
    
    # No manual commit - get_db() dependency handles it
    return {"status": "held", "bed_id": bed_id}


@router.post("/{bed_id}/checkin")
async def checkin_bed(
    bed_id: int, 
    reservation_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Check in a guest to a bed."""
    if bed_id < 1 or bed_id > 108:
        raise HTTPException(status_code=404, detail="Bed not found")
    
    bed_service = BedService(db)
    
    try:
        await bed_service.checkin(bed_id, reservation_id)
        # No manual commit - get_db() dependency handles it
        return {"status": "checked_in", "bed_id": bed_id}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{bed_id}/checkout")
async def checkout_bed(bed_id: int, db: AsyncSession = Depends(get_db)) -> dict:
    """Check out a guest from a bed."""
    if bed_id < 1 or bed_id > 108:
        raise HTTPException(status_code=404, detail="Bed not found")
    
    bed_service = BedService(db)
    
    try:
        await bed_service.checkout(bed_id)
        # No manual commit - get_db() dependency handles it
        return {"status": "available", "bed_id": bed_id}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/simulate")
async def simulate_occupancy(
    available: int = 3,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Simulate bed occupancy for testing."""
    if available < 0 or available > 108:
        raise HTTPException(status_code=400, detail="Available must be 0-108")
    
    bed_service = BedService(db)
    await bed_service.simulate_occupancy(available)
    return {"message": f"Simulated: {available} beds available, {108 - available} occupied"}