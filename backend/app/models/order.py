from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.patient import Patient
    from app.models.encounter import Encounter
    from app.models.worklist import DicomWorklistEntry
    from app.models.study import ImagingStudy
    from app.models.schedule import Appointment


class Modality(str, enum.Enum):
    CR = "CR"   # Computed Radiography
    CT = "CT"   # Computed Tomography
    MR = "MR"   # Magnetic Resonance
    US = "US"   # Ultrasound
    NM = "NM"   # Nuclear Medicine
    PT = "PT"   # PET
    DX = "DX"   # Digital Radiography
    MG = "MG"   # Mammography
    XA = "XA"   # X-Ray Angiography
    RF = "RF"   # Radio Fluoroscopy
    OT = "OT"   # Other


class OrderPriority(str, enum.Enum):
    routine = "ROUTINE"
    urgent = "URGENT"
    stat = "STAT"
    asap = "ASAP"


class OrderStatus(str, enum.Enum):
    requested = "REQUESTED"
    scheduled = "SCHEDULED"
    in_progress = "IN_PROGRESS"
    completed = "COMPLETED"
    cancelled = "CANCELLED"
    on_hold = "ON_HOLD"


def generate_accession_number() -> str:
    return f"ACC{uuid.uuid4().hex[:10].upper()}"


class ImagingOrder(Base):
    __tablename__ = "imaging_orders"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), nullable=False, index=True)
    encounter_id: Mapped[Optional[int]] = mapped_column(ForeignKey("encounters.id"), nullable=True, index=True)
    requesting_physician_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    accession_number: Mapped[str] = mapped_column(
        String(50), unique=True, nullable=False, index=True, default=generate_accession_number
    )
    modality: Mapped[Modality] = mapped_column(Enum(Modality), nullable=False)
    procedure_code: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    procedure_description: Mapped[str] = mapped_column(String(500), nullable=False)
    body_part: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    laterality: Mapped[Optional[str]] = mapped_column(String(20), nullable=True, comment="L/R/B")
    priority: Mapped[OrderPriority] = mapped_column(
        Enum(OrderPriority), nullable=False, default=OrderPriority.routine
    )
    status: Mapped[OrderStatus] = mapped_column(
        Enum(OrderStatus), nullable=False, default=OrderStatus.requested, index=True
    )
    clinical_indication: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    special_instructions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    requested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    scheduled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    patient: Mapped["Patient"] = relationship("Patient", back_populates="imaging_orders")
    encounter: Mapped[Optional["Encounter"]] = relationship("Encounter", back_populates="imaging_orders")
    worklist_entry: Mapped[Optional["DicomWorklistEntry"]] = relationship(
        "DicomWorklistEntry", back_populates="order", uselist=False
    )
    study: Mapped[Optional["ImagingStudy"]] = relationship(
        "ImagingStudy", back_populates="order", uselist=False
    )
    appointment: Mapped[Optional["Appointment"]] = relationship(
        "Appointment", back_populates="order", uselist=False
    )

    def __repr__(self) -> str:
        return f"<ImagingOrder id={self.id} accession={self.accession_number} modality={self.modality}>"
