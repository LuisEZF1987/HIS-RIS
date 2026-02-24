from __future__ import annotations

import enum
from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base, enum_values

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.study import ImagingStudy


class ReportStatus(str, enum.Enum):
    draft = "draft"
    preliminary = "preliminary"
    final = "final"
    amended = "amended"
    cancelled = "cancelled"


class RadiologyReport(Base):
    __tablename__ = "radiology_reports"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    study_id: Mapped[int] = mapped_column(ForeignKey("imaging_studies.id"), unique=True, nullable=False, index=True)
    radiologist_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    status: Mapped[ReportStatus] = mapped_column(
        Enum(ReportStatus, values_callable=enum_values), nullable=False, default=ReportStatus.draft, index=True
    )
    findings: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    impression: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    recommendation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    technique: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    clinical_info: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Digital signature
    signature_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    signed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    signed_by: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    # PDF storage
    pdf_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    study: Mapped["ImagingStudy"] = relationship("ImagingStudy", back_populates="report")
    radiologist: Mapped["User"] = relationship("User", back_populates="reports")
    versions: Mapped[List["ReportVersion"]] = relationship(
        "ReportVersion", back_populates="report", cascade="all, delete-orphan", order_by="ReportVersion.version_number"
    )

    def __repr__(self) -> str:
        return f"<RadiologyReport id={self.id} status={self.status}>"


class ReportVersion(Base):
    __tablename__ = "report_versions"

    id: Mapped[int] = mapped_column(primary_key=True)
    report_id: Mapped[int] = mapped_column(ForeignKey("radiology_reports.id", ondelete="CASCADE"), nullable=False, index=True)
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    findings: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    impression: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    recommendation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    modified_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    report: Mapped["RadiologyReport"] = relationship("RadiologyReport", back_populates="versions")

    def __repr__(self) -> str:
        return f"<ReportVersion report_id={self.report_id} v={self.version_number}>"
