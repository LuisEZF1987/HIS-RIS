import { apiClient } from './client'
import type { RadiologyReport, ReportListItem, ImagingStudyWithReport } from '@/types'

export interface CreateReportData {
  study_id: number
  findings?: string
  impression?: string
  recommendation?: string
  technique?: string
  clinical_info?: string
}

export const reportsApi = {
  list: (params?: { status?: string }) =>
    apiClient.get<ReportListItem[]>('/reports', { params }).then((r) => r.data),

  get: (id: number) =>
    apiClient.get<RadiologyReport>(`/reports/${id}`).then((r) => r.data),

  create: (data: CreateReportData) =>
    apiClient.post<RadiologyReport>('/reports', data).then((r) => r.data),

  update: (id: number, data: Partial<CreateReportData>) =>
    apiClient.put<RadiologyReport>(`/reports/${id}`, data).then((r) => r.data),

  sign: (id: number, password: string) =>
    apiClient.post<RadiologyReport>(`/reports/${id}/sign`, { password }).then((r) => r.data),

  downloadPdf: (id: number) =>
    apiClient.get(`/reports/${id}/pdf`, { responseType: 'blob' }).then((r) => r.data),

  listStudies: (params?: { status?: string }) =>
    apiClient.get<ImagingStudyWithReport[]>('/studies', { params }).then((r) => r.data),
}
