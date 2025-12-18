"""Bed Service - Managing exactly 108 beds."""

from typing import Optional, List

from sqlalchemy import select, func
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
        """Get bed availability summary."""
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

    async def get_all_beds(self) -> List[BedDetail]:
        """Get detailed list of all beds."""
        # Join beds with active/checked-in reservations to get guest details
        # Note: This is a left join to ensure we get all beds even if empty
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
        Mark a bed as held (for reservation or manual hold).
        """
        result = await self.db.execute(
            select(Bed).where(Bed.bed_id == bed_id).with_for_update()
        )
        bed = result.scalar_one_or_none()
        
        if not bed:
            return False
            
        # Allow holding from available
        if bed.status == BedStatus.AVAILABLE:
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
            
        bed.status = BedStatus.AVAILABLE
        await self.db.flush()
        return True

    async def checkin(self, bed_id: int, reservation_id: Optional[str] = None) -> None:
        """
        Check in a guest to a bed.
        """
        result = await self.db.execute(
            select(Bed).where(Bed.bed_id == bed_id).with_for_update()
        )
        bed = result.scalar_one_or_none()
        
        if not bed:
            raise ValueError(f"Bed {bed_id} not found")

        if reservation_id:
            res_result = await self.db.execute(
                select(Reservation)
                .where(Reservation.reservation_id == reservation_id)
                .where(Reservation.bed_id == bed_id)
                .where(Reservation.status == ReservationStatus.ACTIVE)
            )
            reservation = res_result.scalar_one_or_none()
            
            if not reservation:
                raise ValueError("Invalid or expired reservation")
            
            reservation.status = ReservationStatus.CHECKED_IN
            from datetime import datetime, timezone
            reservation.checked_in_at = datetime.now(timezone.utc)
        else:
            if bed.status != BedStatus.AVAILABLE and bed.status != BedStatus.HELD:
                raise ValueError(f"Bed {bed_id} is not available for check-in")

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
        
        # Allow forcing checkout even if not marked occupied (cleanup)
        bed.status = BedStatus.AVAILABLE
        await self.db.flush()

    async def simulate_occupancy(self, available: int = 3) -> None:
        """Simulate bed occupancy for testing."""
        from sqlalchemy import update
        
        await self.db.execute(
            update(Bed).values(status=BedStatus.OCCUPIED)
        )
        
        if available > 0:
            await self.db.execute(
                update(Bed)
                .where(Bed.bed_id <= available)
                .values(status=BedStatus.AVAILABLE)
            )
        
        await self.db.commit()