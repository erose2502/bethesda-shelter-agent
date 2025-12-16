"""Celery app configuration."""

from celery import Celery
from celery.schedules import crontab

from src.config import get_settings

settings = get_settings()

# Create Celery app
celery_app = Celery(
    "bethesda_shelter",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["src.jobs.tasks"],
)

# Celery configuration
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="America/New_York",  # Harrisburg, PA timezone
    enable_utc=True,
    task_track_started=True,
    task_time_limit=300,  # 5 minute timeout
    worker_prefetch_multiplier=1,
)

# Beat schedule for periodic tasks
celery_app.conf.beat_schedule = {
    # Expire old reservations every 5 minutes
    "expire-reservations": {
        "task": "src.jobs.tasks.expire_reservations",
        "schedule": crontab(minute="*/5"),  # Every 5 minutes
    },
    # Daily summary at 7 AM
    "daily-summary": {
        "task": "src.jobs.tasks.generate_daily_summary",
        "schedule": crontab(hour=7, minute=0),
    },
    # Clean old call logs weekly (Sunday at 2 AM)
    "cleanup-call-logs": {
        "task": "src.jobs.tasks.cleanup_old_data",
        "schedule": crontab(hour=2, minute=0, day_of_week=0),
    },
}
