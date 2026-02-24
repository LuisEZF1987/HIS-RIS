from __future__ import annotations

from fastapi import APIRouter
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.exceptions import NotFoundError
from app.dependencies import CurrentUser, DBSession, require_permission
from app.models.order import ImagingOrder
from app.models.patient import Patient
from app.models.report import RadiologyReport
from app.models.study import ImagingStudy
from app.services.fhir_service import FHIRService

router = APIRouter(prefix="/fhir/r4", tags=["FHIR R4"])
fhir_svc = FHIRService()


@router.get("/Patient/{patient_id}", summary="Get Patient as FHIR R4 resource",
            dependencies=[require_permission("fhir:read")])
async def fhir_patient(patient_id: int, db: DBSession):
    result = await db.execute(
        select(Patient)
        .options(selectinload(Patient.contacts))
        .where(Patient.id == patient_id)
    )
    patient = result.scalar_one_or_none()
    if not patient:
        raise NotFoundError(f"Patient {patient_id} not found")
    return fhir_svc.patient_to_fhir(patient)


@router.get("/Patient", summary="Search Patients (FHIR Bundle)",
            dependencies=[require_permission("fhir:read")])
async def fhir_patient_search(db: DBSession, identifier: str = None):
    stmt = select(Patient).options(selectinload(Patient.contacts))
    if identifier:
        stmt = stmt.where(Patient.mrn == identifier)
    result = await db.execute(stmt.limit(50))
    patients = result.scalars().all()
    entries = [{"resource": fhir_svc.patient_to_fhir(p)} for p in patients]
    return {
        "resourceType": "Bundle",
        "type": "searchset",
        "total": len(entries),
        "entry": entries,
    }


@router.get("/ServiceRequest/{order_id}", summary="Get Order as FHIR ServiceRequest",
            dependencies=[require_permission("fhir:read")])
async def fhir_service_request(order_id: int, db: DBSession):
    result = await db.execute(
        select(ImagingOrder)
        .options(selectinload(ImagingOrder.patient))
        .where(ImagingOrder.id == order_id)
    )
    order = result.scalar_one_or_none()
    if not order:
        raise NotFoundError(f"Order {order_id} not found")
    return fhir_svc.order_to_fhir(order, order.patient)


@router.get("/ImagingStudy/{study_id}", summary="Get Study as FHIR ImagingStudy",
            dependencies=[require_permission("fhir:read")])
async def fhir_imaging_study(study_id: int, db: DBSession):
    result = await db.execute(
        select(ImagingStudy)
        .options(selectinload(ImagingStudy.order).selectinload(ImagingOrder.patient))
        .where(ImagingStudy.id == study_id)
    )
    study = result.scalar_one_or_none()
    if not study:
        raise NotFoundError(f"Study {study_id} not found")
    return fhir_svc.study_to_fhir(study, study.order, study.order.patient)


@router.get("/DiagnosticReport/{report_id}", summary="Get Report as FHIR DiagnosticReport",
            dependencies=[require_permission("fhir:read")])
async def fhir_diagnostic_report(report_id: int, db: DBSession):
    result = await db.execute(
        select(RadiologyReport)
        .options(
            selectinload(RadiologyReport.study)
            .selectinload(ImagingStudy.order)
            .selectinload(ImagingOrder.patient)
        )
        .where(RadiologyReport.id == report_id)
    )
    report = result.scalar_one_or_none()
    if not report:
        raise NotFoundError(f"Report {report_id} not found")
    study = report.study
    return fhir_svc.report_to_fhir(report, study, study.order.patient)
