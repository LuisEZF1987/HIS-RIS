import { apiClient } from './client'

export interface OrdersByModality {
  month: string
  modality: string
  count: number
}

export interface TurnaroundTime {
  month: string
  avg_minutes: number
  count: number
}

export interface RadiologistProductivity {
  month: string
  radiologist: string
  count: number
}

export const statisticsApi = {
  ordersByModality: (months?: number) =>
    apiClient.get<OrdersByModality[]>('/statistics/orders-by-modality', { params: { months } }).then((r) => r.data),

  turnaroundTime: (months?: number) =>
    apiClient.get<TurnaroundTime[]>('/statistics/turnaround-time', { params: { months } }).then((r) => r.data),

  radiologistProductivity: (months?: number) =>
    apiClient.get<RadiologistProductivity[]>('/statistics/radiologist-productivity', { params: { months } }).then((r) => r.data),
}
