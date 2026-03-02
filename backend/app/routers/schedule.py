from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Query

from app.dependencies import CurrentUser, DBSession, require_permission
from app.schemas.schedule import (
    AppointmentCreate, AppointmentResponse, AppointmentUpdate,
    ResourceCreate, ResourceResponse, ResourceUpdate, SlotResponse,
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
async def list_resources(
    db: DBSession,
    modality: Optional[str] = None,
    available_only: bool = False,
):
    stmt = select(Resource).order_by(Resource.id)
    if modality:
        stmt = stmt.where(Resource.modality == modality)
    if available_only:
        stmt = stmt.where(Resource.is_available == True)  # noqa: E712
    result = await db.execute(stmt)
    return result.scalars().all()


@router.put("/resources/{resource_id}", response_model=ResourceResponse,
            dependencies=[require_permission("admin:access")])
async def update_resource(resource_id: int, data: ResourceUpdate, db: DBSession):
    from app.core.exceptions import NotFoundError

    result = await db.execute(select(Resource).where(Resource.id == resource_id))
    resource = result.scalar_one_or_none()
    if not resource:
        raise NotFoundError(f"Resource {resource_id} not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(resource, field, value)

    await db.flush()
    return resource


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
    from app.models.order import ImagingOrder, Modality, OrderStatus, generate_accession_number
    from app.services.worklist_service import WorklistService

    # Auto-create an order + worklist if no order_id provided
    if not data.order_id and data.modality and data.procedure_description:
        # Verify patient exists
        p_result = await db.execute(select(Patient).where(Patient.id == data.patient_id))
        patient = p_result.scalar_one_or_none()
        if not patient:
            from app.core.exceptions import NotFoundError
            raise NotFoundError(f"Patient {data.patient_id} not found")

        # Resolve resource for AE title
        resource = None
        if data.resource_id:
            r_result = await db.execute(select(Resource).where(Resource.id == data.resource_id))
            resource = r_result.scalar_one_or_none()

        order = ImagingOrder(
            patient_id=data.patient_id,
            requesting_physician_id=current_user.id,
            accession_number=generate_accession_number(),
            modality=Modality(data.modality),
            procedure_description=data.procedure_description,
            status=OrderStatus.scheduled,
            scheduled_at=data.start_datetime,
        )
        db.add(order)
        await db.flush()

        # Auto-generate worklist entry
        worklist_svc = WorklistService(db)
        await worklist_svc.create_worklist_entry(
            order, patient,
            ae_title=resource.ae_title if resource else None,
            station_name=resource.name if resource else None,
        )

        data.order_id = order.id

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

    # Enrich with patient name, order description, and resource name
    results = []
    for a in appts:
        patient_name: Optional[str] = None
        procedure_description: Optional[str] = None
        resource_name: Optional[str] = None

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

        if a.resource_id:
            r_result = await db.execute(select(Resource).where(Resource.id == a.resource_id))
            resource = r_result.scalar_one_or_none()
            if resource:
                resource_name = resource.name

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
            resource_name=resource_name,
        )
        results.append(response)

    return results


@router.put("/appointments/{appt_id}", response_model=AppointmentResponse,
            dependencies=[require_permission("appointments:write")])
async def update_appointment(appt_id: int, data: AppointmentUpdate, db: DBSession, current_user: CurrentUser):
    svc = ScheduleService(db)
    return await svc.update_appointment(appt_id, data)
