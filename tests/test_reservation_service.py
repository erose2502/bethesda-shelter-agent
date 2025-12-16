"""Tests for reservation service."""

import pytest
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession

from src.services.reservation_service import ReservationService
from src.models.schemas import ReservationStatus


@pytest.mark.asyncio
async def test_create_reservation(db_session: AsyncSession):
    """Test creating a reservation."""
    service = ReservationService(db_session)
    
    reservation = await service.create_reservation(caller_hash="test_hash_123")
    
    assert reservation.bed_id == 1  # First available
    assert reservation.status == ReservationStatus.ACTIVE
    assert reservation.confirmation_code.startswith("BM-")
    assert reservation.expires_at > datetime.now(timezone.utc)


@pytest.mark.asyncio
async def test_no_double_reservation(db_session: AsyncSession):
    """Test that same caller can't make multiple reservations."""
    service = ReservationService(db_session)
    
    # First reservation
    await service.create_reservation(caller_hash="test_hash_123")
    
    # Second attempt should fail
    with pytest.raises(ValueError, match="already have an active reservation"):
        await service.create_reservation(caller_hash="test_hash_123")


@pytest.mark.asyncio
async def test_different_callers_can_reserve(db_session: AsyncSession):
    """Test that different callers can make reservations."""
    service = ReservationService(db_session)
    
    res1 = await service.create_reservation(caller_hash="caller_1")
    res2 = await service.create_reservation(caller_hash="caller_2")
    
    assert res1.bed_id != res2.bed_id
    assert res1.bed_id == 1
    assert res2.bed_id == 2


@pytest.mark.asyncio
async def test_get_reservation(db_session: AsyncSession):
    """Test getting reservation details."""
    service = ReservationService(db_session)
    
    created = await service.create_reservation(caller_hash="test_hash")
    retrieved = await service.get_reservation(created.reservation_id)
    
    assert retrieved is not None
    assert retrieved["bed_id"] == created.bed_id
    assert retrieved["status"] == "active"
    assert retrieved["time_remaining_minutes"] > 0


@pytest.mark.asyncio
async def test_cancel_reservation(db_session: AsyncSession):
    """Test cancelling a reservation releases the bed."""
    service = ReservationService(db_session)
    
    reservation = await service.create_reservation(caller_hash="test_hash")
    bed_id = reservation.bed_id
    
    # Cancel
    await service.cancel_reservation(reservation.reservation_id)
    
    # Verify bed is available again
    from src.services.bed_service import BedService
    bed_service = BedService(db_session)
    status = await bed_service.get_bed_status(bed_id)
    assert status == "available"


@pytest.mark.asyncio
async def test_list_active_reservations(db_session: AsyncSession):
    """Test listing active reservations."""
    service = ReservationService(db_session)
    
    # Create some reservations
    await service.create_reservation(caller_hash="caller_1")
    await service.create_reservation(caller_hash="caller_2")
    
    active = await service.list_active()
    
    assert len(active) == 2
    assert all(r["time_remaining_minutes"] > 0 for r in active)
