"""Pydantic schemas for API request/response validation."""
from datetime import datetime
from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, Field

# ===================
# ENUMS
# ===================
class BedStatus(str, Enum):
    AVAILABLE = "available"
    HELD = "held"
    OCCUPIED = "occupied"

class ReservationStatus(str, Enum):
    ACTIVE = "active"
    EXPIRED = "expired"
    CHECKED_IN = "checked_in"
    CANCELLED = "cancelled"

class Intent(str, Enum):
    BED_INQUIRY = "bed_inquiry"
    MAKE_RESERVATION = "make_reservation"
    CHECK_RESERVATION = "check_reservation"
    SHELTER_RULES = "shelter_rules"
    DIRECTIONS = "directions"
    CRISIS = "crisis"
    TRANSFER_STAFF = "transfer_staff"
    OTHER = "other"

# ===================
# BED SCHEMAS
# ===================
class BedSummary(BaseModel):
    available: int = Field(..., ge=0, le=108)
    held: int = Field(..., ge=0, le=108)
    occupied: int = Field(..., ge=0, le=108)
    total: int = Field(default=108)

class BedDetail(BaseModel):
    """Detailed status for a single bed."""
    bed_id: int
    status: BedStatus
    reservation_id: Optional[str] = None
    guest_name: Optional[str] = None

# ===================
# RESERVATION SCHEMAS
# ===================
class ReservationCreate(BaseModel):
    caller_hash: str = Field(..., min_length=1, max_length=64)
    caller_name: Optional[str] = Field(None, max_length=100)
    situation: Optional[str] = Field(None, max_length=500)
    needs: Optional[str] = Field(None, max_length=500)

class ReservationResponse(BaseModel):
    reservation_id: str
    bed_id: int
    status: ReservationStatus
    created_at: datetime
    expires_at: datetime
    confirmation_code: str

class ReservationDetail(BaseModel):
    reservation_id: str
    caller_hash: str
    bed_id: int
    status: ReservationStatus
    created_at: datetime
    expires_at: datetime
    checked_in_at: Optional[datetime] = None
    time_remaining_minutes: Optional[int] = None

# ===================
# VOICE AGENT SCHEMAS
# ===================
class VoiceAgentResult(BaseModel):
    intent: Intent
    response_text: str
    needs_followup: bool = False
    followup_prompt: Optional[str] = None
    reservation_created: Optional[ReservationResponse] = None
    risk_flag: Optional[str] = None

class IntentClassification(BaseModel):
    intent: Intent
    confidence: float
    entities: dict = Field(default_factory=dict)