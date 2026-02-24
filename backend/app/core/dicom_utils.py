from __future__ import annotations

import os
from datetime import datetime
from pathlib import Path
from typing import Optional

import pydicom
from pydicom.dataset import Dataset, FileMetaDataset
from pydicom.sequence import Sequence
from pydicom.uid import generate_uid

from app.config import get_settings

settings = get_settings()


def build_mwl_dataset(
    accession_number: str,
    patient_id: str,
    patient_name: str,
    patient_dob: Optional[str],
    patient_sex: Optional[str],
    modality: str,
    scheduled_datetime: datetime,
    procedure_description: str,
    scheduled_station_ae: Optional[str] = None,
    scheduled_station_name: Optional[str] = None,
    procedure_code: Optional[str] = None,
    requested_procedure_id: Optional[str] = None,
    referring_physician: Optional[str] = None,
) -> Dataset:
    ds = Dataset()

    # Patient Module
    ds.PatientID = patient_id
    ds.PatientName = patient_name
    if patient_dob:
        ds.PatientBirthDate = patient_dob
    if patient_sex:
        ds.PatientSex = patient_sex

    # Requested Procedure Module
    ds.AccessionNumber = accession_number
    ds.RequestedProcedureDescription = procedure_description
    ds.RequestedProcedureID = requested_procedure_id or accession_number
    if referring_physician:
        ds.ReferringPhysicianName = referring_physician

    # Scheduled Procedure Step Sequence
    sps = Dataset()
    sps.Modality = modality
    sps.ScheduledProcedureStepDescription = procedure_description
    sps.ScheduledStationAETitle = scheduled_station_ae or settings.institution_ae_title
    if scheduled_station_name:
        sps.ScheduledStationName = scheduled_station_name
    sps.ScheduledProcedureStepStartDate = scheduled_datetime.strftime("%Y%m%d")
    sps.ScheduledProcedureStepStartTime = scheduled_datetime.strftime("%H%M%S")
    sps.ScheduledProcedureStepStatus = "SCHEDULED"
    if procedure_code:
        sps.ScheduledProcedureStepID = procedure_code

    ds.ScheduledProcedureStepSequence = Sequence([sps])

    # Study instance UID
    ds.StudyInstanceUID = generate_uid()

    return ds


def write_worklist_file(ds: Dataset, accession_number: str) -> str:
    worklist_dir = Path(settings.worklist_dir)
    worklist_dir.mkdir(parents=True, exist_ok=True)

    filename = f"{accession_number}.wl"
    filepath = worklist_dir / filename

    # Create file with proper DICOM meta
    file_meta = FileMetaDataset()
    file_meta.MediaStorageSOPClassUID = "1.2.840.10008.5.1.4.31"  # Modality Worklist
    file_meta.MediaStorageSOPInstanceUID = generate_uid()
    file_meta.TransferSyntaxUID = pydicom.uid.ExplicitVRLittleEndian

    file_ds = pydicom.Dataset()
    file_ds.file_meta = file_meta
    file_ds.is_implicit_VR = False
    file_ds.is_little_endian = True
    file_ds.SOPClassUID = "1.2.840.10008.5.1.4.31"
    file_ds.SOPInstanceUID = file_meta.MediaStorageSOPInstanceUID

    # Copy fields
    for elem in ds:
        file_ds.add(elem)

    pydicom.dcmwrite(str(filepath), file_ds, write_like_original=False)
    return str(filepath)


def delete_worklist_file(accession_number: str) -> bool:
    filepath = Path(settings.worklist_dir) / f"{accession_number}.wl"
    if filepath.exists():
        filepath.unlink()
        return True
    return False
