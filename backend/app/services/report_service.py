from __future__ import annotations

import io
import logging
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import BadRequestError, ForbiddenError, NotFoundError
from app.core.security import compute_report_signature, verify_password
from app.models.order import ImagingOrder
from app.models.report import RadiologyReport, ReportStatus, ReportVersion
from app.models.study import ImagingStudy
from app.models.user import User
from app.schemas.report import ReportCreate, ReportUpdate

logger = logging.getLogger(__name__)


class ReportService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_report(self, data: ReportCreate, radiologist: User) -> RadiologyReport:
        # Verify study exists
        result = await self.db.execute(
            select(ImagingStudy).where(ImagingStudy.id == data.study_id)
        )
        study = result.scalar_one_or_none()
        if not study:
            raise NotFoundError(f"Study {data.study_id} not found")

        # Check no existing report
        existing = await self.db.execute(
            select(RadiologyReport).where(RadiologyReport.study_id == data.study_id)
        )
        if existing.scalar_one_or_none():
            raise BadRequestError(f"Report already exists for study {data.study_id}")

        report = RadiologyReport(
            study_id=data.study_id,
            radiologist_id=radiologist.id,
            status=ReportStatus.draft,
            findings=data.findings,
            impression=data.impression,
            recommendation=data.recommendation,
            technique=data.technique,
            clinical_info=data.clinical_info,
        )
        self.db.add(report)
        await self.db.flush()
        return await self.get_by_id(report.id)

    async def get_by_id(self, report_id: int) -> RadiologyReport:
        result = await self.db.execute(
            select(RadiologyReport)
            .options(selectinload(RadiologyReport.versions))
            .where(RadiologyReport.id == report_id)
        )
        report = result.scalar_one_or_none()
        if not report:
            raise NotFoundError(f"Report {report_id} not found")
        return report

    async def update_report(self, report_id: int, data: ReportUpdate, user: User) -> RadiologyReport:
        report = await self.get_by_id(report_id)

        if report.status in (ReportStatus.final, ReportStatus.amended):
            raise BadRequestError("Cannot edit a signed report. Create amendment instead.")

        # Save version before update
        version_number = len(report.versions) + 1
        version = ReportVersion(
            report_id=report.id,
            version_number=version_number,
            findings=report.findings,
            impression=report.impression,
            recommendation=report.recommendation,
            modified_by_id=user.id,
        )
        self.db.add(version)

        for field, value in data.model_dump(exclude_none=True).items():
            setattr(report, field, value)
        report.status = ReportStatus.preliminary

        await self.db.flush()
        return await self.get_by_id(report.id)

    async def sign_report(self, report_id: int, password: str, user: User) -> RadiologyReport:
        from app.models.user import UserRole

        # Re-authenticate
        if not verify_password(password, user.hashed_password):
            raise ForbiddenError("Contraseña incorrecta. Ingrese su contraseña de inicio de sesión.")

        report = await self.get_by_id(report_id)

        # Admin can sign any report; radiologists can only sign their own
        if user.role != UserRole.admin and report.radiologist_id != user.id:
            raise ForbiddenError("Solo el radiólogo asignado o un administrador puede firmar este informe")

        if report.status == ReportStatus.final:
            raise BadRequestError("Report is already signed")

        if not report.impression:
            raise BadRequestError("Report must have an impression before signing")

        now = datetime.now(timezone.utc)
        content = f"{report.findings or ''}{report.impression or ''}"
        report.signature_hash = compute_report_signature(report.id, content, user.id, now)
        report.signed_at = now
        report.signed_by = user.full_name
        report.status = ReportStatus.final

        await self.db.flush()
        return await self.get_by_id(report.id)

    async def generate_pdf(self, report_id: int) -> bytes:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import cm
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable
        from reportlab.lib import colors

        report = await self.get_by_id(report_id)

        # Load study and patient info
        result = await self.db.execute(
            select(ImagingStudy)
            .options(selectinload(ImagingStudy.order).selectinload(ImagingOrder.patient))
            .where(ImagingStudy.id == report.study_id)
        )
        study = result.scalar_one_or_none()

        buf = io.BytesIO()
        doc = SimpleDocTemplate(buf, pagesize=A4, rightMargin=2*cm, leftMargin=2*cm, topMargin=2*cm, bottomMargin=2*cm)
        styles = getSampleStyleSheet()

        story = []
        story.append(Paragraph("INFORME RADIOLÓGICO", styles["Title"]))
        story.append(HRFlowable(width="100%", thickness=1, color=colors.black))
        story.append(Spacer(1, 0.3*cm))

        if study and study.order and study.order.patient:
            p = study.order.patient
            story.append(Paragraph(f"<b>Paciente:</b> {p.full_name} | MRN: {p.mrn}", styles["Normal"]))
            story.append(Paragraph(f"<b>Modalidad:</b> {study.modality or 'N/A'} | Acceso: {study.order.accession_number}", styles["Normal"]))

        story.append(Spacer(1, 0.3*cm))

        if report.technique:
            story.append(Paragraph("<b>Técnica:</b>", styles["Heading3"]))
            story.append(Paragraph(report.technique, styles["Normal"]))

        if report.findings:
            story.append(Paragraph("<b>Hallazgos:</b>", styles["Heading3"]))
            story.append(Paragraph(report.findings.replace("\n", "<br/>"), styles["Normal"]))

        if report.impression:
            story.append(Paragraph("<b>Impresión Diagnóstica:</b>", styles["Heading3"]))
            story.append(Paragraph(report.impression.replace("\n", "<br/>"), styles["Normal"]))

        if report.recommendation:
            story.append(Paragraph("<b>Recomendaciones:</b>", styles["Heading3"]))
            story.append(Paragraph(report.recommendation.replace("\n", "<br/>"), styles["Normal"]))

        if report.status == ReportStatus.final:
            story.append(Spacer(1, 0.5*cm))
            story.append(HRFlowable(width="100%", thickness=0.5, color=colors.grey))
            story.append(Paragraph(f"<b>Firmado por:</b> {report.signed_by}", styles["Normal"]))
            story.append(Paragraph(f"<b>Fecha firma:</b> {report.signed_at}", styles["Normal"]))
            story.append(Paragraph(f"<b>Hash verificación:</b> {report.signature_hash[:32]}...", styles["Normal"]))

        doc.build(story)
        return buf.getvalue()
