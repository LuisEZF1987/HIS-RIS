from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import List, Optional

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError
from app.models.schedule import Appointment, AppointmentStatus, Resource
from app.schemas.schedule import AppointmentCreate, AppointmentUpdate, SlotResponse


class ScheduleService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_available_slots(
        self,
        resource_id: int,
        date: datetime,
        duration_minutes: int = 30,
        working_hours_start: int = 8,
        working_hours_end: int = 18,
    ) -> List[SlotResponse]:
        # Get all booked appointments for the day
        day_start = date.replace(hour=working_hours_start, minute=0, second=0, microsecond=0)
        day_end = date.replace(hour=working_hours_end, minute=0, second=0, microsecond=0)

        booked = await self.db.execute(
            select(Appointment).where(
                Appointment.resource_id == resource_id,
                Appointment.status.notin_([AppointmentStatus.cancelled, AppointmentStatus.noshow]),
                Appointment.start_datetime >= day_start,
                Appointment.start_datetime < day_end,
            )
        )
        booked_slots = list(booked.scalars().all())

        slots = []
        current = day_start
        while current + timedelta(minutes=duration_minutes) <= day_end:
            slot_end = current + timedelta(minutes=duration_minutes)
            available = not any(
                not (slot_end <= b.start_datetime or current >= b.end_datetime)
                for b in booked_slots
            )
            slots.append(SlotResponse(
                resource_id=resource_id,
                start_datetime=current,
                end_datetime=slot_end,
                duration_minutes=duration_minutes,
                available=available,
            ))
            current += timedelta(minutes=duration_minutes)

        return slots

    async def create_appointment(self, data: AppointmentCreate) -> Appointment:
        from datetime import timedelta
        end_dt = data.start_datetime + timedelta(minutes=data.duration_minutes)

        # Check for conflicts
        if data.resource_id:
            conflict = await self.db.execute(
                select(Appointment).where(
                    Appointment.resource_id == data.resource_id,
                    Appointment.status.notin_([AppointmentStatus.cancelled, AppointmentStatus.noshow]),
                    Appointment.start_datetime < end_dt,
                    Appointment.end_datetime > data.start_datetime,
                )
            )
            if conflict.scalar_one_or_none():
                raise ConflictError("Time slot is already booked for this resource")

        appt = Appointment(
            patient_id=data.patient_id,
            order_id=data.order_id,
            resource_id=data.resource_id,
            status=AppointmentStatus.booked,
            start_datetime=data.start_datetime,
            end_datetime=end_dt,
            duration_minutes=data.duration_minutes,
            notes=data.notes,
        )
        self.db.add(appt)
        await self.db.flush()
        return appt

    async def update_appointment(self, appt_id: int, data: AppointmentUpdate) -> Appointment:
        result = await self.db.execute(select(Appointment).where(Appointment.id == appt_id))
        appt = result.scalar_one_or_none()
        if not appt:
            raise NotFoundError(f"Appointment {appt_id} not found")

        for field, value in data.model_dump(exclude_none=True).items():
            setattr(appt, field, value)

        if data.start_datetime and data.duration_minutes:
            from datetime import timedelta
            appt.end_datetime = data.start_datetime + timedelta(minutes=data.duration_minutes)

        await self.db.flush()
        return appt

    async def list_appointments(
        self,
        patient_id: Optional[int] = None,
        resource_id: Optional[int] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
    ) -> List[Appointment]:
        stmt = select(Appointment)
        if patient_id:
            stmt = stmt.where(Appointment.patient_id == patient_id)
        if resource_id:
            stmt = stmt.where(Appointment.resource_id == resource_id)
        if date_from:
            stmt = stmt.where(Appointment.start_datetime >= date_from)
        if date_to:
            stmt = stmt.where(Appointment.start_datetime <= date_to)
        stmt = stmt.order_by(Appointment.start_datetime)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
