from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel

from app.models.report import ReportStatus


class ReportCreate(BaseModel):
    study_id: int
    findings: Optional[str] = None
    impression: Optional[str] = None
    recommendation: Optional[str] = None
    technique: Optional[str] = None
    clinical_info: Optional[str] = None


class ReportUpdate(BaseModel):
    findings: Optional[str] = None
    impression: Optional[str] = None
    recommendation: Optional[str] = None
    technique: Optional[str] = None
    clinical_info: Optional[str] = None


class ReportSignRequest(BaseModel):
    password: str  # Re-authenticate to sign


class ReportVersionResponse(BaseModel):
    id: int
    version_number: int
    findings: Optional[str] = None
    impression: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ReportResponse(BaseModel):
    id: int
    study_id: int
    radiologist_id: int
    status: ReportStatus
    findings: Optional[str] = None
    impression: Optional[str] = None
    recommendation: Optional[str] = None
    technique: Optional[str] = None
    clinical_info: Optional[str] = None
    signature_hash: Optional[str] = None
    signed_at: Optional[datetime] = None
    signed_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    versions: List[ReportVersionResponse] = []

    model_config = {"from_attributes": True}
