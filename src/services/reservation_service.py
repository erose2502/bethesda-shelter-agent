"""Reservation Service - Fair, first-come-first-served."""

import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional, List

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import get_settings
from src.models.db_models import Reservation, ReservationStatus, Bed, BedStatus, CallLog
from src.models.schemas import ReservationResponse, ReservationDetail
from src.services.bed_service import BedService


def generate_confirmation_code() -> str:
    """Generate a short, phone-friendly confirmation code."""
    # Format: BM-XXXX (easy to say on phone)
    import random
    return f"BM-{random.randint(1000, 9999)}"


class ReservationService:
    """
    Reservation management - preserving fairness and trust.
    
    Rules (enforced):
    - First call → first reservation
    - Hold = 2-3 hours (configurable)
    - Auto-expire job every 5 minutes
    - No double booking
    - No favoritism
    """

    def __init__(self, db: AsyncSession):
        self.db = db
        self.settings = get_settings()
        self.bed_service = BedService(db)

    async def create_reservation(
        self, 
        caller_hash: str,
        caller_name: Optional[str] = None,
        situation: Optional[str] = None,
        needs: Optional[str] = None,
    ) -> ReservationResponse:
        """
        Create a new reservation.
        
        Flow:
        1. Check for existing active reservation for this caller
        2. Find first available bed
        3. Create reservation with expiration
        4. Mark bed as held
        """
        # Check if caller already has active reservation
        existing = await self.db.execute(
            select(Reservation)
            .where(Reservation.caller_hash == caller_hash)
            .where(Reservation.status == ReservationStatus.ACTIVE)
        )
        if existing.scalar_one_or_none():
            raise ValueError("You already have an active reservation")

        # Find available bed
        bed_id = await self.bed_service.get_first_available_bed()
        if bed_id is None:
            raise ValueError("No beds available at this time")

        # Hold the bed
        if not await self.bed_service.hold_bed(bed_id):
            raise ValueError("Unable to reserve bed - please try again")

        # Create reservation
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(hours=self.settings.reservation_hold_hours)
        reservation_id = str(uuid.uuid4())
        confirmation_code = generate_confirmation_code()

        reservation = Reservation(
            reservation_id=reservation_id,
            caller_hash=caller_hash,
            bed_id=bed_id,
            created_at=now,
            expires_at=expires_at,
            status=ReservationStatus.ACTIVE,
        )
        
        self.db.add(reservation)
        
        # Store assessment in CallLog for staff access
        if caller_name or situation or needs:
            call_log = CallLog(
                call_sid=f"RES-{confirmation_code}",
                caller_hash=caller_hash,
                intent="make_reservation",
                transcript_summary=f"Name: {caller_name or 'Not provided'}\nSituation: {situation or 'Not provided'}\nNeeds: {needs or 'None mentioned'}",
                reservation_id=reservation_id,
            )
            self.db.add(call_log)
        
        await self.db.flush()

        return ReservationResponse(
            reservation_id=reservation_id,
            bed_id=bed_id,
            status=ReservationStatus.ACTIVE,
            created_at=now,
            expires_at=expires_at,
            confirmation_code=confirmation_code,
        )

    async def get_reservation(self, reservation_id: str) -> Optional[dict]:
        """Get reservation by ID."""
        result = await self.db.execute(
            select(Reservation).where(Reservation.reservation_id == reservation_id)
        )
        reservation = result.scalar_one_or_none()
        
        if not reservation:
            return None

        # Get associated call log for assessment data
        log_result = await self.db.execute(
            select(CallLog).where(CallLog.reservation_id == reservation_id)
        )
        call_log = log_result.scalar_one_or_none()

        now = datetime.now(timezone.utc)
        time_remaining = None
        if reservation.status == ReservationStatus.ACTIVE:
            remaining = reservation.expires_at - now
            time_remaining = max(0, int(remaining.total_seconds() / 60))

        # Parse assessment data from call log
        caller_name = "Unknown"
        situation = "Not provided"
        needs = "None mentioned"
        
        if call_log and call_log.transcript_summary:
            lines = call_log.transcript_summary.split('\n')
            for line in lines:
                if line.startswith("Name: "):
                    caller_name = line.replace("Name: ", "").strip()
                elif line.startswith("Situation: "):
                    situation = line.replace("Situation: ", "").strip()
                elif line.startswith("Needs: "):
                    needs = line.replace("Needs: ", "").strip()

        return {
            "reservation_id": reservation.reservation_id,
            "bed_id": reservation.bed_id,
            "caller_name": caller_name,
            "situation": situation,
            "needs": needs,
            "status": reservation.status.value,
            "created_at": reservation.created_at.isoformat(),
            "expires_at": reservation.expires_at.isoformat(),
            "checked_in_at": reservation.checked_in_at.isoformat() if reservation.checked_in_at else None,
            "time_remaining_minutes": time_remaining,
        }

    async def cancel_reservation(self, reservation_id: str) -> None:
        """Cancel an active reservation."""
        result = await self.db.execute(
            select(Reservation)
            .where(Reservation.reservation_id == reservation_id)
            .with_for_update()
        )
        reservation = result.scalar_one_or_none()
        
        if not reservation:
            raise ValueError("Reservation not found")
        
        if reservation.status != ReservationStatus.ACTIVE:
            raise ValueError("Reservation is not active")

        # Release the bed
        await self.bed_service.release_bed(reservation.bed_id)
        
        # Update reservation status
        reservation.status = ReservationStatus.CANCELLED
        await self.db.flush()

    async def list_active(self) -> List[dict]:
        """List all active reservations (for dashboard)."""
        result = await self.db.execute(
            select(Reservation)
            .where(Reservation.status == ReservationStatus.ACTIVE)
            .order_by(Reservation.expires_at)
        )
        reservations = result.scalars().all()

        now = datetime.now(timezone.utc)
        active_list = []
        
        for r in reservations:
            # Get associated call log for assessment data
            log_result = await self.db.execute(
                select(CallLog).where(CallLog.reservation_id == r.reservation_id)
            )
            call_log = log_result.scalar_one_or_none()
            
            # Parse assessment data
            caller_name = "Unknown"
            situation = "Not provided"
            needs = "None mentioned"
            
            if call_log and call_log.transcript_summary:
                lines = call_log.transcript_summary.split('\n')
                for line in lines:
                    if line.startswith("Name: "):
                        caller_name = line.replace("Name: ", "").strip()
                    elif line.startswith("Situation: "):
                        situation = line.replace("Situation: ", "").strip()
                    elif line.startswith("Needs: "):
                        needs = line.replace("Needs: ", "").strip()
            
            active_list.append({
                "reservation_id": r.reservation_id,
                "bed_id": r.bed_id,
                "caller_name": caller_name,
                "situation": situation,
                "needs": needs,
                "created_at": r.created_at.isoformat(),
                "expires_at": r.expires_at.isoformat(),
                "status": "active",
                "time_remaining_minutes": max(0, int((r.expires_at - now).total_seconds() / 60)),
            })
        
        return active_list

    async def expire_old_reservations(self) -> int:
        """
        Expire reservations past their hold time.
        
        This should be called by a background job every 5 minutes.
        """
        now = datetime.now(timezone.utc)
        
        # Find expired reservations
        result = await self.db.execute(
            select(Reservation)
            .where(Reservation.status == ReservationStatus.ACTIVE)
            .where(Reservation.expires_at < now)
            .with_for_update()
        )
        expired_reservations = result.scalars().all()

        count = 0
        for reservation in expired_reservations:
            # Release the bed
            await self.bed_service.release_bed(reservation.bed_id)
            
            # Update reservation status
            reservation.status = ReservationStatus.EXPIRED
            count += 1

        await self.db.flush()
        return count