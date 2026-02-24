"""Initial schema - all tables

Revision ID: 0001
Revises:
Create Date: 2024-01-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── roles ──────────────────────────────────────────────────────────────────
    op.create_table(
        "roles",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(50), nullable=False),
        sa.Column("description", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )

    # ── users ──────────────────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("username", sa.String(100), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("role", sa.Enum("admin", "receptionist", "technician", "radiologist", "physician", name="userrole"), nullable=False),
        sa.Column("role_id", sa.Integer(), sa.ForeignKey("roles.id"), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, default=True),
        sa.Column("is_verified", sa.Boolean(), nullable=False, default=False),
        sa.Column("last_login", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_users_id", "users", ["id"])
    op.create_index("ix_users_username", "users", ["username"], unique=True)
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    # ── patients ───────────────────────────────────────────────────────────────
    op.create_table(
        "patients",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("mrn", sa.String(50), nullable=False),
        sa.Column("first_name", sa.String(100), nullable=False),
        sa.Column("last_name", sa.String(100), nullable=False),
        sa.Column("date_of_birth", sa.Date(), nullable=True),
        sa.Column("gender", sa.Enum("M", "F", "O", "U", name="gender"), nullable=True),
        sa.Column("dni", sa.String(30), nullable=True),
        sa.Column("blood_type", sa.Enum("A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "UNKNOWN", name="bloodtype"), nullable=True),
        sa.Column("allergies", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, default=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_patients_id", "patients", ["id"])
    op.create_index("ix_patients_mrn", "patients", ["mrn"], unique=True)
    op.create_index("ix_patients_dni", "patients", ["dni"], unique=True)

    # ── patient_contacts ───────────────────────────────────────────────────────
    op.create_table(
        "patient_contacts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("patient_id", sa.Integer(), sa.ForeignKey("patients.id", ondelete="CASCADE"), nullable=False),
        sa.Column("contact_type", sa.String(50), nullable=False),
        sa.Column("value", sa.String(255), nullable=False),
        sa.Column("label", sa.String(100), nullable=True),
        sa.Column("is_primary", sa.Boolean(), nullable=False, default=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_patient_contacts_patient_id", "patient_contacts", ["patient_id"])

    # ── encounters ─────────────────────────────────────────────────────────────
    op.create_table(
        "encounters",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("patient_id", sa.Integer(), sa.ForeignKey("patients.id"), nullable=False),
        sa.Column("encounter_type", sa.Enum("inpatient", "outpatient", "emergency", "observation", name="encountertype"), nullable=False),
        sa.Column("status", sa.Enum("planned", "arrived", "in-progress", "finished", "cancelled", name="encounterstatus"), nullable=False),
        sa.Column("admission_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("discharge_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("chief_complaint", sa.String(500), nullable=True),
        sa.Column("diagnosis", sa.Text(), nullable=True),
        sa.Column("treating_physician", sa.String(255), nullable=True),
        sa.Column("department", sa.String(100), nullable=True),
        sa.Column("ward", sa.String(100), nullable=True),
        sa.Column("bed_number", sa.String(20), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_encounters_id", "encounters", ["id"])
    op.create_index("ix_encounters_patient_id", "encounters", ["patient_id"])

    # ── imaging_orders ─────────────────────────────────────────────────────────
    op.create_table(
        "imaging_orders",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("patient_id", sa.Integer(), sa.ForeignKey("patients.id"), nullable=False),
        sa.Column("encounter_id", sa.Integer(), sa.ForeignKey("encounters.id"), nullable=True),
        sa.Column("requesting_physician_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("accession_number", sa.String(50), nullable=False),
        sa.Column("modality", sa.Enum("CR", "CT", "MR", "US", "NM", "PT", "DX", "MG", "XA", "RF", "OT", name="modality"), nullable=False),
        sa.Column("procedure_code", sa.String(50), nullable=True),
        sa.Column("procedure_description", sa.String(500), nullable=False),
        sa.Column("body_part", sa.String(100), nullable=True),
        sa.Column("laterality", sa.String(20), nullable=True),
        sa.Column("priority", sa.Enum("ROUTINE", "URGENT", "STAT", "ASAP", name="orderpriority"), nullable=False),
        sa.Column("status", sa.Enum("REQUESTED", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "ON_HOLD", name="orderstatus"), nullable=False),
        sa.Column("clinical_indication", sa.Text(), nullable=True),
        sa.Column("special_instructions", sa.Text(), nullable=True),
        sa.Column("requested_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_imaging_orders_id", "imaging_orders", ["id"])
    op.create_index("ix_imaging_orders_patient_id", "imaging_orders", ["patient_id"])
    op.create_index("ix_imaging_orders_accession_number", "imaging_orders", ["accession_number"], unique=True)
    op.create_index("ix_imaging_orders_status", "imaging_orders", ["status"])

    # ── dicom_worklist_entries ─────────────────────────────────────────────────
    op.create_table(
        "dicom_worklist_entries",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("order_id", sa.Integer(), sa.ForeignKey("imaging_orders.id"), nullable=False),
        sa.Column("accession_number", sa.String(50), nullable=False),
        sa.Column("patient_id_dicom", sa.String(50), nullable=False),
        sa.Column("patient_name_dicom", sa.String(255), nullable=False),
        sa.Column("patient_dob", sa.String(10), nullable=True),
        sa.Column("patient_sex", sa.String(1), nullable=True),
        sa.Column("modality", sa.String(10), nullable=False),
        sa.Column("scheduled_datetime", sa.DateTime(timezone=True), nullable=False),
        sa.Column("scheduled_station_ae_title", sa.String(50), nullable=True),
        sa.Column("scheduled_station_name", sa.String(100), nullable=True),
        sa.Column("procedure_description", sa.String(500), nullable=False),
        sa.Column("procedure_code", sa.String(50), nullable=True),
        sa.Column("requested_procedure_id", sa.String(50), nullable=True),
        sa.Column("referring_physician", sa.String(255), nullable=True),
        sa.Column("status", sa.Enum("ACTIVE", "COMPLETED", "CANCELLED", name="workliststatus"), nullable=False),
        sa.Column("wl_file_path", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("order_id"),
        sa.UniqueConstraint("accession_number"),
    )
    op.create_index("ix_dicom_worklist_entries_id", "dicom_worklist_entries", ["id"])
    op.create_index("ix_dicom_worklist_entries_status", "dicom_worklist_entries", ["status"])

    # ── imaging_studies ────────────────────────────────────────────────────────
    op.create_table(
        "imaging_studies",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("order_id", sa.Integer(), sa.ForeignKey("imaging_orders.id"), nullable=True),
        sa.Column("study_instance_uid", sa.String(255), nullable=False),
        sa.Column("orthanc_study_id", sa.String(100), nullable=True),
        sa.Column("series_count", sa.Integer(), nullable=False, default=0),
        sa.Column("instances_count", sa.Integer(), nullable=False, default=0),
        sa.Column("modality", sa.String(10), nullable=True),
        sa.Column("study_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("study_description", sa.String(500), nullable=True),
        sa.Column("station_name", sa.String(100), nullable=True),
        sa.Column("status", sa.Enum("PENDING", "RECEIVED", "PROCESSING", "AVAILABLE", "ERROR", name="studystatus"), nullable=False),
        sa.Column("orthanc_url", sa.String(500), nullable=True),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("study_instance_uid"),
        sa.UniqueConstraint("orthanc_study_id"),
    )
    op.create_index("ix_imaging_studies_id", "imaging_studies", ["id"])
    op.create_index("ix_imaging_studies_order_id", "imaging_studies", ["order_id"], unique=True)
    op.create_index("ix_imaging_studies_status", "imaging_studies", ["status"])

    # ── radiology_reports ──────────────────────────────────────────────────────
    op.create_table(
        "radiology_reports",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("study_id", sa.Integer(), sa.ForeignKey("imaging_studies.id"), nullable=False),
        sa.Column("radiologist_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("status", sa.Enum("draft", "preliminary", "final", "amended", "cancelled", name="reportstatus"), nullable=False),
        sa.Column("findings", sa.Text(), nullable=True),
        sa.Column("impression", sa.Text(), nullable=True),
        sa.Column("recommendation", sa.Text(), nullable=True),
        sa.Column("technique", sa.Text(), nullable=True),
        sa.Column("clinical_info", sa.Text(), nullable=True),
        sa.Column("signature_hash", sa.String(255), nullable=True),
        sa.Column("signed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("signed_by", sa.String(255), nullable=True),
        sa.Column("pdf_path", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("study_id"),
    )
    op.create_index("ix_radiology_reports_id", "radiology_reports", ["id"])
    op.create_index("ix_radiology_reports_radiologist_id", "radiology_reports", ["radiologist_id"])
    op.create_index("ix_radiology_reports_status", "radiology_reports", ["status"])

    # ── report_versions ────────────────────────────────────────────────────────
    op.create_table(
        "report_versions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("report_id", sa.Integer(), sa.ForeignKey("radiology_reports.id", ondelete="CASCADE"), nullable=False),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("findings", sa.Text(), nullable=True),
        sa.Column("impression", sa.Text(), nullable=True),
        sa.Column("recommendation", sa.Text(), nullable=True),
        sa.Column("modified_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_report_versions_report_id", "report_versions", ["report_id"])

    # ── resources ──────────────────────────────────────────────────────────────
    op.create_table(
        "resources",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("resource_type", sa.Enum("room", "equipment", "staff", name="resourcetype"), nullable=False),
        sa.Column("modality", sa.String(10), nullable=True),
        sa.Column("ae_title", sa.String(50), nullable=True),
        sa.Column("location", sa.String(100), nullable=True),
        sa.Column("description", sa.String(500), nullable=True),
        sa.Column("is_available", sa.Boolean(), nullable=False, default=True),
        sa.Column("capacity", sa.Integer(), nullable=False, default=1),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_resources_id", "resources", ["id"])

    # ── appointments ───────────────────────────────────────────────────────────
    op.create_table(
        "appointments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("patient_id", sa.Integer(), sa.ForeignKey("patients.id"), nullable=False),
        sa.Column("order_id", sa.Integer(), sa.ForeignKey("imaging_orders.id"), nullable=True),
        sa.Column("resource_id", sa.Integer(), sa.ForeignKey("resources.id"), nullable=True),
        sa.Column("status", sa.Enum("proposed", "pending", "booked", "arrived", "fulfilled", "cancelled", "noshow", "entered-in-error", name="appointmentstatus"), nullable=False),
        sa.Column("start_datetime", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_datetime", sa.DateTime(timezone=True), nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("reminder_sent", sa.Boolean(), nullable=False, default=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("order_id"),
    )
    op.create_index("ix_appointments_id", "appointments", ["id"])
    op.create_index("ix_appointments_patient_id", "appointments", ["patient_id"])
    op.create_index("ix_appointments_resource_id", "appointments", ["resource_id"])
    op.create_index("ix_appointments_status", "appointments", ["status"])

    # ── hl7_messages ───────────────────────────────────────────────────────────
    op.create_table(
        "hl7_messages",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("message_type", sa.String(20), nullable=False),
        sa.Column("direction", sa.Enum("INBOUND", "OUTBOUND", name="hl7direction"), nullable=False),
        sa.Column("sending_facility", sa.String(50), nullable=True),
        sa.Column("receiving_facility", sa.String(50), nullable=True),
        sa.Column("message_control_id", sa.String(50), nullable=True),
        sa.Column("raw_message", sa.Text(), nullable=False),
        sa.Column("status", sa.Enum("PENDING", "SENT", "RECEIVED", "ACKED", "ERROR", "REJECTED", name="hl7status"), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("retry_count", sa.Integer(), nullable=False, default=0),
        sa.Column("patient_id", sa.Integer(), nullable=True),
        sa.Column("order_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("message_control_id"),
    )
    op.create_index("ix_hl7_messages_id", "hl7_messages", ["id"])
    op.create_index("ix_hl7_messages_message_type", "hl7_messages", ["message_type"])
    op.create_index("ix_hl7_messages_direction", "hl7_messages", ["direction"])
    op.create_index("ix_hl7_messages_status", "hl7_messages", ["status"])

    # ── audit_logs ─────────────────────────────────────────────────────────────
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("resource_type", sa.String(50), nullable=False),
        sa.Column("resource_id", sa.String(50), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("user_agent", sa.String(500), nullable=True),
        sa.Column("request_id", sa.String(50), nullable=True),
        sa.Column("status_code", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_audit_logs_id", "audit_logs", ["id"])
    op.create_index("ix_audit_logs_user_id", "audit_logs", ["user_id"])
    op.create_index("ix_audit_logs_action", "audit_logs", ["action"])
    op.create_index("ix_audit_logs_resource_type", "audit_logs", ["resource_type"])
    op.create_index("ix_audit_logs_created_at", "audit_logs", ["created_at"])


def downgrade() -> None:
    op.drop_table("audit_logs")
    op.drop_table("hl7_messages")
    op.drop_table("appointments")
    op.drop_table("resources")
    op.drop_table("report_versions")
    op.drop_table("radiology_reports")
    op.drop_table("imaging_studies")
    op.drop_table("dicom_worklist_entries")
    op.drop_table("imaging_orders")
    op.drop_table("encounters")
    op.drop_table("patient_contacts")
    op.drop_table("patients")
    op.drop_table("users")
    op.drop_table("roles")

    # Drop enums
    for enum_name in [
        "userrole", "gender", "bloodtype", "encountertype", "encounterstatus",
        "modality", "orderpriority", "orderstatus", "workliststatus", "studystatus",
        "reportstatus", "resourcetype", "appointmentstatus", "hl7direction", "hl7status"
    ]:
        op.execute(f"DROP TYPE IF EXISTS {enum_name}")
