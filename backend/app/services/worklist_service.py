from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dicom_utils import build_mwl_dataset, delete_worklist_file, write_worklist_file
from app.models.order import ImagingOrder
from app.models.patient import Patient
from app.models.worklist import DicomWorklistEntry, WorklistStatus

logger = logging.getLogger(__name__)


class WorklistService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_worklist_entry(self, order: ImagingOrder, patient: Patient) -> DicomWorklistEntry:
        dob_str = patient.date_of_birth.strftime("%Y%m%d") if patient.date_of_birth else None
        sex_str = patient.gender.value if patient.gender else None

        # DICOM name format: LAST^FIRST
        patient_name_dicom = f"{patient.last_name.upper()}^{patient.first_name.upper()}"

        scheduled_dt = order.scheduled_at or datetime.now(timezone.utc)

        entry = DicomWorklistEntry(
            order_id=order.id,
            accession_number=order.accession_number,
            patient_id_dicom=patient.mrn,
            patient_name_dicom=patient_name_dicom,
            patient_dob=dob_str,
            patient_sex=sex_str,
            modality=order.modality.value,
            scheduled_datetime=scheduled_dt,
            procedure_description=order.procedure_description,
            procedure_code=order.procedure_code,
            requested_procedure_id=order.accession_number,
            status=WorklistStatus.active,
        )
        self.db.add(entry)
        await self.db.flush()

        # Write DICOM .wl file
        try:
            ds = build_mwl_dataset(
                accession_number=order.accession_number,
                patient_id=patient.mrn,
                patient_name=patient_name_dicom,
                patient_dob=dob_str,
                patient_sex=sex_str,
                modality=order.modality.value,
                scheduled_datetime=scheduled_dt,
                procedure_description=order.procedure_description,
                procedure_code=order.procedure_code,
            )
            filepath = write_worklist_file(ds, order.accession_number)
            entry.wl_file_path = filepath
            await self.db.flush()
            logger.info(f"Worklist file written: {filepath}")
        except Exception as e:
            logger.error(f"Failed to write worklist file for {order.accession_number}: {e}")

        return entry

    async def complete_worklist_entry(self, accession_number: str) -> None:
        result = await self.db.execute(
            select(DicomWorklistEntry).where(DicomWorklistEntry.accession_number == accession_number)
        )
        entry = result.scalar_one_or_none()
        if entry:
            entry.status = WorklistStatus.completed
            await self.db.flush()
            # Remove .wl file
            delete_worklist_file(accession_number)

    async def get_active_worklist(self, modality: Optional[str] = None) -> List[DicomWorklistEntry]:
        stmt = select(DicomWorklistEntry).where(DicomWorklistEntry.status == WorklistStatus.active)
        if modality:
            stmt = stmt.where(DicomWorklistEntry.modality == modality)
        stmt = stmt.order_by(DicomWorklistEntry.scheduled_datetime)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
