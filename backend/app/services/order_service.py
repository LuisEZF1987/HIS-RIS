from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import BadRequestError, NotFoundError
from app.models.order import ImagingOrder, OrderStatus, generate_accession_number
from app.models.patient import Patient
from app.models.worklist import DicomWorklistEntry, WorklistStatus
from app.schemas.order import ImagingOrderCreate, ImagingOrderEdit, ImagingOrderUpdate
from app.services.worklist_service import WorklistService
from app.services.schedule_service import ScheduleService
from app.schemas.schedule import AppointmentCreate


class OrderService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.worklist_svc = WorklistService(db)

    async def create_order(self, data: ImagingOrderCreate, requesting_user_id: int) -> ImagingOrder:
        # Verify patient exists
        result = await self.db.execute(select(Patient).where(Patient.id == data.patient_id))
        patient = result.scalar_one_or_none()
        if not patient:
            raise NotFoundError(f"Patient {data.patient_id} not found")

        order = ImagingOrder(
            patient_id=data.patient_id,
            encounter_id=data.encounter_id,
            requesting_physician_id=requesting_user_id,
            accession_number=generate_accession_number(),
            modality=data.modality,
            procedure_code=data.procedure_code,
            procedure_description=data.procedure_description,
            body_part=data.body_part,
            laterality=data.laterality,
            priority=data.priority,
            status=OrderStatus.requested,
            clinical_indication=data.clinical_indication,
            special_instructions=data.special_instructions,
            scheduled_at=data.scheduled_at,
        )
        self.db.add(order)
        await self.db.flush()

        # Auto-generate DICOM Worklist entry
        await self.worklist_svc.create_worklist_entry(order, patient)

        # Update status to scheduled if datetime provided
        if data.scheduled_at:
            order.status = OrderStatus.scheduled
            # Auto-create appointment in the agenda
            try:
                sched_svc = ScheduleService(self.db)
                await sched_svc.create_appointment(AppointmentCreate(
                    patient_id=patient.id,
                    order_id=order.id,
                    start_datetime=data.scheduled_at,
                    duration_minutes=30,
                    notes=data.procedure_description,
                ))
            except Exception:
                # Appointment creation is best-effort; don't fail the order
                pass

        await self.db.flush()
        return order

    async def get_by_id(self, order_id: int) -> ImagingOrder:
        result = await self.db.execute(
            select(ImagingOrder)
            .options(selectinload(ImagingOrder.patient))
            .where(ImagingOrder.id == order_id)
        )
        order = result.scalar_one_or_none()
        if not order:
            raise NotFoundError(f"Order {order_id} not found")
        return order

    async def list_orders(
        self,
        status: Optional[str] = None,
        modality: Optional[str] = None,
        patient_id: Optional[int] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[List[ImagingOrder], int]:
        stmt = select(ImagingOrder)

        if status:
            stmt = stmt.where(ImagingOrder.status == status)
        if modality:
            stmt = stmt.where(ImagingOrder.modality == modality)
        if patient_id:
            stmt = stmt.where(ImagingOrder.patient_id == patient_id)

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await self.db.execute(count_stmt)).scalar_one()

        stmt = stmt.order_by(ImagingOrder.requested_at.desc()).offset((page - 1) * page_size).limit(page_size)
        orders = (await self.db.execute(stmt)).scalars().all()
        return list(orders), total

    async def edit_order(self, order_id: int, data: ImagingOrderEdit) -> ImagingOrder:
        """Edit editable fields of an existing order (admin/receptionist)."""
        order = await self.get_by_id(order_id)
        if order.status in (OrderStatus.completed, OrderStatus.cancelled):
            raise BadRequestError("Cannot edit a completed or cancelled order")
        for field, value in data.model_dump(exclude_none=True).items():
            setattr(order, field, value)
        if data.scheduled_at and order.status == OrderStatus.requested:
            order.status = OrderStatus.scheduled
        await self.db.flush()
        return order

    async def cancel_order(self, order_id: int) -> ImagingOrder:
        """Cancel an order and its worklist entry."""
        order = await self.get_by_id(order_id)
        if order.status == OrderStatus.completed:
            raise BadRequestError("Cannot cancel a completed order")
        order.status = OrderStatus.cancelled
        await self.worklist_svc.complete_worklist_entry(order.accession_number)
        await self.db.flush()
        return order

    async def update_status(self, order_id: int, data: ImagingOrderUpdate) -> ImagingOrder:
        order = await self.get_by_id(order_id)
        if data.status:
            order.status = data.status
            if data.status == OrderStatus.completed:
                order.completed_at = datetime.now(timezone.utc)
                # Mark worklist as completed
                await self.worklist_svc.complete_worklist_entry(order.accession_number)
        if data.scheduled_at:
            order.scheduled_at = data.scheduled_at
        if data.priority:
            order.priority = data.priority
        await self.db.flush()
        return order
