from __future__ import annotations

import enum
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base, enum_values

if TYPE_CHECKING:
    from app.models.order import ImagingOrder
    from app.models.report import RadiologyReport


class StudyStatus(str, enum.Enum):
    pending = "PENDING"
    received = "RECEIVED"
    processing = "PROCESSING"
    available = "AVAILABLE"
    error = "ERROR"


class ImagingStudy(Base):
    __tablename__ = "imaging_studies"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    order_id: Mapped[Optional[int]] = mapped_column(ForeignKey("imaging_orders.id"), unique=True, nullable=True, index=True)
    study_instance_uid: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    orthanc_study_id: Mapped[Optional[str]] = mapped_column(String(100), unique=True, nullable=True, index=True)
    series_count: Mapped[int] = mapped_column(Integer, default=0)
    instances_count: Mapped[int] = mapped_column(Integer, default=0)
    modality: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    study_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    study_description: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    station_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    status: Mapped[StudyStatus] = mapped_column(
        Enum(StudyStatus, values_callable=enum_values), nullable=False, default=StudyStatus.pending, index=True
    )
    orthanc_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    received_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    order: Mapped["ImagingOrder"] = relationship("ImagingOrder", back_populates="study")
    report: Mapped[Optional["RadiologyReport"]] = relationship(
        "RadiologyReport", back_populates="study", uselist=False
    )

    def __repr__(self) -> str:
        return f"<ImagingStudy id={self.id} uid={self.study_instance_uid}>"
