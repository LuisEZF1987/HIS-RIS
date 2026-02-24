from __future__ import annotations

import uuid
from typing import List, Optional

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import AlreadyExistsError, NotFoundError
from app.models.patient import Patient, PatientContact
from app.schemas.patient import PatientCreate, PatientUpdate


def generate_mrn() -> str:
    return f"MRN{uuid.uuid4().hex[:8].upper()}"


class PatientService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, data: PatientCreate) -> Patient:
        if data.dni:
            existing = await self.db.execute(
                select(Patient).where(Patient.dni == data.dni, Patient.is_active == True)
            )
            if existing.scalar_one_or_none():
                raise AlreadyExistsError(f"Patient with DNI {data.dni} already exists")

        patient = Patient(
            mrn=generate_mrn(),
            first_name=data.first_name,
            last_name=data.last_name,
            date_of_birth=data.date_of_birth,
            gender=data.gender,
            dni=data.dni,
            blood_type=data.blood_type,
            allergies=data.allergies,
            notes=data.notes,
        )
        self.db.add(patient)
        await self.db.flush()

        for c in (data.contacts or []):
            contact = PatientContact(
                patient_id=patient.id,
                contact_type=c.contact_type,
                value=c.value,
                label=c.label,
                is_primary=c.is_primary,
            )
            self.db.add(contact)

        await self.db.flush()
        await self.db.refresh(patient, attribute_names=["contacts"])
        return patient

    async def get_by_id(self, patient_id: int) -> Patient:
        result = await self.db.execute(
            select(Patient)
            .options(selectinload(Patient.contacts))
            .where(Patient.id == patient_id)
        )
        patient = result.scalar_one_or_none()
        if not patient:
            raise NotFoundError(f"Patient {patient_id} not found")
        return patient

    async def get_by_mrn(self, mrn: str) -> Patient:
        result = await self.db.execute(
            select(Patient).options(selectinload(Patient.contacts)).where(Patient.mrn == mrn)
        )
        patient = result.scalar_one_or_none()
        if not patient:
            raise NotFoundError(f"Patient MRN {mrn} not found")
        return patient

    async def search(
        self,
        query: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[List[Patient], int]:
        stmt = select(Patient).where(Patient.is_active == True)

        if query:
            q = f"%{query}%"
            stmt = stmt.where(
                or_(
                    Patient.first_name.ilike(q),
                    Patient.last_name.ilike(q),
                    Patient.mrn.ilike(q),
                    Patient.dni.ilike(q),
                )
            )

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await self.db.execute(count_stmt)).scalar_one()

        stmt = stmt.offset((page - 1) * page_size).limit(page_size).order_by(Patient.last_name)
        patients = (await self.db.execute(stmt)).scalars().all()
        return list(patients), total

    async def update(self, patient_id: int, data: PatientUpdate) -> Patient:
        patient = await self.get_by_id(patient_id)
        for field, value in data.model_dump(exclude_none=True).items():
            setattr(patient, field, value)
        await self.db.flush()
        return patient

    async def deactivate(self, patient_id: int) -> Patient:
        patient = await self.get_by_id(patient_id)
        patient.is_active = False
        await self.db.flush()
        return patient
