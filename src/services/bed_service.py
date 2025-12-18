"""Bed Service - Managing exactly 108 beds."""

from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import get_settings
from src.models.db_models import Bed, BedStatus, Reservation, ReservationStatus
from src.models.schemas import BedSummary


class BedService:
    """
    Bed management service - 108 beds, no more, no less.
    
    Simple state machine:
    - AVAILABLE → HELD (reservation created)
    - HELD → OCCUPIED (check-in)
    - HELD → AVAILABLE (reservation expired)
    - OCCUPIED → AVAILABLE (check-out)
    """

    def __init__(self, db: AsyncSession):
        self.db = db
        self.settings = get_settings()

    async def get_summary(self) -> BedSummary:
        """Get bed availability summary."""
        # Count beds by status
        result = await self.db.execute(
            select(Bed.status, func.count(Bed.bed_id))
            .group_by(Bed.status)
        )
        
        counts = {status: count for status, count in result.all()}
        
        return BedSummary(
            available=counts.get(BedStatus.AVAILABLE, 0),
            held=counts.get(BedStatus.HELD, 0),
            occupied=counts.get(BedStatus.OCCUPIED, 0),
            total=self.settings.total_beds,
        )

    async def get_available_count(self) -> int:
        """Get count of available beds."""
        result = await self.db.execute(
            select(func.count(Bed.bed_id))
            .where(Bed.status == BedStatus.AVAILABLE)
        )
        return result.scalar() or 0

    async def get_bed_status(self, bed_id: int) -> str:
        """Get status of a specific bed."""
        result = await self.db.execute(
            select(Bed.status).where(Bed.bed_id == bed_id)
        )
        status = result.scalar_one_or_none()
        return status.value if status else "unknown"

    async def get_first_available_bed(self) -> Optional[int]:
        """Get the first available bed ID."""
        result = await self.db.execute(
            select(Bed.bed_id)
            .where(Bed.status == BedStatus.AVAILABLE)
            .order_by(Bed.bed_id)
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def hold_bed(self, bed_id: int) -> bool:
        """
        Mark a bed as held (for reservation).
        
        Returns True if successful, False if bed wasn't available.
        """
        result = await self.db.execute(
            select(Bed).where(Bed.bed_id == bed_id).with_for_update()
        )
        bed = result.scalar_one_or_none()
        
        if not bed or bed.status != BedStatus.AVAILABLE:
            return False
        
        bed.status = BedStatus.HELD
        await self.db.flush()
        return True

    async def release_bed(self, bed_id: int) -> bool:
        """Release a held bed back to available."""
        result = await self.db.execute(
            select(Bed).where(Bed.bed_id == bed_id).with_for_update()
        )
        bed = result.scalar_one_or_none()
        
        if not bed or bed.status != BedStatus.HELD:
            return False
        
        bed.status = BedStatus.AVAILABLE
        await self.db.flush()
        return True

    async def checkin(self, bed_id: int, reservation_id: Optional[str] = None) -> None:
        """
        Check in a guest to a bed.
        
        If reservation_id provided, validates and converts reservation.
        Otherwise, marks bed as occupied directly (walk-in).
        """
        result = await self.db.execute(
            select(Bed).where(Bed.bed_id == bed_id).with_for_update()
        )
        bed = result.scalar_one_or_none()
        
        if not bed:
            raise ValueError(f"Bed {bed_id} not found")

        if reservation_id:
            # Validate reservation
            res_result = await self.db.execute(
                select(Reservation)
                .where(Reservation.reservation_id == reservation_id)
                .where(Reservation.bed_id == bed_id)
                .where(Reservation.status == ReservationStatus.ACTIVE)
            )
            reservation = res_result.scalar_one_or_none()
            
            if not reservation:
                raise ValueError("Invalid or expired reservation")
            
            # Update reservation status
            reservation.status = ReservationStatus.CHECKED_IN
            from datetime import datetime, timezone
            reservation.checked_in_at = datetime.now(timezone.utc)
        else:
            # Walk-in: bed must be available
            if bed.status != BedStatus.AVAILABLE:
                raise ValueError(f"Bed {bed_id} is not available for walk-in")

            # Create a reservation record for walk-in/manual check-in
            from datetime import datetime, timedelta, timezone
            import uuid
            now = datetime.now(timezone.utc)
            expires_at = now + timedelta(hours=3)
            reservation_id = str(uuid.uuid4())
            from src.models.db_models import Reservation, ReservationStatus
            reservation = Reservation(
                reservation_id=reservation_id,
                bed_id=bed_id,
                caller_hash=None,
                caller_name="Manual Walk-in",
                situation="Checked in at front desk",
                needs="Not specified",
                created_at=now,
                expires_at=expires_at,
                status=ReservationStatus.CHECKED_IN,
                confirmation_code=None,
            )
            self.db.add(reservation)
            await self.db.flush()

        bed.status = BedStatus.OCCUPIED
        await self.db.flush()

    async def checkout(self, bed_id: int) -> None:
        """Check out a guest from a bed."""
        result = await self.db.execute(
            select(Bed).where(Bed.bed_id == bed_id).with_for_update()
        )
        bed = result.scalar_one_or_none()
        
        if not bed:
            raise ValueError(f"Bed {bed_id} not found")
        
        if bed.status != BedStatus.OCCUPIED:
            raise ValueError(f"Bed {bed_id} is not occupied")
        
        bed.status = BedStatus.AVAILABLE
        await self.db.flush()

    async def simulate_occupancy(self, available: int = 3) -> None:
        """
        Simulate bed occupancy for testing.
        Sets specified number as available, rest as occupied.
        """
        from sqlalchemy import update
        
        # First, set all beds to occupied
        await self.db.execute(
            update(Bed).values(status=BedStatus.OCCUPIED)
        )
        
        # Then set first N beds to available
        if available > 0:
            await self.db.execute(
                update(Bed)
                .where(Bed.bed_id <= available)
                .values(status=BedStatus.AVAILABLE)
            )
        
        await self.db.commit()
