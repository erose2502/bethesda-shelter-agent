"""Background tasks for the shelter agent."""

import asyncio
from datetime import datetime, timedelta, timezone

from src.jobs.celery_app import celery_app
from src.db.database import get_session_factory
from src.services.reservation_service import ReservationService


def run_async(coro):
    """Helper to run async code in Celery tasks."""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@celery_app.task(name="src.jobs.tasks.expire_reservations")
def expire_reservations():
    """
    Expire old reservations and release beds.
    
    Runs every 5 minutes.
    This preserves fairness - no one can hold a bed forever.
    """
    async def _expire():
        factory = get_session_factory()
        async with factory() as session:
            service = ReservationService(session)
            count = await service.expire_old_reservations()
            await session.commit()
            return count

    expired_count = run_async(_expire())
    
    if expired_count > 0:
        print(f"✅ Expired {expired_count} reservations")
    
    return {"expired": expired_count}


@celery_app.task(name="src.jobs.tasks.generate_daily_summary")
def generate_daily_summary():
    """
    Generate daily summary for staff.
    
    Runs at 7 AM daily.
    """
    async def _generate():
        from sqlalchemy import select, func
        from src.db.database import get_session_factory
        from src.models.db_models import Bed, BedStatus, Reservation, CallLog, ReservationStatus
        
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
            
            return {
                "date": now.isoformat(),
                "beds": bed_counts,
                "total_calls": total_calls,
                "reservations_created": reservations_created,
                "check_ins": check_ins,
                "risk_flags": risk_flags,
            }

    summary = run_async(_generate())
    print(f"📊 Daily Summary: {summary}")
    return summary


@celery_app.task(name="src.jobs.tasks.cleanup_old_data")
def cleanup_old_data(days_to_keep: int = 30):
    """
    Clean up old call logs and expired reservations.
    
    Runs weekly.
    Privacy-first: auto-delete after X days.
    """
    async def _cleanup():
        from sqlalchemy import delete
        from src.db.database import get_session_factory
        from src.models.db_models import CallLog, Reservation, ReservationStatus
        
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
            
            return {
                "calls_deleted": calls_deleted,
                "reservations_deleted": reservations_deleted,
            }

    result = run_async(_cleanup())
    print(f"🧹 Cleanup complete: {result}")
    return result
