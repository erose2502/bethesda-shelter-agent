"""Pydantic schemas for API request/response validation."""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


# ===================
# ENUMS
# ===================

class BedStatus(str, Enum):
    """Bed status options."""
    AVAILABLE = "available"
    HELD = "held"
    OCCUPIED = "occupied"


class ReservationStatus(str, Enum):
    """Reservation status options."""
    ACTIVE = "active"
    EXPIRED = "expired"
    CHECKED_IN = "checked_in"
    CANCELLED = "cancelled"


class Intent(str, Enum):
    """Caller intent classification."""
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
    """Summary of bed availability."""
    available: int = Field(..., ge=0, le=108)
    held: int = Field(..., ge=0, le=108)
    occupied: int = Field(..., ge=0, le=108)
    total: int = Field(default=108)

    class Config:
        json_schema_extra = {
            "example": {
                "available": 15,
                "held": 5,
                "occupied": 88,
                "total": 108,
            }
        }


# ===================
# RESERVATION SCHEMAS
# ===================

class ReservationCreate(BaseModel):
    """Request to create a reservation."""
    caller_hash: str = Field(..., min_length=1, max_length=64)
    caller_name: Optional[str] = Field(None, max_length=100, description="Caller's first name")
    situation: Optional[str] = Field(None, max_length=500, description="Brief description of caller's situation")
    needs: Optional[str] = Field(None, max_length=500, description="Immediate needs (medical, mental health, etc.)")


class ReservationResponse(BaseModel):
    """Reservation details returned to caller."""
    reservation_id: str
    bed_id: int
    status: ReservationStatus
    created_at: datetime
    expires_at: datetime
    confirmation_code: str = Field(..., description="Short code for phone confirmation")

    class Config:
        json_schema_extra = {
            "example": {
                "reservation_id": "550e8400-e29b-41d4-a716-446655440000",
                "bed_id": 42,
                "status": "active",
                "created_at": "2024-01-15T18:30:00Z",
                "expires_at": "2024-01-15T21:30:00Z",
                "confirmation_code": "BM-4567",
            }
        }


class ReservationDetail(BaseModel):
    """Full reservation details for staff dashboard."""
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
    """Result from voice agent processing."""
    intent: Intent
    response_text: str
    needs_followup: bool = False
    followup_prompt: Optional[str] = None
    reservation_created: Optional[ReservationResponse] = None
    risk_flag: Optional[str] = None


class IntentClassification(BaseModel):
    """LLM intent classification result."""
    intent: Intent
    confidence: float = Field(..., ge=0.0, le=1.0)
    entities: dict = Field(default_factory=dict)


# ===================
# CALL LOG SCHEMAS
# ===================

class CallLogCreate(BaseModel):
    """Create a call log entry."""
    call_sid: str
    caller_hash: str
    intent: Optional[str] = None
    transcript_summary: Optional[str] = None
    reservation_id: Optional[str] = None
    risk_flag: Optional[str] = None
    duration_seconds: Optional[int] = None


class CallLogResponse(BaseModel):
    """Call log for dashboard display."""
    id: int
    call_sid: str
    caller_hash: str
    intent: Optional[str]
    transcript_summary: Optional[str]
    reservation_id: Optional[str]
    risk_flag: Optional[str]
    created_at: datetime
    duration_seconds: Optional[int]


# ===================
# DASHBOARD SCHEMAS
# ===================

class DashboardSummary(BaseModel):
    """Daily summary for staff dashboard."""
    date: datetime
    beds: BedSummary
    total_calls: int
    reservations_created: int
    reservations_expired: int
    check_ins: int
    risk_flags: int
