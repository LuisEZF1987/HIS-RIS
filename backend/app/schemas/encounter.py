from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.models.encounter import EncounterStatus, EncounterType


class EncounterCreate(BaseModel):
    patient_id: int
    encounter_type: EncounterType = EncounterType.outpatient
    admission_date: Optional[datetime] = None
    chief_complaint: Optional[str] = None
    treating_physician: Optional[str] = None
    department: Optional[str] = None
    ward: Optional[str] = None
    bed_number: Optional[str] = None
    notes: Optional[str] = None


class EncounterUpdate(BaseModel):
    status: Optional[EncounterStatus] = None
    discharge_date: Optional[datetime] = None
    diagnosis: Optional[str] = None
    ward: Optional[str] = None
    bed_number: Optional[str] = None
    notes: Optional[str] = None


class EncounterResponse(BaseModel):
    id: int
    patient_id: int
    encounter_type: EncounterType
    status: EncounterStatus
    admission_date: Optional[datetime] = None
    discharge_date: Optional[datetime] = None
    chief_complaint: Optional[str] = None
    diagnosis: Optional[str] = None
    treating_physician: Optional[str] = None
    department: Optional[str] = None
    ward: Optional[str] = None
    bed_number: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}
