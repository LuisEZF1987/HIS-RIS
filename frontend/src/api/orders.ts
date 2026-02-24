import { apiClient } from './client'
import type { ImagingOrder, WorklistEntry, PaginatedResponse } from '@/types'

export interface CreateOrderData {
  patient_id: number
  encounter_id?: number
  modality: string
  procedure_description: string
  procedure_code?: string
  body_part?: string
  priority?: string
  clinical_indication?: string
  scheduled_at?: string
}

export const ordersApi = {
  list: (params: { status?: string; modality?: string; patient_id?: number; page?: number }) =>
    apiClient.get<PaginatedResponse<ImagingOrder>>('/orders', { params }).then((r) => r.data),

  get: (id: number) =>
    apiClient.get<ImagingOrder>(`/orders/${id}`).then((r) => r.data),

  create: (data: CreateOrderData) =>
    apiClient.post<ImagingOrder>('/orders', data).then((r) => r.data),

  updateStatus: (id: number, data: { status?: string; scheduled_at?: string; priority?: string }) =>
    apiClient.put<ImagingOrder>(`/orders/${id}/status`, data).then((r) => r.data),

  getWorklist: (modality?: string) =>
    apiClient.get<WorklistEntry[]>('/worklist', { params: { modality } }).then((r) => r.data),
}
