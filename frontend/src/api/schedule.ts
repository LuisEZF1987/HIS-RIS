import { apiClient } from './client'
import type { Appointment, Resource, TimeSlot } from '@/types'

export const scheduleApi = {
  getResources: (modality?: string) =>
    apiClient.get<Resource[]>('/resources', { params: { modality } }).then((r) => r.data),

  getSlots: (resource_id: number, date: string, duration_minutes?: number) =>
    apiClient
      .get<TimeSlot[]>('/slots', { params: { resource_id, date, duration_minutes } })
      .then((r) => r.data),

  listAppointments: (params: {
    patient_id?: number
    resource_id?: number
    date_from?: string
    date_to?: string
  }) => apiClient.get<Appointment[]>('/appointments', { params }).then((r) => r.data),

  createAppointment: (data: {
    patient_id: number
    order_id?: number
    resource_id?: number
    start_datetime: string
    duration_minutes?: number
    notes?: string
  }) => apiClient.post<Appointment>('/appointments', data).then((r) => r.data),

  updateAppointment: (id: number, data: Partial<{ status: string; start_datetime: string; duration_minutes: number }>) =>
    apiClient.put<Appointment>(`/appointments/${id}`, data).then((r) => r.data),
}
