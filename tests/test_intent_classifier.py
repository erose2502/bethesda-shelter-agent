"""Tests for intent classification."""

import pytest

from src.services.intent_classifier import quick_classify
from src.models.schemas import Intent


@pytest.mark.asyncio
async def test_bed_inquiry_intent():
    """Test bed-related keywords trigger bed_inquiry."""
    assert await quick_classify("Do you have any beds available?") == Intent.BED_INQUIRY
    assert await quick_classify("How many beds do you have?") == Intent.BED_INQUIRY
    assert await quick_classify("Is there space tonight?") == Intent.BED_INQUIRY


@pytest.mark.asyncio
async def test_reservation_intent():
    """Test reservation keywords."""
    assert await quick_classify("I'd like to reserve a bed") == Intent.MAKE_RESERVATION
    assert await quick_classify("Can I book a spot?") == Intent.MAKE_RESERVATION


@pytest.mark.asyncio
async def test_rules_intent():
    """Test rules-related keywords."""
    assert await quick_classify("What are the rules?") == Intent.SHELTER_RULES
    assert await quick_classify("What time is curfew?") == Intent.SHELTER_RULES
    assert await quick_classify("Do I have to be sober?") == Intent.SHELTER_RULES


@pytest.mark.asyncio
async def test_directions_intent():
    """Test location keywords."""
    assert await quick_classify("Where are you located?") == Intent.DIRECTIONS
    assert await quick_classify("What's your address?") == Intent.DIRECTIONS


@pytest.mark.asyncio  
async def test_crisis_priority():
    """Test that crisis keywords take priority."""
    # Even if asking about beds, crisis takes priority
    assert await quick_classify("I want to kill myself but need a bed") == Intent.CRISIS
    assert await quick_classify("I can't go on anymore") == Intent.CRISIS


@pytest.mark.asyncio
async def test_transfer_intent():
    """Test staff transfer keywords."""
    assert await quick_classify("Can I talk to a person?") == Intent.TRANSFER_STAFF
    assert await quick_classify("I need to speak with someone") == Intent.TRANSFER_STAFF


@pytest.mark.asyncio
async def test_unknown_intent():
    """Test that unknown queries return OTHER."""
    assert await quick_classify("random gibberish xyz") == Intent.OTHER
