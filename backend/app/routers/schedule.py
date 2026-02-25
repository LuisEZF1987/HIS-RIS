from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Query

from app.dependencies import CurrentUser, DBSession, require_permission
from app.schemas.schedule import (
    AppointmentCreate, AppointmentResponse, AppointmentUpdate,
    ResourceCreate, ResourceResponse, SlotResponse,
)
from app.services.schedule_service import ScheduleService
from app.models.schedule import Appointment, Resource
from app.models.patient import Patient
from app.models.order import ImagingOrder
from sqlalchemy import select
from sqlalchemy.orm import selectinload

router = APIRouter(tags=["Scheduling"])


# ── Resources ──────────────────────────────────────────────────────────────────

@router.post("/resources", response_model=ResourceResponse, status_code=201,
             dependencies=[require_permission("admin:access")])
async def create_resource(data: ResourceCreate, db: DBSession):
    resource = Resource(**data.model_dump())
    db.add(resource)
    await db.flush()
    return resource


@router.get("/resources", response_model=list[ResourceResponse],
            dependencies=[require_permission("appointments:read")])
async def list_resources(db: DBSession, modality: Optional[str] = None):
    stmt = select(Resource)
    if modality:
        stmt = stmt.where(Resource.modality == modality)
    result = await db.execute(stmt)
    return result.scalars().all()


# ── Slots ──────────────────────────────────────────────────────────────────────

@router.get("/slots", response_model=list[SlotResponse],
            dependencies=[require_permission("appointments:read")])
async def get_slots(
    db: DBSession,
    resource_id: int = Query(...),
    date: datetime = Query(...),
    duration_minutes: int = Query(30, ge=5, le=120),
):
    svc = ScheduleService(db)
    return await svc.get_available_slots(resource_id, date, duration_minutes)


# ── Appointments ───────────────────────────────────────────────────────────────

@router.post("/appointments", response_model=AppointmentResponse, status_code=201,
             dependencies=[require_permission("appointments:write")])
async def create_appointment(data: AppointmentCreate, db: DBSession, current_user: CurrentUser):
    svc = ScheduleService(db)
    return await svc.create_appointment(data)


@router.get("/appointments", response_model=list[AppointmentResponse],
            dependencies=[require_permission("appointments:read")])
async def list_appointments(
    db: DBSession,
    patient_id: Optional[int] = None,
    resource_id: Optional[int] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
):
    svc = ScheduleService(db)
    appts = await svc.list_appointments(patient_id, resource_id, date_from, date_to)

    # Enrich with patient name and order description
    results = []
    for a in appts:
        patient_name: Optional[str] = None
        procedure_description: Optional[str] = None

        if a.patient_id:
            p_result = await db.execute(select(Patient).where(Patient.id == a.patient_id))
            patient = p_result.scalar_one_or_none()
            if patient:
                patient_name = patient.full_name

        if a.order_id:
            o_result = await db.execute(select(ImagingOrder).where(ImagingOrder.id == a.order_id))
            order = o_result.scalar_one_or_none()
            if order:
                procedure_description = order.procedure_description

        response = AppointmentResponse(
            id=a.id,
            patient_id=a.patient_id,
            order_id=a.order_id,
            resource_id=a.resource_id,
            status=a.status,
            start_datetime=a.start_datetime,
            end_datetime=a.end_datetime,
            duration_minutes=a.duration_minutes,
            notes=a.notes,
            created_at=a.created_at,
            patient_name=patient_name,
            procedure_description=procedure_description,
        )
        results.append(response)

    return results


@router.put("/appointments/{appt_id}", response_model=AppointmentResponse,
            dependencies=[require_permission("appointments:write")])
async def update_appointment(appt_id: int, data: AppointmentUpdate, db: DBSession, current_user: CurrentUser):
    svc = ScheduleService(db)
    return await svc.update_appointment(appt_id, data)
