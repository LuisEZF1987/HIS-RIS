from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Query
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.dependencies import CurrentUser, DBSession, require_permission
from app.models.order import ImagingOrder
from app.models.patient import Patient
from app.models.worklist import DicomWorklistEntry
from app.services.export_service import to_csv, to_excel

router = APIRouter(prefix="/export", tags=["Export"])


def _export_response(data: bytes, fmt: str, filename: str) -> Response:
    if fmt == "xlsx":
        return Response(
            content=data,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{filename}.xlsx"'},
        )
    return Response(
        content=data,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}.csv"'},
    )


@router.get("/patients", dependencies=[require_permission("patients:read")])
async def export_patients(
    db: DBSession,
    current_user: CurrentUser,
    format: str = Query("csv", regex="^(csv|xlsx)$"),
):
    result = await db.execute(
        select(Patient).where(Patient.is_active == True).order_by(Patient.last_name)
    )
    patients = result.scalars().all()

    headers = ["MRN", "Nombre", "Apellido", "Fecha Nac.", "Género", "DNI", "Grupo Sanguíneo"]
    rows = [
        [p.mrn, p.first_name, p.last_name, str(p.date_of_birth or ""), p.gender.value if p.gender else "", p.dni or "", p.blood_type.value if p.blood_type else ""]
        for p in patients
    ]
    data = to_excel(headers, rows, "Pacientes") if format == "xlsx" else to_csv(headers, rows)
    return _export_response(data, format, "pacientes")


@router.get("/orders", dependencies=[require_permission("orders:read")])
async def export_orders(
    db: DBSession,
    current_user: CurrentUser,
    status: Optional[str] = None,
    format: str = Query("csv", regex="^(csv|xlsx)$"),
):
    stmt = (
        select(ImagingOrder)
        .options(selectinload(ImagingOrder.patient))
        .order_by(ImagingOrder.created_at.desc())
    )
    if status:
        stmt = stmt.where(ImagingOrder.status == status)
    result = await db.execute(stmt)
    orders = result.scalars().all()

    headers = ["Accession", "Paciente", "MRN", "Modalidad", "Procedimiento", "Prioridad", "Estado", "Fecha Solicitud", "Fecha Completado"]
    rows = [
        [
            o.accession_number,
            o.patient.full_name if o.patient else "",
            o.patient.mrn if o.patient else "",
            o.modality.value,
            o.procedure_description,
            o.priority.value,
            o.status.value,
            str(o.requested_at or ""),
            str(o.completed_at or ""),
        ]
        for o in orders
    ]
    data = to_excel(headers, rows, "Órdenes") if format == "xlsx" else to_csv(headers, rows)
    return _export_response(data, format, "ordenes")


@router.get("/worklist", dependencies=[require_permission("worklist:read")])
async def export_worklist(
    db: DBSession,
    current_user: CurrentUser,
    format: str = Query("csv", regex="^(csv|xlsx)$"),
):
    result = await db.execute(
        select(DicomWorklistEntry)
        .where(DicomWorklistEntry.status == "SCHEDULED")
        .order_by(DicomWorklistEntry.scheduled_datetime)
    )
    entries = result.scalars().all()

    headers = ["Accession", "Paciente", "ID DICOM", "Modalidad", "Procedimiento", "Fecha/Hora", "AE Title"]
    rows = [
        [
            e.accession_number,
            e.patient_name_dicom,
            e.patient_id_dicom,
            e.modality,
            e.procedure_description,
            str(e.scheduled_datetime or ""),
            e.scheduled_station_ae_title or "",
        ]
        for e in entries
    ]
    data = to_excel(headers, rows, "Worklist") if format == "xlsx" else to_csv(headers, rows)
    return _export_response(data, format, "worklist")
