"""SQLAlchemy database models - 108 beds, clean and minimal (SQLite compatible)."""

import enum
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    Enum,
    ForeignKey,
    Text,
    Boolean,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from src.db.database import Base


class BedStatus(enum.Enum):
    """Bed status enum - exactly 3 states."""
    AVAILABLE = "AVAILABLE"
    HELD = "HELD"
    OCCUPIED = "OCCUPIED"


class ReservationStatus(enum.Enum):
    """Reservation status enum."""
    ACTIVE = "active"
    EXPIRED = "expired"
    CHECKED_IN = "checked_in"
    CANCELLED = "cancelled"


class ChapelStatus(enum.Enum):
    """Chapel service status enum."""
    PENDING = "pending"
    CONFIRMED = "confirmed"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class VolunteerStatus(enum.Enum):
    """Volunteer status enum."""
    PENDING = "pending"
    ACTIVE = "active"
    INACTIVE = "inactive"


class GuestStatus(enum.Enum):
    """Guest status enum."""
    ACTIVE = "active"
    ON_PENALTY = "on_penalty"
    DISCHARGED = "discharged"
    GRADUATED = "graduated"


class EmploymentStatus(enum.Enum):
    """Employment status enum."""
    EMPLOYED = "employed"
    SEEKING = "seeking"
    NOT_SEEKING = "not_seeking"
    DISABLED = "disabled"


class Bed(Base):
    """
    Bed model - exactly 108 rows.
    
    Simple: bed_id + status. Nothing else needed.
    """
    __tablename__ = "beds"

    bed_id = Column(Integer, primary_key=True, autoincrement=False)  # 1-108, explicit
    status = Column(
        Enum(BedStatus),
        default=BedStatus.AVAILABLE,
        nullable=False,
    )
    updated_at = Column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
    )

    # Relationship to reservations
    reservations = relationship("Reservation", back_populates="bed")


class Reservation(Base):
    """
    Reservation model - fair, first-come-first-served.
    
    Rules enforced here:
    - caller_hash for privacy (no names)
    - expires_at for auto-cleanup
    - status tracking for full lifecycle
    """
    __tablename__ = "reservations"

    reservation_id = Column(String(36), primary_key=True)  # UUID
    caller_hash = Column(String(64), nullable=False, index=True)  # SHA-256 hash
    bed_id = Column(Integer, ForeignKey("beds.bed_id"), nullable=False)
    
    # Guest info for dashboard display
    caller_name = Column(String(128), nullable=True)
    situation = Column(Text, nullable=True)
    needs = Column(Text, nullable=True)
    confirmation_code = Column(String(16), nullable=True)
    
    created_at = Column(DateTime, server_default=func.now())
    expires_at = Column(DateTime, nullable=False)
    checked_in_at = Column(DateTime, nullable=True)
    
    status = Column(
        Enum(ReservationStatus),
        default=ReservationStatus.ACTIVE,
        nullable=False,
        index=True,
    )

    # Relationships
    bed = relationship("Bed", back_populates="reservations")
    call_logs = relationship("CallLog", primaryjoin="Reservation.reservation_id==foreign(CallLog.reservation_id)", lazy="selectin")


class CallLog(Base):
    """
    Call log for tracking and analytics.
    
    Privacy-first:
    - Hash phone numbers
    - Auto-delete after X days
    - No voice storage by default
    """
    __tablename__ = "call_logs"

    id = Column(Integer, primary_key=True)
    call_sid = Column(String(64), unique=True, nullable=False)
    caller_hash = Column(String(64), nullable=False, index=True)
    
    intent = Column(String(64), nullable=True)  # bed_inquiry, reservation, etc.
    transcript_summary = Column(Text, nullable=True)
    
    reservation_id = Column(String(36), nullable=True)
    risk_flag = Column(String(32), nullable=True)  # crisis, immediate_need, etc.
    
    created_at = Column(DateTime, server_default=func.now())
    duration_seconds = Column(Integer, nullable=True)


class ShelterPolicy(Base):
    """
    Shelter policies for RAG - the source of truth.
    
    This is what the AI references. If it's not here, 
    the AI shouldn't say it.
    """
    __tablename__ = "shelter_policies"

    id = Column(Integer, primary_key=True)
    category = Column(String(64), nullable=False, index=True)  # intake, rules, curfew, etc.
    title = Column(String(256), nullable=False)
    content = Column(Text, nullable=False)
    
    # For versioning
    version = Column(Integer, default=1)
    effective_date = Column(DateTime, server_default=func.now())
    
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
    )


class ChapelService(Base):
    """
    Chapel service scheduling.
    
    Weekdays only, 3 time slots: 10am, 1pm, 7pm
    """
    __tablename__ = "chapel_services"

    id = Column(Integer, primary_key=True)
    date = Column(String(10), nullable=False)  # YYYY-MM-DD format
    time = Column(String(5), nullable=False)  # HH:MM format (10:00, 13:00, 19:00)
    
    group_name = Column(String(256), nullable=False)
    contact_name = Column(String(128), nullable=False)
    contact_phone = Column(String(20), nullable=False)
    contact_email = Column(String(256), nullable=True)
    notes = Column(Text, nullable=True)
    
    status = Column(
        Enum(ChapelStatus),
        default=ChapelStatus.PENDING,
        nullable=False,
        index=True,
    )
    
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
    )


class Volunteer(Base):
    """
    Volunteer management.
    
    Tracks availability, interests, and background check status.
    """
    __tablename__ = "volunteers"

    id = Column(Integer, primary_key=True)
    name = Column(String(128), nullable=False)
    phone = Column(String(20), nullable=False)
    email = Column(String(256), nullable=True)
    
    availability = Column(Text, nullable=True)  # JSON array stored as text
    interests = Column(Text, nullable=True)  # JSON array stored as text
    background_check = Column(Boolean, default=False, nullable=False)
    notes = Column(Text, nullable=True)
    
    status = Column(
        Enum(VolunteerStatus),
        default=VolunteerStatus.PENDING,
        nullable=False,
        index=True,
    )
    
    last_served = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
    )


class Guest(Base):
    """
    Guest management for occupied beds.
    
    Comprehensive tracking of shelter residents including:
    - Personal info and photo
    - Program enrollment
    - Employment status
    - Service assignments
    - Penalty/discharge tracking
    """
    __tablename__ = "guests"

    id = Column(Integer, primary_key=True)
    bed_id = Column(Integer, ForeignKey("beds.bed_id"), nullable=False, unique=True)
    
    # Personal Information
    first_name = Column(String(64), nullable=False)
    last_name = Column(String(64), nullable=False)
    photo_url = Column(Text, nullable=True)  # Base64 encoded or URL
    date_of_birth = Column(String(10), nullable=True)  # YYYY-MM-DD
    phone = Column(String(20), nullable=True)
    
    # Check-in/Stay Information
    check_in_date = Column(DateTime, server_default=func.now())
    expected_discharge_date = Column(DateTime, nullable=True)
    actual_discharge_date = Column(DateTime, nullable=True)
    
    # Status
    status = Column(
        Enum(GuestStatus),
        default=GuestStatus.ACTIVE,
        nullable=False,
        index=True,
    )
    
    # Penalty Information
    on_penalty = Column(Boolean, default=False, nullable=False)
    penalty_reason = Column(Text, nullable=True)
    penalty_start_date = Column(DateTime, nullable=True)
    penalty_end_date = Column(DateTime, nullable=True)
    
    # Program Enrollment (JSON array stored as text)
    programs = Column(Text, nullable=True)  # ["Life Change Program", "GED Classes", etc.]
    life_coach = Column(String(128), nullable=True)
    case_manager = Column(String(128), nullable=True)
    
    # Employment
    employment_status = Column(
        Enum(EmploymentStatus),
        default=EmploymentStatus.NOT_SEEKING,
        nullable=False,
    )
    employer = Column(String(256), nullable=True)
    job_title = Column(String(128), nullable=True)
    work_schedule = Column(Text, nullable=True)
    
    # Service Assignments
    serves_in_kitchen = Column(Boolean, default=False, nullable=False)
    kitchen_shift = Column(String(64), nullable=True)  # "Breakfast", "Lunch", "Dinner"
    assigned_chore = Column(String(256), nullable=True)
    chore_schedule = Column(String(128), nullable=True)  # "Daily", "Mon/Wed/Fri", etc.
    
    # Emergency Contact
    emergency_contact_name = Column(String(128), nullable=True)
    emergency_contact_phone = Column(String(20), nullable=True)
    emergency_contact_relationship = Column(String(64), nullable=True)
    
    # Additional Info
    medical_notes = Column(Text, nullable=True)  # Allergies, medications, conditions
    special_needs = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
    )
    
    # Relationship
    bed = relationship("Bed", backref="guest")
