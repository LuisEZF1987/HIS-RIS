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
from app.models.schedule import Resource
from sqlalchemy import select

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
    return await svc.list_appointments(patient_id, resource_id, date_from, date_to)


@router.put("/appointments/{appt_id}", response_model=AppointmentResponse,
            dependencies=[require_permission("appointments:write")])
async def update_appointment(appt_id: int, data: AppointmentUpdate, db: DBSession, current_user: CurrentUser):
    svc = ScheduleService(db)
    return await svc.update_appointment(appt_id, data)
