from __future__ import annotations

import enum
from datetime import date, datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base, enum_values

if TYPE_CHECKING:
    from app.models.encounter import Encounter
    from app.models.order import ImagingOrder
    from app.models.schedule import Appointment


class Gender(str, enum.Enum):
    male = "M"
    female = "F"
    other = "O"
    unknown = "U"


class BloodType(str, enum.Enum):
    a_pos = "A+"
    a_neg = "A-"
    b_pos = "B+"
    b_neg = "B-"
    ab_pos = "AB+"
    ab_neg = "AB-"
    o_pos = "O+"
    o_neg = "O-"
    unknown = "UNKNOWN"


class Patient(Base):
    __tablename__ = "patients"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    mrn: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True, comment="Medical Record Number")
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    date_of_birth: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    gender: Mapped[Optional[Gender]] = mapped_column(Enum(Gender, values_callable=enum_values), nullable=True)
    dni: Mapped[Optional[str]] = mapped_column(String(30), unique=True, nullable=True, index=True, comment="National ID")
    blood_type: Mapped[Optional[BloodType]] = mapped_column(Enum(BloodType, values_callable=enum_values), nullable=True)
    allergies: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    contacts: Mapped[List["PatientContact"]] = relationship(
        "PatientContact", back_populates="patient", cascade="all, delete-orphan"
    )
    encounters: Mapped[List["Encounter"]] = relationship("Encounter", back_populates="patient")
    imaging_orders: Mapped[List["ImagingOrder"]] = relationship("ImagingOrder", back_populates="patient")
    appointments: Mapped[List["Appointment"]] = relationship("Appointment", back_populates="patient")

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"

    def __repr__(self) -> str:
        return f"<Patient id={self.id} mrn={self.mrn} name={self.full_name}>"


class PatientContact(Base):
    __tablename__ = "patient_contacts"

    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    contact_type: Mapped[str] = mapped_column(String(50), nullable=False, comment="phone/email/address/emergency")
    value: Mapped[str] = mapped_column(String(255), nullable=False)
    label: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, comment="home/work/mobile")
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    patient: Mapped["Patient"] = relationship("Patient", back_populates="contacts")

    def __repr__(self) -> str:
        return f"<PatientContact type={self.contact_type} value={self.value}>"
