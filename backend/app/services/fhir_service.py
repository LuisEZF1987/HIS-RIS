from __future__ import annotations

import logging
from typing import Any, Optional

logger = logging.getLogger(__name__)


class FHIRService:
    """Maps SQLAlchemy models to FHIR R4 resources."""

    def patient_to_fhir(self, patient) -> dict[str, Any]:
        resource = {
            "resourceType": "Patient",
            "id": str(patient.id),
            "identifier": [
                {"system": "urn:oid:mrn", "value": patient.mrn},
            ],
            "name": [
                {
                    "use": "official",
                    "family": patient.last_name,
                    "given": [patient.first_name],
                }
            ],
            "active": patient.is_active,
        }
        if patient.date_of_birth:
            resource["birthDate"] = patient.date_of_birth.isoformat()
        if patient.gender:
            gender_map = {"M": "male", "F": "female", "O": "other", "U": "unknown"}
            resource["gender"] = gender_map.get(patient.gender.value, "unknown")
        if patient.dni:
            resource["identifier"].append({"system": "urn:oid:dni", "value": patient.dni})

        telecom = []
        for c in (patient.contacts or []):
            if c.contact_type == "phone":
                telecom.append({"system": "phone", "value": c.value, "use": c.label or "home"})
            elif c.contact_type == "email":
                telecom.append({"system": "email", "value": c.value})
        if telecom:
            resource["telecom"] = telecom

        return resource

    def order_to_fhir(self, order, patient) -> dict[str, Any]:
        return {
            "resourceType": "ServiceRequest",
            "id": str(order.id),
            "status": self._order_status_to_fhir(order.status.value),
            "intent": "order",
            "category": [{"coding": [{"system": "http://snomed.info/sct", "code": "363679005", "display": "Imaging"}]}],
            "code": {
                "coding": [{"display": order.procedure_description}],
                "text": order.procedure_description,
            },
            "subject": {"reference": f"Patient/{patient.id}"},
            "identifier": [{"value": order.accession_number}],
            "priority": order.priority.value.lower(),
            "authoredOn": order.requested_at.isoformat(),
        }

    def study_to_fhir(self, study, order, patient) -> dict[str, Any]:
        return {
            "resourceType": "ImagingStudy",
            "id": str(study.id),
            "identifier": [{"system": "urn:dicom:uid", "value": f"urn:oid:{study.study_instance_uid}"}],
            "status": "available" if study.status.value == "AVAILABLE" else "registered",
            "subject": {"reference": f"Patient/{patient.id}"},
            "basedOn": [{"reference": f"ServiceRequest/{order.id}"}],
            "numberOfSeries": study.series_count,
            "numberOfInstances": study.instances_count,
            "started": study.study_date.isoformat() if study.study_date else None,
        }

    def report_to_fhir(self, report, study, patient) -> dict[str, Any]:
        status_map = {
            "draft": "partial", "preliminary": "preliminary",
            "final": "final", "amended": "amended", "cancelled": "cancelled"
        }
        resource = {
            "resourceType": "DiagnosticReport",
            "id": str(report.id),
            "status": status_map.get(report.status.value, "unknown"),
            "category": [{"coding": [{"system": "http://loinc.org", "code": "18748-4", "display": "Diagnostic imaging study"}]}],
            "subject": {"reference": f"Patient/{patient.id}"},
            "imagingStudy": [{"reference": f"ImagingStudy/{study.id}"}],
            "issued": report.updated_at.isoformat(),
        }
        result = []
        if report.findings:
            result.append({
                "resourceType": "Observation",
                "status": "final",
                "code": {"text": "Findings"},
                "valueString": report.findings,
            })
        if report.impression:
            result.append({
                "resourceType": "Observation",
                "status": "final",
                "code": {"text": "Impression"},
                "valueString": report.impression,
            })
        if result:
            resource["result"] = result
        if report.status.value == "final" and report.signed_by:
            resource["performer"] = [{"display": report.signed_by}]
        return resource

    def _order_status_to_fhir(self, status: str) -> str:
        mapping = {
            "REQUESTED": "active", "SCHEDULED": "active",
            "IN_PROGRESS": "active", "COMPLETED": "completed",
            "CANCELLED": "revoked", "ON_HOLD": "on-hold",
        }
        return mapping.get(status, "unknown")
