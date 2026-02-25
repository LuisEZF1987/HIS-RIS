from __future__ import annotations

import math
from typing import List, Optional

from fastapi import APIRouter, Query
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.dependencies import CurrentUser, DBSession, require_permission
from app.models.order import ImagingOrder
from app.models.report import RadiologyReport
from app.models.study import ImagingStudy, StudyStatus
from app.schemas.order import (
    ImagingOrderCreate, ImagingOrderResponse, ImagingOrderUpdate,
    PaginatedOrders, WorklistEntryResponse,
)
from app.schemas.study import ImagingStudyResponse
from app.services.order_service import OrderService
from app.services.worklist_service import WorklistService

router = APIRouter(tags=["RIS - Orders & Worklist"])


@router.post("/orders", response_model=ImagingOrderResponse, status_code=201,
             dependencies=[require_permission("orders:write")])
async def create_order(data: ImagingOrderCreate, db: DBSession, current_user: CurrentUser):
    svc = OrderService(db)
    order = await svc.create_order(data, current_user.id)

    # Send HL7 ORM O01
    from app.services.hl7_service import HL7Service
    from app.services.patient_service import PatientService
    p_svc = PatientService(db)
    patient = await p_svc.get_by_id(order.patient_id)
    hl7_svc = HL7Service(db)
    await hl7_svc.send_orm_o01(patient, order)

    return order


@router.get("/orders", response_model=PaginatedOrders,
            dependencies=[require_permission("orders:read")])
async def list_orders(
    db: DBSession,
    status: Optional[str] = None,
    modality: Optional[str] = None,
    patient_id: Optional[int] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    svc = OrderService(db)
    orders, total = await svc.list_orders(status, modality, patient_id, page, page_size)
    return PaginatedOrders(
        items=orders,
        total=total,
        page=page,
        page_size=page_size,
        pages=math.ceil(total / page_size) if total else 0,
    )


@router.get("/orders/{order_id}", response_model=ImagingOrderResponse,
            dependencies=[require_permission("orders:read")])
async def get_order(order_id: int, db: DBSession):
    svc = OrderService(db)
    return await svc.get_by_id(order_id)


@router.put("/orders/{order_id}/status", response_model=ImagingOrderResponse,
            dependencies=[require_permission("orders:write")])
async def update_order_status(order_id: int, data: ImagingOrderUpdate, db: DBSession, current_user: CurrentUser):
    svc = OrderService(db)
    return await svc.update_status(order_id, data)


@router.get("/worklist", response_model=list[WorklistEntryResponse],
            dependencies=[require_permission("worklist:read")])
async def get_worklist(
    db: DBSession,
    modality: Optional[str] = None,
):
    svc = WorklistService(db)
    return await svc.get_active_worklist(modality)


@router.get("/studies", response_model=List[ImagingStudyResponse],
            dependencies=[require_permission("orders:read")])
async def list_studies(db: DBSession, status: Optional[str] = None):
    """List imaging studies enriched with order/patient/report info."""
    stmt = (
        select(ImagingStudy)
        .options(
            selectinload(ImagingStudy.order).selectinload(ImagingOrder.patient),
            selectinload(ImagingStudy.report),
        )
        .order_by(ImagingStudy.created_at.desc())
    )
    if status:
        try:
            stmt = stmt.where(ImagingStudy.status == StudyStatus(status.upper()))
        except ValueError:
            pass
    result = await db.execute(stmt)
    studies = result.scalars().all()

    items: List[ImagingStudyResponse] = []
    for s in studies:
        order = s.order
        patient = order.patient if order else None
        report = s.report
        items.append(ImagingStudyResponse(
            id=s.id,
            order_id=s.order_id,
            study_instance_uid=s.study_instance_uid,
            orthanc_study_id=s.orthanc_study_id,
            series_count=s.series_count,
            instances_count=s.instances_count,
            modality=s.modality or (order.modality.value if order else None),
            study_description=s.study_description,
            status=s.status,
            received_at=s.received_at,
            created_at=s.created_at,
            accession_number=order.accession_number if order else None,
            patient_id=patient.id if patient else None,
            patient_name=patient.full_name if patient else None,
            patient_mrn=patient.mrn if patient else None,
            report_id=report.id if report else None,
            report_status=report.status.value if report else None,
        ))
    return items
