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
    operating_start_hour: int = Field(0, ge=0, le=23)
    operating_end_hour: int = Field(24, ge=1, le=24)


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
    # Optional fields to auto-create an order when no order_id is provided
    modality: Optional[str] = Field(None, max_length=10)
    procedure_description: Optional[str] = Field(None, max_length=500)

    @model_validator(mode="after")
    def compute_end_and_validate(self):
        from datetime import timedelta, timezone as tz
        # Reject appointments in the past
        now = datetime.now(tz.utc)
        start = self.start_datetime
        if start.tzinfo is None:
            from datetime import timezone as tz2
            start = start.replace(tzinfo=tz2.utc)
        if start < now:
            raise ValueError("No se puede agendar una cita en una fecha/hora pasada")
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
    resource_name: Optional[str] = None

    model_config = {"from_attributes": True}


class SlotResponse(BaseModel):
    resource_id: int
    start_datetime: datetime
    end_datetime: datetime
    duration_minutes: int
    available: bool
