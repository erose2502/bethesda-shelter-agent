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
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from src.db.database import Base


class BedStatus(enum.Enum):
    """Bed status enum - exactly 3 states."""
    AVAILABLE = "available"
    HELD = "held"
    OCCUPIED = "occupied"


class ReservationStatus(enum.Enum):
    """Reservation status enum."""
    ACTIVE = "active"
    EXPIRED = "expired"
    CHECKED_IN = "checked_in"
    CANCELLED = "cancelled"


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
