"""Reservation management endpoints - Fair, First-Come-First-Served."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.database import get_db
from src.services.reservation_service import ReservationService
from src.models.schemas import ReservationCreate, ReservationResponse

router = APIRouter()


@router.post("/", response_model=ReservationResponse)
async def create_reservation(
    reservation: ReservationCreate,
    db: AsyncSession = Depends(get_db),
) -> ReservationResponse:
    """
    Create a bed reservation.
    
    Rules (enforced):
    - First call = first reservation (no favoritism)
    - Hold time: 2-3 hours (configurable)
    - Auto-expires if not checked in
    - No double booking
    
    Returns reservation code for check-in.
    """
    service = ReservationService(db)
    
    try:
        # Use phone_hash if provided, otherwise use caller_hash
        caller_id = reservation.caller_hash
        
        result = await service.create_reservation(
            caller_hash=caller_id,
            caller_name=reservation.caller_name,
            situation=reservation.situation,
            needs=reservation.needs,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{reservation_id}")
async def get_reservation(
    reservation_id: str,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Get reservation status by ID."""
    service = ReservationService(db)
    reservation = await service.get_reservation(reservation_id)
    
    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found")
    
    return reservation


@router.post("/{reservation_id}/cancel")
async def cancel_reservation(
    reservation_id: str,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Cancel an active reservation, releasing the bed."""
    service = ReservationService(db)
    
    try:
        await service.cancel_reservation(reservation_id)
        return {"status": "cancelled", "reservation_id": reservation_id}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/")
async def list_active_reservations(
    db: AsyncSession = Depends(get_db),
) -> dict:
    """List all active reservations (staff dashboard use)."""
    service = ReservationService(db)
    reservations = await service.list_active()
    
    return {
        "count": len(reservations),
        "reservations": reservations,
    }


@router.post("/expire")
async def expire_old_reservations(
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Manually trigger reservation expiration.
    
    Normally runs via background job every 5 minutes.
    This endpoint allows manual triggering for testing/admin.
    """
    service = ReservationService(db)
    expired_count = await service.expire_old_reservations()
    
    return {
        "expired": expired_count,
        "message": f"Expired {expired_count} reservations",
    }
