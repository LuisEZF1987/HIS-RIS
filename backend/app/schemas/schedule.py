from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, model_validator

from app.models.schedule import AppointmentStatus, ResourceType


class ResourceCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    resource_type: ResourceType
    modality: Optional[str] = Field(None, max_length=10)
    ae_title: Optional[str] = Field(None, max_length=50)
    location: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    is_available: bool = True
    capacity: int = Field(1, ge=1)


class ResourceResponse(ResourceCreate):
    id: int
    created_at: datetime
    model_config = {"from_attributes": True}


class AppointmentCreate(BaseModel):
    patient_id: int
    order_id: Optional[int] = None
    resource_id: Optional[int] = None
    start_datetime: datetime
    duration_minutes: int = Field(30, ge=5, le=480)
    notes: Optional[str] = None

    @model_validator(mode="after")
    def compute_end(self):
        from datetime import timedelta
        self.end_datetime = self.start_datetime + timedelta(minutes=self.duration_minutes)
        return self

    end_datetime: Optional[datetime] = None


class AppointmentUpdate(BaseModel):
    status: Optional[AppointmentStatus] = None
    start_datetime: Optional[datetime] = None
    duration_minutes: Optional[int] = Field(None, ge=5, le=480)
    resource_id: Optional[int] = None
    notes: Optional[str] = None


class AppointmentResponse(BaseModel):
    id: int
    patient_id: int
    order_id: Optional[int] = None
    resource_id: Optional[int] = None
    status: AppointmentStatus
    start_datetime: datetime
    end_datetime: datetime
    duration_minutes: int
    notes: Optional[str] = None
    created_at: datetime
    # Enriched fields (populated by the list endpoint)
    patient_name: Optional[str] = None
    procedure_description: Optional[str] = None

    model_config = {"from_attributes": True}


class SlotResponse(BaseModel):
    resource_id: int
    start_datetime: datetime
    end_datetime: datetime
    duration_minutes: int
    available: bool
