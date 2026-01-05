"""Reservation Service - Fair, first-come-first-served."""

import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional, List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import get_settings
from src.models.db_models import Reservation, ReservationStatus, CallLog
from src.models.schemas import ReservationResponse
from src.services.bed_service import BedService


def generate_confirmation_code() -> str:
    """Generate a short, phone-friendly confirmation code."""
    import random
    return f"BM-{random.randint(1000, 9999)}"


class ReservationService:
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
        preferred_language: Optional[str] = None,
    ) -> ReservationResponse:
        """Create a new reservation and log the details."""
        # 1. Check existing
        existing = await self.db.execute(
            select(Reservation)
            .where(Reservation.caller_hash == caller_hash)
            .where(Reservation.status == ReservationStatus.ACTIVE)
        )
        if existing.scalar_one_or_none():
            raise ValueError("You already have an active reservation")

        # 2. Atomically find + hold a bed to avoid TOCTOU races.
        # This both finds an available bed and marks it HELD under a row lock.
        bed_id = await self.bed_service.reserve_first_available_bed()
        if bed_id is None:
            raise ValueError("No beds available at this time")

        # 3. Create Reservation with ALL fields including confirmation_code.
        # If anything fails after the bed was held, release the bed so it
        # doesn't remain orphaned in HELD state.
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(hours=self.settings.reservation_hold_hours)
        reservation_id = str(uuid.uuid4())
        confirmation_code = generate_confirmation_code()

        try:
            reservation = Reservation(
                reservation_id=reservation_id,
                caller_hash=caller_hash,
                caller_name=caller_name,  # FIX: Save caller details
                situation=situation,
                needs=needs,
                confirmation_code=confirmation_code,  # FIX: Save confirmation code
                preferred_language=preferred_language or "English",  # Save detected language
                bed_id=bed_id,
                created_at=now,
                expires_at=expires_at,
                status=ReservationStatus.ACTIVE,
            )
            self.db.add(reservation)
            
            # ALWAYS create a CallLog so the dashboard has data to show
            # Even if name/situation are missing, we log "Voice Caller"
            call_log = CallLog(
                call_sid=f"RES-{confirmation_code}", # Virtual SID for reservation tracking
                caller_hash=caller_hash,
                intent="make_reservation",
                transcript_summary=f"Name: {caller_name or 'Voice Caller'}\nSituation: {situation or 'Not specified'}\nNeeds: {needs or 'Bed reservation'}",
                reservation_id=reservation_id,
            )
            self.db.add(call_log)
            
            # Flush to make data available in this transaction (route will commit)
            await self.db.flush()

            return ReservationResponse(
                reservation_id=reservation_id,
                bed_id=bed_id,
                status=ReservationStatus.ACTIVE,
                created_at=now,
                expires_at=expires_at,
                confirmation_code=confirmation_code,
            )
        except Exception:
            # Try to release the held bed on any failure so it doesn't stay HELD.
            try:
                await self.bed_service.release_bed(bed_id)
            except Exception:
                # If release fails, we can't do much here; let the original
                # exception propagate but log would be helpful in real app.
                pass
            raise

    async def list_active(self) -> List[dict]:
        """List all active reservations with details for the dashboard."""
        # FIX: Refresh to get latest data from other sessions (sync method, not async)
        self.db.expire_all()
        
        result = await self.db.execute(
            select(Reservation)
            .where(Reservation.status == ReservationStatus.ACTIVE)
            .order_by(Reservation.expires_at)
        )
        reservations = result.scalars().all()

        now = datetime.now(timezone.utc)
        active_list = []
        for r in reservations:
            # FIX: Get caller info from Reservation model first (more reliable)
            caller_name = r.caller_name or "Voice Caller"
            situation = r.situation or "Pending intake"
            needs = r.needs or "Bed"
            
            # Fallback to CallLog if Reservation fields are empty
            if not r.caller_name and hasattr(r, 'call_logs') and r.call_logs:
                call_log = r.call_logs[0]
                if call_log and call_log.transcript_summary:
                    for line in call_log.transcript_summary.split('\n'):
                        if line.startswith("Name:"): caller_name = line.split(":", 1)[1].strip()
                        elif line.startswith("Situation:"): situation = line.split(":", 1)[1].strip()
                        elif line.startswith("Needs:"): needs = line.split(":", 1)[1].strip()

            # Handle timezone-naive datetimes from SQLite
            expires_at = r.expires_at
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            
            created_at = r.created_at
            if created_at and created_at.tzinfo is None:
                created_at = created_at.replace(tzinfo=timezone.utc)

            active_list.append({
                "reservation_id": r.reservation_id,
                "bed_id": r.bed_id,
                "caller_name": caller_name,
                "situation": situation,
                "needs": needs,
                "created_at": created_at.isoformat() if created_at else None,
                "expires_at": expires_at.isoformat(),
                "status": "active",
                "time_remaining_minutes": max(0, int((expires_at - now).total_seconds() / 60)),
            })
        return active_list
        
    async def cancel_reservation(self, reservation_id: str) -> None:
        """Cancel an active reservation."""
        result = await self.db.execute(
            select(Reservation)
            .where(Reservation.reservation_id == reservation_id)
            .with_for_update()
        )
        reservation = result.scalar_one_or_none()
        if not reservation or reservation.status != ReservationStatus.ACTIVE:
            raise ValueError("Reservation not found or inactive")

        await self.bed_service.release_bed(reservation.bed_id)
        reservation.status = ReservationStatus.CANCELLED
        await self.db.flush()

    async def expire_old_reservations(self) -> int:
        """Expire old reservations."""
        now = datetime.now(timezone.utc)
        result = await self.db.execute(
            select(Reservation)
            .where(Reservation.status == ReservationStatus.ACTIVE)
            .where(Reservation.expires_at < now)
        )
        expired = result.scalars().all()
        count = 0
        for r in expired:
            await self.bed_service.release_bed(r.bed_id)
            r.status = ReservationStatus.EXPIRED
            count += 1
        await self.db.flush()
        return count

    async def get_reservation(self, reservation_id: str) -> Optional[dict]:
        """Get a reservation by ID."""
        result = await self.db.execute(
            select(Reservation)
            .where(Reservation.reservation_id == reservation_id)
        )
        reservation = result.scalar_one_or_none()
        
        if not reservation:
            return None
        
        now = datetime.now(timezone.utc)
        time_remaining = max(0, int((reservation.expires_at - now).total_seconds() / 60))
        
        return {
            "reservation_id": reservation.reservation_id,
            "caller_hash": reservation.caller_hash,
            "caller_name": reservation.caller_name,
            "bed_id": reservation.bed_id,
            "status": reservation.status.value,
            "confirmation_code": reservation.confirmation_code,
            "created_at": reservation.created_at.isoformat(),
            "expires_at": reservation.expires_at.isoformat(),
            "checked_in_at": reservation.checked_in_at.isoformat() if reservation.checked_in_at else None,
            "time_remaining_minutes": time_remaining,
        }