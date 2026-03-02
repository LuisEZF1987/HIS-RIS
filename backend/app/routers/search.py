from __future__ import annotations

from typing import Any, List

from fastapi import APIRouter, Query
from sqlalchemy import or_, select

from app.dependencies import CurrentUser, DBSession
from app.models.order import ImagingOrder
from app.models.patient import Patient

router = APIRouter(prefix="/search", tags=["Search"])


@router.get("", summary="Global search across patients and orders")
async def global_search(
    db: DBSession,
    current_user: CurrentUser,
    q: str = Query(..., min_length=1, description="Search query"),
) -> dict[str, Any]:
    term = f"%{q.strip()}%"

    # Search patients by name, MRN, or DNI
    patient_stmt = (
        select(Patient)
        .where(
            Patient.is_active == True,
            or_(
                (Patient.first_name + " " + Patient.last_name).ilike(term),
                Patient.mrn.ilike(term),
                Patient.dni.ilike(term),
            ),
        )
        .limit(10)
    )
    patient_result = await db.execute(patient_stmt)
    patients = patient_result.scalars().all()

    # Search orders by accession number or procedure description
    order_stmt = (
        select(ImagingOrder)
        .where(
            or_(
                ImagingOrder.accession_number.ilike(term),
                ImagingOrder.procedure_description.ilike(term),
            ),
        )
        .order_by(ImagingOrder.created_at.desc())
        .limit(10)
    )
    order_result = await db.execute(order_stmt)
    orders = order_result.scalars().all()

    return {
        "patients": [
            {
                "id": p.id,
                "mrn": p.mrn,
                "full_name": p.full_name,
                "dni": p.dni,
            }
            for p in patients
        ],
        "orders": [
            {
                "id": o.id,
                "accession_number": o.accession_number,
                "modality": o.modality.value,
                "procedure_description": o.procedure_description,
                "status": o.status.value,
                "patient_id": o.patient_id,
            }
            for o in orders
        ],
    }
