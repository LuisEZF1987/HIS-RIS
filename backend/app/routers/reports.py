from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import Response

from app.dependencies import CurrentUser, DBSession, require_permission
from app.schemas.report import ReportCreate, ReportResponse, ReportSignRequest, ReportUpdate
from app.services.report_service import ReportService

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.post("", response_model=ReportResponse, status_code=201,
             dependencies=[require_permission("reports:write")])
async def create_report(data: ReportCreate, db: DBSession, current_user: CurrentUser):
    svc = ReportService(db)
    return await svc.create_report(data, current_user)


@router.get("/{report_id}", response_model=ReportResponse,
            dependencies=[require_permission("reports:read")])
async def get_report(report_id: int, db: DBSession):
    svc = ReportService(db)
    return await svc.get_by_id(report_id)


@router.put("/{report_id}", response_model=ReportResponse,
            dependencies=[require_permission("reports:write")])
async def update_report(report_id: int, data: ReportUpdate, db: DBSession, current_user: CurrentUser):
    svc = ReportService(db)
    return await svc.update_report(report_id, data, current_user)


@router.post("/{report_id}/sign", response_model=ReportResponse,
             dependencies=[require_permission("reports:sign")])
async def sign_report(report_id: int, data: ReportSignRequest, db: DBSession, current_user: CurrentUser):
    svc = ReportService(db)
    report = await svc.sign_report(report_id, data.password, current_user)

    # Send HL7 ORU R01 after signing
    from app.services.hl7_service import HL7Service
    from app.services.patient_service import PatientService
    from app.models.study import ImagingStudy
    from app.models.order import ImagingOrder
    from sqlalchemy import select

    result = await db.execute(
        select(ImagingStudy).where(ImagingStudy.id == report.study_id)
    )
    study = result.scalar_one_or_none()
    if study:
        order_result = await db.execute(
            select(ImagingOrder).where(ImagingOrder.id == study.order_id)
        )
        order = order_result.scalar_one_or_none()
        if order:
            p_svc = PatientService(db)
            patient = await p_svc.get_by_id(order.patient_id)
            hl7_svc = HL7Service(db)
            await hl7_svc.send_oru_r01(patient, order, report)

    return report


@router.get("/{report_id}/pdf", summary="Download report PDF")
async def download_pdf(report_id: int, db: DBSession, current_user: CurrentUser):
    svc = ReportService(db)
    pdf_bytes = await svc.generate_pdf(report_id)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=report_{report_id}.pdf"},
    )
