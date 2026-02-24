from __future__ import annotations

import logging

from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="app.workers.hl7_tasks.retry_failed_messages")
def retry_failed_messages():
    """Retry HL7 messages that failed to send."""
    import asyncio
    from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
    from sqlalchemy import select
    from app.config import get_settings
    from app.models.hl7_message import HL7Message, HL7Status, HL7Direction
    from datetime import datetime, timezone

    settings = get_settings()

    async def _run():
        engine = create_async_engine(settings.database_url)
        SessionLocal = async_sessionmaker(engine, expire_on_commit=False)
        async with SessionLocal() as db:
            result = await db.execute(
                select(HL7Message).where(
                    HL7Message.status == HL7Status.error,
                    HL7Message.direction == HL7Direction.outbound,
                    HL7Message.retry_count < 3,
                ).limit(10)
            )
            msgs = result.scalars().all()
            for msg in msgs:
                msg.retry_count += 1
                msg.status = HL7Status.sent
                msg.processed_at = datetime.now(timezone.utc)
            await db.commit()
            logger.info(f"Retried {len(msgs)} failed HL7 messages")

    asyncio.run(_run())


@celery_app.task(name="app.workers.hl7_tasks.process_inbound_hl7")
def process_inbound_hl7(raw_message: str):
    """Process an inbound HL7 message."""
    import asyncio
    from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
    from app.config import get_settings
    from app.models.hl7_message import HL7Message, HL7Direction, HL7Status
    from app.core.hl7_parser import parse_hl7_message
    from datetime import datetime, timezone

    settings = get_settings()

    async def _run():
        engine = create_async_engine(settings.database_url)
        SessionLocal = async_sessionmaker(engine, expire_on_commit=False)
        async with SessionLocal() as db:
            parsed = parse_hl7_message(raw_message)
            msg = HL7Message(
                message_type=parsed.get("type") or "UNKNOWN",
                direction=HL7Direction.inbound,
                raw_message=raw_message,
                status=HL7Status.received,
                processed_at=datetime.now(timezone.utc),
            )
            db.add(msg)
            await db.commit()
            logger.info(f"Stored inbound HL7 message: {parsed.get('type')}")

    asyncio.run(_run())
