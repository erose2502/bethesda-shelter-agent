"""APScheduler-based background jobs - replaces Celery + Redis."""

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.triggers.cron import CronTrigger

from src.config import get_settings

logger = logging.getLogger(__name__)

# Global scheduler instance
scheduler: AsyncIOScheduler | None = None


def get_scheduler() -> AsyncIOScheduler:
    """Get or create the scheduler instance."""
    global scheduler
    if scheduler is None:
        scheduler = AsyncIOScheduler(timezone="America/New_York")
    return scheduler


async def expire_reservations():
    """
    Expire old reservations and release beds.
    
    Runs every 5 minutes (configurable).
    This preserves fairness - no one can hold a bed forever.
    """
    from src.db.database import get_session_factory
    from src.services.reservation_service import ReservationService
    
    try:
        factory = get_session_factory()
        async with factory() as session:
            service = ReservationService(session)
            count = await service.expire_old_reservations()
            await session.commit()
            
            if count > 0:
                logger.info(f"✅ Expired {count} reservations")
            
            return count
    except Exception as e:
        logger.error(f"❌ Error expiring reservations: {e}")
        return 0


async def generate_daily_summary():
    """
    Generate daily summary for staff.
    
    Runs at 7 AM daily.
    """
    from sqlalchemy import select, func
    from src.db.database import get_session_factory
    from src.models.db_models import Bed, BedStatus, Reservation, CallLog, ReservationStatus
    
    try:
        factory = get_session_factory()
        async with factory() as session:
            now = datetime.now(timezone.utc)
            yesterday = now - timedelta(days=1)
            
            # Count beds by status
            bed_result = await session.execute(
                select(Bed.status, func.count(Bed.bed_id))
                .group_by(Bed.status)
            )
            bed_counts = {status.value: count for status, count in bed_result.all()}
            
            # Count calls from last 24 hours
            call_result = await session.execute(
                select(func.count(CallLog.id))
                .where(CallLog.created_at >= yesterday)
            )
            total_calls = call_result.scalar() or 0
            
            # Count reservations created
            res_result = await session.execute(
                select(func.count(Reservation.reservation_id))
                .where(Reservation.created_at >= yesterday)
            )
            reservations_created = res_result.scalar() or 0
            
            # Count check-ins
            checkin_result = await session.execute(
                select(func.count(Reservation.reservation_id))
                .where(Reservation.status == ReservationStatus.CHECKED_IN)
                .where(Reservation.checked_in_at >= yesterday)
            )
            check_ins = checkin_result.scalar() or 0
            
            # Count risk flags
            risk_result = await session.execute(
                select(func.count(CallLog.id))
                .where(CallLog.created_at >= yesterday)
                .where(CallLog.risk_flag.isnot(None))
            )
            risk_flags = risk_result.scalar() or 0
            
            summary = {
                "date": now.isoformat(),
                "beds": bed_counts,
                "total_calls": total_calls,
                "reservations_created": reservations_created,
                "check_ins": check_ins,
                "risk_flags": risk_flags,
            }
            
            logger.info(f"📊 Daily Summary: {summary}")
            return summary
            
    except Exception as e:
        logger.error(f"❌ Error generating daily summary: {e}")
        return {}


async def cleanup_old_data(days_to_keep: int = 30):
    """
    Clean up old call logs and expired reservations.
    
    Runs weekly.
    Privacy-first: auto-delete after X days.
    """
    from sqlalchemy import delete
    from src.db.database import get_session_factory
    from src.models.db_models import CallLog, Reservation, ReservationStatus
    
    try:
        factory = get_session_factory()
        async with factory() as session:
            cutoff = datetime.now(timezone.utc) - timedelta(days=days_to_keep)
            
            # Delete old call logs
            call_result = await session.execute(
                delete(CallLog).where(CallLog.created_at < cutoff)
            )
            calls_deleted = call_result.rowcount
            
            # Delete old expired/cancelled reservations (keep checked_in for longer)
            res_result = await session.execute(
                delete(Reservation)
                .where(Reservation.created_at < cutoff)
                .where(Reservation.status.in_([
                    ReservationStatus.EXPIRED,
                    ReservationStatus.CANCELLED,
                ]))
            )
            reservations_deleted = res_result.rowcount
            
            await session.commit()
            
            result = {
                "calls_deleted": calls_deleted,
                "reservations_deleted": reservations_deleted,
            }
            
            logger.info(f"🧹 Cleanup complete: {result}")
            return result
            
    except Exception as e:
        logger.error(f"❌ Error cleaning up old data: {e}")
        return {}


def setup_scheduler() -> AsyncIOScheduler:
    """Configure and return the scheduler with all jobs."""
    settings = get_settings()
    sched = get_scheduler()
    
    # Expire reservations every N minutes (default 5)
    sched.add_job(
        expire_reservations,
        IntervalTrigger(minutes=settings.reservation_expire_check_minutes),
        id="expire_reservations",
        name="Expire old reservations",
        replace_existing=True,
    )
    
    # Daily summary at 7 AM
    sched.add_job(
        generate_daily_summary,
        CronTrigger(hour=7, minute=0),
        id="daily_summary",
        name="Generate daily summary",
        replace_existing=True,
    )
    
    # Weekly cleanup on Sunday at 2 AM
    sched.add_job(
        cleanup_old_data,
        CronTrigger(day_of_week="sun", hour=2, minute=0),
        id="cleanup_old_data",
        name="Clean up old data",
        replace_existing=True,
    )
    
    return sched


def start_scheduler():
    """Start the background scheduler."""
    sched = setup_scheduler()
    if not sched.running:
        sched.start()
        logger.info("📅 Background scheduler started")
    return sched


def stop_scheduler():
    """Stop the background scheduler."""
    global scheduler
    if scheduler and scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("📅 Background scheduler stopped")
