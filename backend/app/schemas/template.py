from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class ReportTemplateCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    modality: Optional[str] = None
    technique: Optional[str] = None
    findings: Optional[str] = None
    impression: Optional[str] = None
    recommendation: Optional[str] = None


class ReportTemplateUpdate(BaseModel):
    name: Optional[str] = None
    modality: Optional[str] = None
    technique: Optional[str] = None
    findings: Optional[str] = None
    impression: Optional[str] = None
    recommendation: Optional[str] = None
    is_active: Optional[bool] = None


class ReportTemplateResponse(BaseModel):
    id: int
    name: str
    modality: Optional[str] = None
    technique: Optional[str] = None
    findings: Optional[str] = None
    impression: Optional[str] = None
    recommendation: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
