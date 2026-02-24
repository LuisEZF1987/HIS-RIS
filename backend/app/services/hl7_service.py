from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.hl7_parser import build_adt_a01, build_adt_a03, build_orm_o01, build_oru_r01
from app.models.hl7_message import HL7Direction, HL7Message, HL7Status

logger = logging.getLogger(__name__)


class HL7Service:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _store_message(
        self,
        message_type: str,
        direction: HL7Direction,
        raw_message: str,
        patient_id: Optional[int] = None,
        order_id: Optional[int] = None,
    ) -> HL7Message:
        msg = HL7Message(
            message_type=message_type,
            direction=direction,
            raw_message=raw_message,
            status=HL7Status.sent if direction == HL7Direction.outbound else HL7Status.received,
            patient_id=patient_id,
            order_id=order_id,
        )
        self.db.add(msg)
        await self.db.flush()
        return msg

    async def send_adt_a01(self, patient, encounter) -> HL7Message:
        dob = patient.date_of_birth.strftime("%Y%m%d") if patient.date_of_birth else None
        sex = patient.gender.value if patient.gender else None
        raw = build_adt_a01(
            patient_id=patient.mrn,
            patient_name=f"{patient.last_name}^{patient.first_name}",
            dob=dob,
            sex=sex,
            encounter_id=str(encounter.id),
            admission_datetime=encounter.admission_date,
        )
        return await self._store_message("ADT^A01", HL7Direction.outbound, raw, patient_id=patient.id)

    async def send_adt_a03(self, patient, encounter) -> HL7Message:
        raw = build_adt_a03(
            patient_id=patient.mrn,
            encounter_id=str(encounter.id),
            discharge_datetime=encounter.discharge_date,
        )
        return await self._store_message("ADT^A03", HL7Direction.outbound, raw, patient_id=patient.id)

    async def send_orm_o01(self, patient, order) -> HL7Message:
        raw = build_orm_o01(
            patient_id=patient.mrn,
            patient_name=f"{patient.last_name}^{patient.first_name}",
            accession_number=order.accession_number,
            modality=order.modality.value,
            procedure_description=order.procedure_description,
            priority=order.priority.value[0],  # R/U/S
            order_datetime=order.requested_at,
        )
        return await self._store_message("ORM^O01", HL7Direction.outbound, raw, patient_id=patient.id, order_id=order.id)

    async def send_oru_r01(self, patient, order, report) -> HL7Message:
        report_text = f"Findings: {report.findings or ''}\nImpression: {report.impression or ''}"
        raw = build_oru_r01(
            patient_id=patient.mrn,
            patient_name=f"{patient.last_name}^{patient.first_name}",
            accession_number=order.accession_number,
            report_text=report_text,
            report_datetime=report.signed_at,
        )
        return await self._store_message("ORU^R01", HL7Direction.outbound, raw, patient_id=patient.id, order_id=order.id)
