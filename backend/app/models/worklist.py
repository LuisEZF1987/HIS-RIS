from __future__ import annotations

import enum
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.order import ImagingOrder


class WorklistStatus(str, enum.Enum):
    active = "ACTIVE"
    completed = "COMPLETED"
    cancelled = "CANCELLED"


class DicomWorklistEntry(Base):
    __tablename__ = "dicom_worklist_entries"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("imaging_orders.id"), unique=True, nullable=False, index=True)
    accession_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    # DICOM MWL fields
    patient_id_dicom: Mapped[str] = mapped_column(String(50), nullable=False, comment="PatientID (MRN)")
    patient_name_dicom: Mapped[str] = mapped_column(String(255), nullable=False, comment="PatientName in DICOM format")
    patient_dob: Mapped[Optional[str]] = mapped_column(String(10), nullable=True, comment="YYYYMMDD")
    patient_sex: Mapped[Optional[str]] = mapped_column(String(1), nullable=True, comment="M/F/O")
    modality: Mapped[str] = mapped_column(String(10), nullable=False)
    scheduled_datetime: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    scheduled_station_ae_title: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    scheduled_station_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    procedure_description: Mapped[str] = mapped_column(String(500), nullable=False)
    procedure_code: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    requested_procedure_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    referring_physician: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    status: Mapped[WorklistStatus] = mapped_column(
        Enum(WorklistStatus), nullable=False, default=WorklistStatus.active, index=True
    )
    wl_file_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True, comment="Path to .wl DICOM file")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    order: Mapped["ImagingOrder"] = relationship("ImagingOrder", back_populates="worklist_entry")

    def __repr__(self) -> str:
        return f"<DicomWorklistEntry id={self.id} accession={self.accession_number} modality={self.modality}>"
