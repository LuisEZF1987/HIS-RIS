from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field

from app.models.order import Modality, OrderPriority, OrderStatus


class ImagingOrderCreate(BaseModel):
    patient_id: int
    encounter_id: Optional[int] = None
    modality: Modality
    procedure_code: Optional[str] = Field(None, max_length=50)
    procedure_description: str = Field(..., min_length=3, max_length=500)
    body_part: Optional[str] = Field(None, max_length=100)
    laterality: Optional[str] = Field(None, max_length=20)
    priority: OrderPriority = OrderPriority.routine
    clinical_indication: Optional[str] = None
    special_instructions: Optional[str] = None
    scheduled_at: Optional[datetime] = None


class ImagingOrderUpdate(BaseModel):
    status: Optional[OrderStatus] = None
    priority: Optional[OrderPriority] = None
    scheduled_at: Optional[datetime] = None
    special_instructions: Optional[str] = None


class ImagingOrderEdit(BaseModel):
    """Full editable fields (for admin/receptionist corrections)."""
    modality: Optional[Modality] = None
    procedure_description: Optional[str] = Field(None, min_length=3, max_length=500)
    procedure_code: Optional[str] = Field(None, max_length=50)
    body_part: Optional[str] = Field(None, max_length=100)
    priority: Optional[OrderPriority] = None
    clinical_indication: Optional[str] = None
    scheduled_at: Optional[datetime] = None


class ImagingOrderResponse(BaseModel):
    id: int
    patient_id: int
    encounter_id: Optional[int] = None
    accession_number: str
    modality: Modality
    procedure_code: Optional[str] = None
    procedure_description: str
    body_part: Optional[str] = None
    laterality: Optional[str] = None
    priority: OrderPriority
    status: OrderStatus
    clinical_indication: Optional[str] = None
    special_instructions: Optional[str] = None
    requested_at: datetime
    scheduled_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class WorklistEntryResponse(BaseModel):
    id: int
    order_id: int
    accession_number: str
    patient_id_dicom: str
    patient_name_dicom: str
    modality: str
    scheduled_datetime: datetime
    scheduled_station_ae_title: Optional[str] = None
    procedure_description: str
    status: str

    model_config = {"from_attributes": True}


class PaginatedOrders(BaseModel):
    items: List[ImagingOrderResponse]
    total: int
    page: int
    page_size: int
    pages: int
