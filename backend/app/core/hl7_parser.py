from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from app.config import get_settings

settings = get_settings()


def build_adt_a01(
    patient_id: str,
    patient_name: str,
    dob: Optional[str],
    sex: Optional[str],
    encounter_id: str,
    admission_datetime: Optional[datetime] = None,
) -> str:
    now = admission_datetime or datetime.now()
    msg_dt = now.strftime("%Y%m%d%H%M%S")
    msg_id = uuid.uuid4().hex[:10].upper()

    segments = [
        f"MSH|^~\\&|{settings.hl7_sending_facility}||{settings.hl7_receiving_facility}||{msg_dt}||ADT^A01|{msg_id}|P|2.5",
        f"EVN|A01|{msg_dt}",
        f"PID|1||{patient_id}|||{patient_name}||{dob or ''}|{sex or ''}",
        f"PV1|1|I|||||||||||||||||{encounter_id}",
    ]
    return "\r".join(segments) + "\r"


def build_adt_a03(
    patient_id: str,
    encounter_id: str,
    discharge_datetime: Optional[datetime] = None,
) -> str:
    now = discharge_datetime or datetime.now()
    msg_dt = now.strftime("%Y%m%d%H%M%S")
    msg_id = uuid.uuid4().hex[:10].upper()

    segments = [
        f"MSH|^~\\&|{settings.hl7_sending_facility}||{settings.hl7_receiving_facility}||{msg_dt}||ADT^A03|{msg_id}|P|2.5",
        f"EVN|A03|{msg_dt}",
        f"PID|1||{patient_id}",
        f"PV1|1|I|||||||||||||||||{encounter_id}",
    ]
    return "\r".join(segments) + "\r"


def build_orm_o01(
    patient_id: str,
    patient_name: str,
    accession_number: str,
    modality: str,
    procedure_description: str,
    priority: str = "R",
    order_datetime: Optional[datetime] = None,
) -> str:
    now = order_datetime or datetime.now()
    msg_dt = now.strftime("%Y%m%d%H%M%S")
    msg_id = uuid.uuid4().hex[:10].upper()

    segments = [
        f"MSH|^~\\&|{settings.hl7_sending_facility}||{settings.hl7_receiving_facility}||{msg_dt}||ORM^O01|{msg_id}|P|2.5",
        f"PID|1||{patient_id}|||{patient_name}",
        f"ORC|NW|{accession_number}||||||{priority}",
        f"OBR|1|{accession_number}||{procedure_description}|||{msg_dt}|||||||||||||||{modality}",
    ]
    return "\r".join(segments) + "\r"


def build_oru_r01(
    patient_id: str,
    patient_name: str,
    accession_number: str,
    report_text: str,
    report_datetime: Optional[datetime] = None,
) -> str:
    now = report_datetime or datetime.now()
    msg_dt = now.strftime("%Y%m%d%H%M%S")
    msg_id = uuid.uuid4().hex[:10].upper()
    # Escape pipe chars in report
    safe_report = report_text.replace("|", "\\|").replace("\n", "\\X0D\\")

    segments = [
        f"MSH|^~\\&|{settings.hl7_sending_facility}||{settings.hl7_receiving_facility}||{msg_dt}||ORU^R01|{msg_id}|P|2.5",
        f"PID|1||{patient_id}|||{patient_name}",
        f"OBR|1|{accession_number}|||||||{msg_dt}",
        f"OBX|1|TX|REPORT||{safe_report}||||||F",
    ]
    return "\r".join(segments) + "\r"


def parse_hl7_message(raw: str) -> dict:
    segments = raw.strip().split("\r")
    result = {"segments": {}, "type": None}
    for seg in segments:
        if not seg.strip():
            continue
        fields = seg.split("|")
        seg_name = fields[0]
        if seg_name == "MSH":
            result["type"] = fields[8] if len(fields) > 8 else None
        result["segments"][seg_name] = fields
    return result
