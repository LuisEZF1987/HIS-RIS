from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="app.workers.dicom_tasks.link_study_to_order", bind=True, max_retries=3)
def link_study_to_order(self, orthanc_study_id: str, accession_number: str):
    """Links an Orthanc study to the corresponding ImagingOrder."""
    import asyncio
    from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
    from sqlalchemy import select
    from app.config import get_settings
    from app.models.order import ImagingOrder, OrderStatus
    from app.models.study import ImagingStudy, StudyStatus
    from app.models.worklist import DicomWorklistEntry, WorklistStatus
    from app.core.dicom_utils import delete_worklist_file

    settings = get_settings()

    async def _run():
        engine = create_async_engine(settings.database_url)
        SessionLocal = async_sessionmaker(engine, expire_on_commit=False)
        async with SessionLocal() as db:
            order_result = await db.execute(
                select(ImagingOrder).where(ImagingOrder.accession_number == accession_number)
            )
            order = order_result.scalar_one_or_none()
            if not order:
                logger.warning(f"Order not found for accession: {accession_number}")
                return

            study_result = await db.execute(
                select(ImagingStudy).where(ImagingStudy.orthanc_study_id == orthanc_study_id)
            )
            study = study_result.scalar_one_or_none()
            if study:
                study.order_id = order.id
                study.status = StudyStatus.available
            else:
                study = ImagingStudy(
                    order_id=order.id,
                    orthanc_study_id=orthanc_study_id,
                    study_instance_uid=orthanc_study_id,
                    status=StudyStatus.available,
                    received_at=datetime.now(timezone.utc),
                )
                db.add(study)

            order.status = OrderStatus.completed
            order.completed_at = datetime.now(timezone.utc)

            wl_result = await db.execute(
                select(DicomWorklistEntry).where(DicomWorklistEntry.accession_number == accession_number)
            )
            wl = wl_result.scalar_one_or_none()
            if wl:
                wl.status = WorklistStatus.completed
                delete_worklist_file(accession_number)

            await db.commit()
            logger.info(f"Study {orthanc_study_id} linked to order {order.id}")

    asyncio.run(_run())


@celery_app.task(name="app.workers.dicom_tasks.cleanup_expired_worklist_entries")
def cleanup_expired_worklist_entries():
    """Remove worklist entries older than 7 days."""
    import asyncio
    from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
    from sqlalchemy import select, delete
    from app.config import get_settings
    from app.models.worklist import DicomWorklistEntry, WorklistStatus
    from app.core.dicom_utils import delete_worklist_file

    settings = get_settings()

    async def _run():
        engine = create_async_engine(settings.database_url)
        SessionLocal = async_sessionmaker(engine, expire_on_commit=False)
        cutoff = datetime.now(timezone.utc) - timedelta(days=7)
        async with SessionLocal() as db:
            result = await db.execute(
                select(DicomWorklistEntry).where(
                    DicomWorklistEntry.status == WorklistStatus.completed,
                    DicomWorklistEntry.updated_at < cutoff,
                )
            )
            entries = result.scalars().all()
            for e in entries:
                delete_worklist_file(e.accession_number)
            logger.info(f"Cleaned up {len(entries)} expired worklist entries")

    asyncio.run(_run())
