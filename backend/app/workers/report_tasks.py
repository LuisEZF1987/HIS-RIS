from __future__ import annotations

import logging

from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="app.workers.report_tasks.generate_report_pdf")
def generate_report_pdf(report_id: int):
    """Generate PDF for a signed report and store the path."""
    import asyncio
    import os
    from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
    from sqlalchemy import select
    from app.config import get_settings
    from app.models.report import RadiologyReport

    settings = get_settings()

    async def _run():
        engine = create_async_engine(settings.database_url)
        SessionLocal = async_sessionmaker(engine, expire_on_commit=False)
        async with SessionLocal() as db:
            from app.services.report_service import ReportService
            svc = ReportService(db)
            try:
                pdf_bytes = await svc.generate_pdf(report_id)
                pdf_dir = "/tmp/reports"
                os.makedirs(pdf_dir, exist_ok=True)
                pdf_path = f"{pdf_dir}/report_{report_id}.pdf"
                with open(pdf_path, "wb") as f:
                    f.write(pdf_bytes)

                result = await db.execute(select(RadiologyReport).where(RadiologyReport.id == report_id))
                report = result.scalar_one_or_none()
                if report:
                    report.pdf_path = pdf_path
                    await db.commit()
                logger.info(f"PDF generated for report {report_id}: {pdf_path}")
            except Exception as e:
                logger.error(f"Failed to generate PDF for report {report_id}: {e}")

    asyncio.run(_run())
