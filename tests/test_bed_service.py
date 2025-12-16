"""Tests for bed service."""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.services.bed_service import BedService
from src.models.db_models import BedStatus


@pytest.mark.asyncio
async def test_get_summary_all_available(db_session: AsyncSession):
    """Test that all 108 beds are available initially."""
    service = BedService(db_session)
    summary = await service.get_summary()
    
    assert summary.total == 108
    assert summary.available == 108
    assert summary.held == 0
    assert summary.occupied == 0


@pytest.mark.asyncio
async def test_get_available_count(db_session: AsyncSession):
    """Test getting available bed count."""
    service = BedService(db_session)
    count = await service.get_available_count()
    
    assert count == 108


@pytest.mark.asyncio
async def test_get_first_available_bed(db_session: AsyncSession):
    """Test getting first available bed."""
    service = BedService(db_session)
    bed_id = await service.get_first_available_bed()
    
    assert bed_id == 1  # First bed


@pytest.mark.asyncio
async def test_hold_bed(db_session: AsyncSession):
    """Test holding a bed."""
    service = BedService(db_session)
    
    # Hold bed 1
    result = await service.hold_bed(1)
    assert result is True
    
    # Verify status
    status = await service.get_bed_status(1)
    assert status == "held"
    
    # Verify counts
    count = await service.get_available_count()
    assert count == 107


@pytest.mark.asyncio
async def test_hold_unavailable_bed(db_session: AsyncSession):
    """Test that holding an already held bed fails."""
    service = BedService(db_session)
    
    # Hold bed 1
    await service.hold_bed(1)
    
    # Try to hold again
    result = await service.hold_bed(1)
    assert result is False


@pytest.mark.asyncio
async def test_release_bed(db_session: AsyncSession):
    """Test releasing a held bed."""
    service = BedService(db_session)
    
    # Hold then release
    await service.hold_bed(1)
    result = await service.release_bed(1)
    
    assert result is True
    
    # Verify status
    status = await service.get_bed_status(1)
    assert status == "available"


@pytest.mark.asyncio
async def test_checkin_checkout(db_session: AsyncSession):
    """Test check-in and check-out flow."""
    service = BedService(db_session)
    
    # Hold bed
    await service.hold_bed(1)
    
    # Check in (walk-in style, no reservation)
    # First release the hold, then check in
    await service.release_bed(1)
    await service.checkin(1)
    
    status = await service.get_bed_status(1)
    assert status == "occupied"
    
    # Check out
    await service.checkout(1)
    
    status = await service.get_bed_status(1)
    assert status == "available"


@pytest.mark.asyncio
async def test_checkout_not_occupied(db_session: AsyncSession):
    """Test that checking out an unoccupied bed fails."""
    service = BedService(db_session)
    
    with pytest.raises(ValueError, match="not occupied"):
        await service.checkout(1)
