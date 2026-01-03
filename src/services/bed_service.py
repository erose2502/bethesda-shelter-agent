"""Bed Service - Managing exactly 108 beds."""

from typing import Optional, List

from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import get_settings
from src.models.db_models import Bed, BedStatus, Reservation, ReservationStatus
from src.models.schemas import BedSummary, BedDetail


class BedService:
    """
    Bed management service - 108 beds, no more, no less.
    """

    def __init__(self, db: AsyncSession):
        self.db = db
        self.settings = get_settings()

    async def get_summary(self) -> BedSummary:
        """
        Get bed availability summary.
        FIX: Counts manually to ensure it matches the dashboard exactly.
        """
        # Fetch the real list (Source of Truth)
        beds = await self.get_all_beds()
        
        # Count them in Python to avoid Database Group-By bugs
        # Note: b.status is a Pydantic BedStatus (str), not SQLAlchemy BedStatus (enum)
        available = sum(1 for b in beds if b.status.value == "AVAILABLE")
        held = sum(1 for b in beds if b.status.value == "HELD")
        occupied = sum(1 for b in beds if b.status.value == "OCCUPIED")
        
        return BedSummary(
            available=available,
            held=held,
            occupied=occupied,
            total=self.settings.total_beds,
        )

    async def get_all_beds(self) -> List[BedDetail]:
        """Get detailed list of all beds."""
        stmt = (
            select(Bed, Reservation)
            .outerjoin(
                Reservation, 
                (Bed.bed_id == Reservation.bed_id) & 
                (Reservation.status.in_([ReservationStatus.ACTIVE, ReservationStatus.CHECKED_IN]))
            )
            .order_by(Bed.bed_id)
        )
        
        result = await self.db.execute(stmt)
        rows = result.all()
        
        bed_details = []
        for bed, reservation in rows:
            bed_details.append(BedDetail(
                bed_id=bed.bed_id,
                status=bed.status,
                reservation_id=reservation.reservation_id if reservation else None,
                guest_name=reservation.caller_name if reservation else None
            ))
            
        return bed_details

    async def get_available_count(self) -> int:
        """Get count of available beds."""
        # Use the robust summary method
        summary = await self.get_summary()
        return summary.available

    async def get_bed_status(self, bed_id: int) -> str:
        """Get status of a specific bed."""
        result = await self.db.execute(
            select(Bed.status).where(Bed.bed_id == bed_id)
        )
        status = result.scalar_one_or_none()
        return status.value if status else "unknown"

    async def get_first_available_bed(self) -> Optional[int]:
        """Get the first truly available bed ID."""
        stmt = (
            select(Bed.bed_id)
            .outerjoin(
                Reservation,
                (Bed.bed_id == Reservation.bed_id) &
                (Reservation.status.in_([ReservationStatus.ACTIVE, ReservationStatus.CHECKED_IN]))
            )
            .where(Bed.status == BedStatus.AVAILABLE)
            .where(Reservation.reservation_id == None)
            .order_by(Bed.bed_id)
            .limit(1)
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def reserve_first_available_bed(self) -> Optional[int]:
        """Atomically find and hold the first available bed.

        This method attempts to select an AVAILABLE bed which has no active
        reservation and marks it as HELD inside the same transaction using
        a row-level lock (FOR UPDATE SKIP LOCKED). Using SKIP LOCKED avoids
        long waits when other transactions are reserving beds concurrently.

        Returns the bed_id that was held, or None if none available.
        """
        stmt = (
            select(Bed)
            .outerjoin(
                Reservation,
                (Bed.bed_id == Reservation.bed_id) &
                (Reservation.status.in_([ReservationStatus.ACTIVE, ReservationStatus.CHECKED_IN]))
            )
            .where(Bed.status == BedStatus.AVAILABLE)
            .where(Reservation.reservation_id == None)
            .order_by(Bed.bed_id)
            .limit(1)
            .with_for_update(skip_locked=True)
        )

        result = await self.db.execute(stmt)
        bed = result.scalar_one_or_none()
        if not bed:
            return None

        # Mark as held and persist within the caller's transaction
        bed.status = BedStatus.HELD
        await self.db.flush()
        return bed.bed_id

    async def hold_bed(self, bed_id: int) -> bool:
        """Mark a bed as held."""
        result = await self.db.execute(
            select(Bed).where(Bed.bed_id == bed_id).with_for_update()
        )
        bed = result.scalar_one_or_none()
        if not bed:
            return False
        await self.db.refresh(bed)
        # Allow holding from available
        # Also allow re-holding if already held (refresh)
        if bed.status == BedStatus.AVAILABLE or bed.status == BedStatus.HELD:
            bed.status = BedStatus.HELD
            await self.db.flush()
            return True
        return False

    async def release_bed(self, bed_id: int) -> bool:
        """Release a held bed back to available."""
        result = await self.db.execute(
            select(Bed).where(Bed.bed_id == bed_id).with_for_update()
        )
        bed = result.scalar_one_or_none()
        if not bed:
            return False
        await self.db.refresh(bed)
        bed.status = BedStatus.AVAILABLE
        await self.db.flush()
        return True

    async def checkin(self, bed_id: int, reservation_id: Optional[str] = None) -> None:
        """Check in a guest."""
        result = await self.db.execute(
            select(Bed).where(Bed.bed_id == bed_id).with_for_update()
        )
        bed = result.scalar_one_or_none()
        
        if not bed: raise ValueError(f"Bed {bed_id} not found")

        if reservation_id:
            res_result = await self.db.execute(
                select(Reservation)
                .where(Reservation.reservation_id == reservation_id)
                .where(Reservation.bed_id == bed_id)
            )
            reservation = res_result.scalar_one_or_none()
            
            if reservation:
                reservation.status = ReservationStatus.CHECKED_IN
                from datetime import datetime, timezone
                reservation.checked_in_at = datetime.now(timezone.utc)

        bed.status = BedStatus.OCCUPIED
        await self.db.flush()

    async def checkout(self, bed_id: int) -> None:
        """Check out a guest."""
        result = await self.db.execute(
            select(Bed).where(Bed.bed_id == bed_id).with_for_update()
        )
        bed = result.scalar_one_or_none()
        if bed:
            bed.status = BedStatus.AVAILABLE
            await self.db.flush()

    async def simulate_occupancy(self, available: int = 3) -> None:
        """Simulate occupancy."""
        await self.db.execute(update(Bed).values(status=BedStatus.OCCUPIED))
        if available > 0:
            await self.db.execute(
                update(Bed)
                .where(Bed.bed_id <= available)
                .values(status=BedStatus.AVAILABLE)
            )
        # Flush to persist within transaction (route will commit)
        await self.db.flush()