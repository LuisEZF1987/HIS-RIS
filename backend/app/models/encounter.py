from __future__ import annotations

import enum
from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base, enum_values

if TYPE_CHECKING:
    from app.models.patient import Patient
    from app.models.order import ImagingOrder


class EncounterType(str, enum.Enum):
    inpatient = "inpatient"
    outpatient = "outpatient"
    emergency = "emergency"
    observation = "observation"


class EncounterStatus(str, enum.Enum):
    planned = "planned"
    arrived = "arrived"
    in_progress = "in-progress"
    finished = "finished"
    cancelled = "cancelled"


class Encounter(Base):
    __tablename__ = "encounters"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), nullable=False, index=True)
    encounter_type: Mapped[EncounterType] = mapped_column(
        Enum(EncounterType, values_callable=enum_values), nullable=False, default=EncounterType.outpatient
    )
    status: Mapped[EncounterStatus] = mapped_column(
        Enum(EncounterStatus, values_callable=enum_values), nullable=False, default=EncounterStatus.planned
    )
    admission_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    discharge_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    chief_complaint: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    diagnosis: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    treating_physician: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    department: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    ward: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    bed_number: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    patient: Mapped["Patient"] = relationship("Patient", back_populates="encounters")
    imaging_orders: Mapped[List["ImagingOrder"]] = relationship("ImagingOrder", back_populates="encounter")

    def __repr__(self) -> str:
        return f"<Encounter id={self.id} patient_id={self.patient_id} type={self.encounter_type}>"
