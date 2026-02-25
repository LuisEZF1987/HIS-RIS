// ── Auth ──────────────────────────────────────────────────────────────────────
export interface LoginRequest {
  username: string
  password: string
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
}

export type UserRole = 'admin' | 'receptionist' | 'technician' | 'radiologist' | 'physician'

export interface User {
  id: number
  username: string
  email: string
  full_name: string
  role: UserRole
  is_active: boolean
  created_at: string
  last_login?: string
}

// ── Patients ──────────────────────────────────────────────────────────────────
export type Gender = 'M' | 'F' | 'O' | 'U'
export type BloodType = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-' | 'UNKNOWN'

export interface PatientContact {
  id: number
  contact_type: 'phone' | 'email' | 'address' | 'emergency'
  value: string
  label?: string
  is_primary: boolean
}

export interface Patient {
  id: number
  mrn: string
  first_name: string
  last_name: string
  full_name: string
  date_of_birth?: string
  gender?: Gender
  dni?: string
  blood_type?: BloodType
  allergies?: string
  is_active: boolean
  contacts: PatientContact[]
  created_at: string
}

export interface PatientListItem {
  id: number
  mrn: string
  full_name: string
  date_of_birth?: string
  gender?: Gender
  dni?: string
  is_active: boolean
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  pages: number
}

// ── Encounters ────────────────────────────────────────────────────────────────
export type EncounterType = 'inpatient' | 'outpatient' | 'emergency' | 'observation'
export type EncounterStatus = 'planned' | 'arrived' | 'in-progress' | 'finished' | 'cancelled'

export interface Encounter {
  id: number
  patient_id: number
  encounter_type: EncounterType
  status: EncounterStatus
  admission_date?: string
  discharge_date?: string
  chief_complaint?: string
  diagnosis?: string
  treating_physician?: string
  department?: string
  ward?: string
  bed_number?: string
  created_at: string
}

// ── Orders ────────────────────────────────────────────────────────────────────
export type Modality = 'CR' | 'CT' | 'MR' | 'US' | 'NM' | 'PT' | 'DX' | 'MG' | 'XA' | 'RF' | 'OT'
export type OrderPriority = 'ROUTINE' | 'URGENT' | 'STAT' | 'ASAP'
export type OrderStatus = 'REQUESTED' | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'ON_HOLD'

export interface ImagingOrder {
  id: number
  patient_id: number
  encounter_id?: number
  accession_number: string
  modality: Modality
  procedure_code?: string
  procedure_description: string
  body_part?: string
  laterality?: string
  priority: OrderPriority
  status: OrderStatus
  clinical_indication?: string
  requested_at: string
  scheduled_at?: string
  completed_at?: string
}

export interface WorklistEntry {
  id: number
  order_id: number
  accession_number: string
  patient_id_dicom: string
  patient_name_dicom: string
  modality: string
  scheduled_datetime: string
  scheduled_station_ae_title?: string
  procedure_description: string
  status: string
}

// ── Studies (enriched) ────────────────────────────────────────────────────────
export interface ImagingStudyWithReport {
  id: number
  order_id?: number
  study_instance_uid: string
  orthanc_study_id?: string
  series_count: number
  instances_count: number
  modality?: string
  study_description?: string
  status: StudyStatus
  received_at?: string
  created_at: string
  accession_number?: string
  patient_id?: number
  patient_name?: string
  patient_mrn?: string
  report_id?: number
  report_status?: string
}

// ── Reports ───────────────────────────────────────────────────────────────────
export type ReportStatus = 'draft' | 'preliminary' | 'final' | 'amended' | 'cancelled'

export interface ReportListItem {
  id: number
  study_id: number
  status: ReportStatus
  signed_by?: string
  signed_at?: string
  created_at: string
  updated_at: string
  accession_number?: string
  modality?: string
  patient_name?: string
  patient_mrn?: string
}

export interface ReportVersion {
  id: number
  version_number: number
  findings?: string
  impression?: string
  created_at: string
}

export interface RadiologyReport {
  id: number
  study_id: number
  radiologist_id: number
  status: ReportStatus
  findings?: string
  impression?: string
  recommendation?: string
  technique?: string
  clinical_info?: string
  signature_hash?: string
  signed_at?: string
  signed_by?: string
  created_at: string
  updated_at: string
  versions: ReportVersion[]
}

// ── Schedule ──────────────────────────────────────────────────────────────────
export type ResourceType = 'room' | 'equipment' | 'staff'
export type AppointmentStatus = 'proposed' | 'pending' | 'booked' | 'arrived' | 'fulfilled' | 'cancelled' | 'noshow'

export interface Resource {
  id: number
  name: string
  resource_type: ResourceType
  modality?: string
  ae_title?: string
  location?: string
  is_available: boolean
  created_at: string
}

export interface Appointment {
  id: number
  patient_id: number
  order_id?: number
  resource_id?: number
  status: AppointmentStatus
  start_datetime: string
  end_datetime: string
  duration_minutes: number
  notes?: string
  created_at: string
}

export interface TimeSlot {
  resource_id: number
  start_datetime: string
  end_datetime: string
  duration_minutes: number
  available: boolean
}

// ── Studies ───────────────────────────────────────────────────────────────────
export type StudyStatus = 'PENDING' | 'RECEIVED' | 'PROCESSING' | 'AVAILABLE' | 'ERROR'

export interface ImagingStudy {
  id: number
  order_id?: number
  study_instance_uid: string
  orthanc_study_id?: string
  series_count: number
  instances_count: number
  modality?: string
  study_description?: string
  status: StudyStatus
  received_at?: string
  created_at: string
}
