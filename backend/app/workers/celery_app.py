from __future__ import annotations

from celery import Celery
from celery.schedules import crontab

from app.config import get_settings

settings = get_settings()

celery_app = Celery(
    "his_ris",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=[
        "app.workers.hl7_tasks",
        "app.workers.dicom_tasks",
        "app.workers.report_tasks",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    beat_schedule={
        "retry-failed-hl7": {
            "task": "app.workers.hl7_tasks.retry_failed_messages",
            "schedule": crontab(minute="*/5"),
        },
        "cleanup-expired-worklists": {
            "task": "app.workers.dicom_tasks.cleanup_expired_worklist_entries",
            "schedule": crontab(hour=2, minute=0),
        },
    },
)
