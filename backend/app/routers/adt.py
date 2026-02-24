from __future__ import annotations

import math
from typing import Optional

from fastapi import APIRouter, Query

from app.dependencies import CurrentUser, DBSession, require_permission
from app.schemas.encounter import EncounterCreate, EncounterResponse, EncounterUpdate
from app.schemas.patient import (
    PaginatedPatients, PatientCreate, PatientResponse, PatientUpdate,
)
from app.services.patient_service import PatientService
from app.services.hl7_service import HL7Service
from app.models.encounter import Encounter, EncounterStatus
from sqlalchemy import select
from sqlalchemy.orm import selectinload

router = APIRouter(tags=["ADT - Patients & Encounters"])


# ── Patients ─────────────────────────────────────────────────────────────────

@router.post("/patients", response_model=PatientResponse, status_code=201,
             dependencies=[require_permission("patients:write")])
async def create_patient(data: PatientCreate, db: DBSession, current_user: CurrentUser):
    svc = PatientService(db)
    return await svc.create(data)


@router.get("/patients", response_model=PaginatedPatients,
            dependencies=[require_permission("patients:read")])
async def list_patients(
    db: DBSession,
    q: Optional[str] = Query(None, description="Search by name, MRN, or DNI"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    svc = PatientService(db)
    patients, total = await svc.search(q, page, page_size)
    return PaginatedPatients(
        items=patients,
        total=total,
        page=page,
        page_size=page_size,
        pages=math.ceil(total / page_size) if total else 0,
    )


@router.get("/patients/{patient_id}", response_model=PatientResponse,
            dependencies=[require_permission("patients:read")])
async def get_patient(patient_id: int, db: DBSession):
    svc = PatientService(db)
    return await svc.get_by_id(patient_id)


@router.put("/patients/{patient_id}", response_model=PatientResponse,
            dependencies=[require_permission("patients:write")])
async def update_patient(patient_id: int, data: PatientUpdate, db: DBSession, current_user: CurrentUser):
    svc = PatientService(db)
    return await svc.update(patient_id, data)


@router.delete("/patients/{patient_id}", status_code=204,
               dependencies=[require_permission("patients:delete")])
async def deactivate_patient(patient_id: int, db: DBSession, current_user: CurrentUser):
    svc = PatientService(db)
    await svc.deactivate(patient_id)


# ── Encounters ────────────────────────────────────────────────────────────────

@router.post("/encounters", response_model=EncounterResponse, status_code=201,
             dependencies=[require_permission("encounters:write")])
async def create_encounter(data: EncounterCreate, db: DBSession, current_user: CurrentUser):
    from app.services.patient_service import PatientService
    from datetime import datetime, timezone

    # Verify patient
    p_svc = PatientService(db)
    patient = await p_svc.get_by_id(data.patient_id)

    encounter = Encounter(
        patient_id=data.patient_id,
        encounter_type=data.encounter_type,
        status=EncounterStatus.arrived,
        admission_date=data.admission_date or datetime.now(timezone.utc),
        chief_complaint=data.chief_complaint,
        treating_physician=data.treating_physician,
        department=data.department,
        ward=data.ward,
        bed_number=data.bed_number,
        notes=data.notes,
    )
    db.add(encounter)
    await db.flush()

    # Send HL7 ADT A01
    hl7_svc = HL7Service(db)
    await hl7_svc.send_adt_a01(patient, encounter)

    await db.commit()
    await db.refresh(encounter)
    return encounter


@router.get("/encounters", response_model=list[EncounterResponse],
            dependencies=[require_permission("encounters:read")])
async def list_encounters(
    db: DBSession,
    patient_id: Optional[int] = None,
):
    stmt = select(Encounter)
    if patient_id:
        stmt = stmt.where(Encounter.patient_id == patient_id)
    stmt = stmt.order_by(Encounter.admission_date.desc())
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/encounters/{encounter_id}", response_model=EncounterResponse,
            dependencies=[require_permission("encounters:read")])
async def get_encounter(encounter_id: int, db: DBSession):
    result = await db.execute(select(Encounter).where(Encounter.id == encounter_id))
    enc = result.scalar_one_or_none()
    if not enc:
        from app.core.exceptions import NotFoundError
        raise NotFoundError(f"Encounter {encounter_id} not found")
    return enc


@router.put("/encounters/{encounter_id}", response_model=EncounterResponse,
            dependencies=[require_permission("encounters:write")])
async def update_encounter(encounter_id: int, data: EncounterUpdate, db: DBSession, current_user: CurrentUser):
    result = await db.execute(select(Encounter).where(Encounter.id == encounter_id))
    enc = result.scalar_one_or_none()
    if not enc:
        from app.core.exceptions import NotFoundError
        raise NotFoundError(f"Encounter {encounter_id} not found")

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(enc, field, value)

    if data.status == EncounterStatus.finished and enc.patient_id:
        # Send HL7 ADT A03
        from app.services.patient_service import PatientService
        p_svc = PatientService(db)
        patient = await p_svc.get_by_id(enc.patient_id)
        hl7_svc = HL7Service(db)
        await hl7_svc.send_adt_a03(patient, enc)

    await db.flush()
    return enc
