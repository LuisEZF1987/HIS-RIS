import { apiClient } from './client'
import type { Patient, PatientListItem, PaginatedResponse } from '@/types'

export interface CreatePatientData {
  first_name: string
  last_name: string
  date_of_birth?: string
  gender?: string
  dni?: string
  blood_type?: string
  allergies?: string
  contacts?: Array<{
    contact_type: string
    value: string
    label?: string
    is_primary?: boolean
  }>
}

export const patientsApi = {
  list: (params: { q?: string; page?: number; page_size?: number }) =>
    apiClient.get<PaginatedResponse<PatientListItem>>('/patients', { params }).then((r) => r.data),

  get: (id: number) =>
    apiClient.get<Patient>(`/patients/${id}`).then((r) => r.data),

  create: (data: CreatePatientData) =>
    apiClient.post<Patient>('/patients', data).then((r) => r.data),

  update: (id: number, data: Partial<CreatePatientData>) =>
    apiClient.put<Patient>(`/patients/${id}`, data).then((r) => r.data),

  deactivate: (id: number) =>
    apiClient.delete(`/patients/${id}`),
}
