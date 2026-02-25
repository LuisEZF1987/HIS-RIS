from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.models.study import StudyStatus


class ImagingStudyResponse(BaseModel):
    id: int
    order_id: Optional[int] = None
    study_instance_uid: str
    orthanc_study_id: Optional[str] = None
    series_count: int
    instances_count: int
    modality: Optional[str] = None
    study_description: Optional[str] = None
    status: StudyStatus
    received_at: Optional[datetime] = None
    created_at: datetime
    # Enriched from related order / patient
    accession_number: Optional[str] = None
    patient_id: Optional[int] = None
    patient_name: Optional[str] = None
    patient_mrn: Optional[str] = None
    # Report info (if exists)
    report_id: Optional[int] = None
    report_status: Optional[str] = None

    model_config = {"from_attributes": True}
