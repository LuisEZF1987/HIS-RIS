from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Body, HTTPException
from sqlalchemy import select

from app.dependencies import CurrentUser, DBSession
from app.models.order import ImagingOrder, OrderStatus
from app.models.study import ImagingStudy, StudyStatus
from app.services.orthanc_service import OrthancService
from app.services.worklist_service import WorklistService

router = APIRouter(prefix="/orthanc", tags=["Orthanc / DICOM"])
logger = logging.getLogger(__name__)


@router.post("/webhook", summary="Orthanc study received webhook")
async def orthanc_study_webhook(
    db: DBSession,
    payload: dict[str, Any] = Body(...),
):
    """
    Called by Orthanc when a new study arrives via C-STORE.
    Links the study to the corresponding imaging order.
    """
    change_type = payload.get("ChangeType", "")
    resource_type = payload.get("ResourceType", "")
    orthanc_id = payload.get("ID", "")

    logger.info(f"Orthanc webhook: {change_type} {resource_type} {orthanc_id}")

    if change_type not in ("StableStudy", "NewStudy") or resource_type != "Study":
        return {"status": "ignored"}

    # Get study details from Orthanc
    orthanc_svc = OrthancService()
    try:
        study_data = await orthanc_svc.get_study(orthanc_id)
    except Exception as e:
        logger.error(f"Failed to get study from Orthanc: {e}")
        raise HTTPException(status_code=502, detail="Failed to contact Orthanc")

    main_tags = study_data.get("MainDicomTags", {})
    study_uid = main_tags.get("StudyInstanceUID", "")
    accession_number = main_tags.get("AccessionNumber", "")

    if not study_uid:
        return {"status": "error", "reason": "No StudyInstanceUID"}

    # Find order by accession number
    order = None
    if accession_number:
        result = await db.execute(
            select(ImagingOrder).where(ImagingOrder.accession_number == accession_number)
        )
        order = result.scalar_one_or_none()

    # Check if study already linked
    existing_study = await db.execute(
        select(ImagingStudy).where(ImagingStudy.study_instance_uid == study_uid)
    )
    existing = existing_study.scalar_one_or_none()

    if existing:
        # Update orthanc_id if not set
        if not existing.orthanc_study_id:
            existing.orthanc_study_id = orthanc_id
        existing.status = StudyStatus.available
        await db.flush()
        return {"status": "updated", "study_id": existing.id}

    # Get stats
    try:
        stats = await orthanc_svc.get_study_metadata(orthanc_id)
        series_count = stats.get("CountSeries", 0)
        instances_count = stats.get("CountInstances", 0)
    except Exception:
        series_count = 0
        instances_count = 0

    # Create ImagingStudy record
    study = ImagingStudy(
        order_id=order.id if order else None,
        study_instance_uid=study_uid,
        orthanc_study_id=orthanc_id,
        series_count=series_count,
        instances_count=instances_count,
        modality=main_tags.get("Modality"),
        study_description=main_tags.get("StudyDescription"),
        status=StudyStatus.available,
        received_at=datetime.now(timezone.utc),
    )
    db.add(study)
    await db.flush()

    if order:
        order.status = OrderStatus.completed
        order.completed_at = datetime.now(timezone.utc)
        # Complete worklist entry
        wl_svc = WorklistService(db)
        await wl_svc.complete_worklist_entry(accession_number)

    await db.flush()
    logger.info(f"Study {study_uid} linked to order {order.id if order else 'N/A'}")
    return {"status": "created", "study_id": study.id}


@router.get("/studies/{orthanc_id}", summary="Get study from Orthanc")
async def get_orthanc_study(orthanc_id: str, current_user: CurrentUser):
    svc = OrthancService()
    return await svc.get_study(orthanc_id)


@router.get("/health", summary="Orthanc health check")
async def orthanc_health():
    svc = OrthancService()
    healthy = await svc.is_healthy()
    return {"orthanc_available": healthy}
