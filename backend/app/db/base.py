from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


# Import all models here so Alembic can detect them
from app.models.user import User, Role  # noqa: F401, E402
from app.models.patient import Patient, PatientContact  # noqa: F401, E402
from app.models.encounter import Encounter  # noqa: F401, E402
from app.models.order import ImagingOrder  # noqa: F401, E402
from app.models.study import ImagingStudy  # noqa: F401, E402
from app.models.report import RadiologyReport, ReportVersion  # noqa: F401, E402
from app.models.schedule import Appointment, Resource  # noqa: F401, E402
from app.models.worklist import DicomWorklistEntry  # noqa: F401, E402
from app.models.hl7_message import HL7Message  # noqa: F401, E402
from app.models.audit import AuditLog  # noqa: F401, E402
