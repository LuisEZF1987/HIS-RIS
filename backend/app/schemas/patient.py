from __future__ import annotations

from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, Field

from app.models.patient import BloodType, Gender


class PatientContactCreate(BaseModel):
    contact_type: str = Field(..., pattern="^(phone|email|address|emergency)$")
    value: str = Field(..., min_length=1, max_length=255)
    label: Optional[str] = Field(None, max_length=100)
    is_primary: bool = False


class PatientContactResponse(PatientContactCreate):
    id: int
    model_config = {"from_attributes": True}


class PatientCreate(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    date_of_birth: Optional[date] = None
    gender: Optional[Gender] = None
    dni: Optional[str] = Field(None, max_length=30)
    blood_type: Optional[BloodType] = None
    allergies: Optional[str] = None
    notes: Optional[str] = None
    contacts: Optional[List[PatientContactCreate]] = []


class PatientUpdate(BaseModel):
    first_name: Optional[str] = Field(None, min_length=1, max_length=100)
    last_name: Optional[str] = Field(None, min_length=1, max_length=100)
    date_of_birth: Optional[date] = None
    gender: Optional[Gender] = None
    dni: Optional[str] = Field(None, max_length=30)
    blood_type: Optional[BloodType] = None
    allergies: Optional[str] = None
    notes: Optional[str] = None


class PatientResponse(BaseModel):
    id: int
    mrn: str
    first_name: str
    last_name: str
    full_name: str
    date_of_birth: Optional[date] = None
    gender: Optional[Gender] = None
    dni: Optional[str] = None
    blood_type: Optional[BloodType] = None
    allergies: Optional[str] = None
    is_active: bool
    contacts: List[PatientContactResponse] = []
    created_at: datetime

    model_config = {"from_attributes": True}


class PatientListResponse(BaseModel):
    id: int
    mrn: str
    full_name: str
    date_of_birth: Optional[date] = None
    gender: Optional[Gender] = None
    dni: Optional[str] = None
    is_active: bool

    model_config = {"from_attributes": True}


class PaginatedPatients(BaseModel):
    items: List[PatientListResponse]
    total: int
    page: int
    page_size: int
    pages: int
