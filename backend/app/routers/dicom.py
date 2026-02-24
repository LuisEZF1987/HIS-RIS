from __future__ import annotations

from fastapi import APIRouter
from sqlalchemy import select

from app.dependencies import CurrentUser, DBSession, require_permission
from app.models.study import ImagingStudy
from app.services.orthanc_service import OrthancService

router = APIRouter(prefix="/dicom", tags=["DICOM Studies"])


@router.get("/studies", summary="List DICOM studies",
            dependencies=[require_permission("studies:read")])
async def list_studies(db: DBSession, order_id: int = None):
    stmt = select(ImagingStudy)
    if order_id:
        stmt = stmt.where(ImagingStudy.order_id == order_id)
    stmt = stmt.order_by(ImagingStudy.received_at.desc())
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/studies/{study_id}", summary="Get DICOM study",
            dependencies=[require_permission("studies:read")])
async def get_study(study_id: int, db: DBSession):
    result = await db.execute(select(ImagingStudy).where(ImagingStudy.id == study_id))
    study = result.scalar_one_or_none()
    if not study:
        from app.core.exceptions import NotFoundError
        raise NotFoundError(f"Study {study_id} not found")
    return study


@router.get("/studies/{study_id}/proxy", summary="Proxy to Orthanc viewer URL",
            dependencies=[require_permission("studies:read")])
async def proxy_study(study_id: int, db: DBSession, current_user: CurrentUser):
    result = await db.execute(select(ImagingStudy).where(ImagingStudy.id == study_id))
    study = result.scalar_one_or_none()
    if not study or not study.orthanc_study_id:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("Study not available in Orthanc")

    svc = OrthancService()
    url = await svc.get_study_preview_url(study.orthanc_study_id)
    return {"viewer_url": url, "orthanc_id": study.orthanc_study_id}
