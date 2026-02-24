# This file imports Base + all models so Alembic autogenerate can detect them.
# Do NOT import this file from inside model files (circular import).
from app.db.base_class import Base  # noqa: F401

# Import all models to register them with Base.metadata
from app.models.user import User, Role  # noqa: F401
from app.models.patient import Patient, PatientContact  # noqa: F401
from app.models.encounter import Encounter  # noqa: F401
from app.models.order import ImagingOrder  # noqa: F401
from app.models.study import ImagingStudy  # noqa: F401
from app.models.report import RadiologyReport, ReportVersion  # noqa: F401
from app.models.schedule import Appointment, Resource  # noqa: F401
from app.models.worklist import DicomWorklistEntry  # noqa: F401
from app.models.hl7_message import HL7Message  # noqa: F401
from app.models.audit import AuditLog  # noqa: F401
