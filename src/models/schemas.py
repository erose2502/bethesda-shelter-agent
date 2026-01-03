"""Pydantic schemas for API request/response validation."""
from datetime import datetime
from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, Field

# ===================
# ENUMS
# ===================
class BedStatus(str, Enum):
    AVAILABLE = "AVAILABLE"
    HELD = "HELD"
    OCCUPIED = "OCCUPIED"

class ReservationStatus(str, Enum):
    ACTIVE = "active"
    EXPIRED = "expired"
    CHECKED_IN = "checked_in"
    CANCELLED = "cancelled"

class ChapelStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class VolunteerStatus(str, Enum):
    PENDING = "pending"
    ACTIVE = "active"
    INACTIVE = "inactive"

class GuestStatus(str, Enum):
    ACTIVE = "active"
    ON_PENALTY = "on_penalty"
    DISCHARGED = "discharged"
    GRADUATED = "graduated"

class EmploymentStatus(str, Enum):
    EMPLOYED = "employed"
    SEEKING = "seeking"
    NOT_SEEKING = "not_seeking"
    DISABLED = "disabled"

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

# ===================
# CHAPEL SCHEMAS
# ===================
class ChapelServiceCreate(BaseModel):
    date: str = Field(..., min_length=10, max_length=10)  # YYYY-MM-DD
    time: str = Field(..., min_length=5, max_length=5)  # HH:MM
    group_name: str = Field(..., min_length=1, max_length=256)
    contact_name: str = Field(..., min_length=1, max_length=128)
    contact_phone: str = Field(..., min_length=1, max_length=20)
    contact_email: Optional[str] = Field(None, max_length=256)
    notes: Optional[str] = None

class ChapelServiceUpdate(BaseModel):
    date: Optional[str] = Field(None, min_length=10, max_length=10)
    time: Optional[str] = Field(None, min_length=5, max_length=5)
    group_name: Optional[str] = Field(None, min_length=1, max_length=256)
    contact_name: Optional[str] = Field(None, min_length=1, max_length=128)
    contact_phone: Optional[str] = Field(None, min_length=1, max_length=20)
    contact_email: Optional[str] = Field(None, max_length=256)
    notes: Optional[str] = None
    status: Optional[ChapelStatus] = None

class ChapelServiceResponse(BaseModel):
    id: int
    date: str
    time: str
    group_name: str
    contact_name: str
    contact_phone: str
    contact_email: Optional[str] = None
    notes: Optional[str] = None
    status: ChapelStatus
    created_at: datetime

    class Config:
        from_attributes = True

# ===================
# VOLUNTEER SCHEMAS
# ===================
class VolunteerCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    phone: str = Field(..., min_length=1, max_length=20)
    email: Optional[str] = Field(None, max_length=256)
    availability: Optional[List[str]] = None
    interests: Optional[List[str]] = None
    background_check: bool = False
    notes: Optional[str] = None

class VolunteerUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=128)
    phone: Optional[str] = Field(None, min_length=1, max_length=20)
    email: Optional[str] = Field(None, max_length=256)
    availability: Optional[List[str]] = None
    interests: Optional[List[str]] = None
    background_check: Optional[bool] = None
    notes: Optional[str] = None
    status: Optional[VolunteerStatus] = None

class VolunteerResponse(BaseModel):
    id: int
    name: str
    phone: str
    email: Optional[str] = None
    availability: List[str] = []
    interests: List[str] = []
    background_check: bool
    notes: Optional[str] = None
    status: VolunteerStatus
    last_served: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ===================
# GUEST SCHEMAS
# ===================
class GuestCreate(BaseModel):
    bed_id: int = Field(..., ge=1, le=108)
    first_name: str = Field(..., min_length=1, max_length=64)
    last_name: str = Field(..., min_length=1, max_length=64)
    photo_url: Optional[str] = None  # Base64 or URL
    date_of_birth: Optional[str] = Field(None, max_length=10)  # YYYY-MM-DD
    phone: Optional[str] = Field(None, max_length=20)
    
    # Program info
    programs: Optional[List[str]] = None
    life_coach: Optional[str] = Field(None, max_length=128)
    case_manager: Optional[str] = Field(None, max_length=128)
    
    # Employment
    employment_status: EmploymentStatus = EmploymentStatus.NOT_SEEKING
    employer: Optional[str] = Field(None, max_length=256)
    job_title: Optional[str] = Field(None, max_length=128)
    work_schedule: Optional[str] = None
    
    # Service assignments
    serves_in_kitchen: bool = False
    kitchen_shift: Optional[str] = Field(None, max_length=64)
    assigned_chore: Optional[str] = Field(None, max_length=256)
    chore_schedule: Optional[str] = Field(None, max_length=128)
    
    # Emergency contact
    emergency_contact_name: Optional[str] = Field(None, max_length=128)
    emergency_contact_phone: Optional[str] = Field(None, max_length=20)
    emergency_contact_relationship: Optional[str] = Field(None, max_length=64)
    
    # Additional
    medical_notes: Optional[str] = None
    special_needs: Optional[str] = None
    notes: Optional[str] = None


class GuestUpdate(BaseModel):
    first_name: Optional[str] = Field(None, min_length=1, max_length=64)
    last_name: Optional[str] = Field(None, min_length=1, max_length=64)
    photo_url: Optional[str] = None
    date_of_birth: Optional[str] = Field(None, max_length=10)
    phone: Optional[str] = Field(None, max_length=20)
    
    # Status
    status: Optional[GuestStatus] = None
    expected_discharge_date: Optional[datetime] = None
    
    # Penalty
    on_penalty: Optional[bool] = None
    penalty_reason: Optional[str] = None
    penalty_start_date: Optional[datetime] = None
    penalty_end_date: Optional[datetime] = None
    
    # Program info
    programs: Optional[List[str]] = None
    life_coach: Optional[str] = Field(None, max_length=128)
    case_manager: Optional[str] = Field(None, max_length=128)
    
    # Employment
    employment_status: Optional[EmploymentStatus] = None
    employer: Optional[str] = Field(None, max_length=256)
    job_title: Optional[str] = Field(None, max_length=128)
    work_schedule: Optional[str] = None
    
    # Service assignments
    serves_in_kitchen: Optional[bool] = None
    kitchen_shift: Optional[str] = Field(None, max_length=64)
    assigned_chore: Optional[str] = Field(None, max_length=256)
    chore_schedule: Optional[str] = Field(None, max_length=128)
    
    # Emergency contact
    emergency_contact_name: Optional[str] = Field(None, max_length=128)
    emergency_contact_phone: Optional[str] = Field(None, max_length=20)
    emergency_contact_relationship: Optional[str] = Field(None, max_length=64)
    
    # Additional
    medical_notes: Optional[str] = None
    special_needs: Optional[str] = None
    notes: Optional[str] = None


class GuestResponse(BaseModel):
    id: int
    bed_id: int
    first_name: str
    last_name: str
    photo_url: Optional[str] = None
    date_of_birth: Optional[str] = None
    phone: Optional[str] = None
    
    # Stay info
    check_in_date: datetime
    expected_discharge_date: Optional[datetime] = None
    actual_discharge_date: Optional[datetime] = None
    days_in_shelter: int = 0  # Computed field
    
    # Status
    status: GuestStatus
    on_penalty: bool
    penalty_reason: Optional[str] = None
    penalty_start_date: Optional[datetime] = None
    penalty_end_date: Optional[datetime] = None
    
    # Program info
    programs: List[str] = []
    life_coach: Optional[str] = None
    case_manager: Optional[str] = None
    
    # Employment
    employment_status: EmploymentStatus
    employer: Optional[str] = None
    job_title: Optional[str] = None
    work_schedule: Optional[str] = None
    
    # Service assignments
    serves_in_kitchen: bool
    kitchen_shift: Optional[str] = None
    assigned_chore: Optional[str] = None
    chore_schedule: Optional[str] = None
    
    # Emergency contact
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relationship: Optional[str] = None
    
    # Additional
    medical_notes: Optional[str] = None
    special_needs: Optional[str] = None
    notes: Optional[str] = None
    
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True