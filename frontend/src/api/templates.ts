import { apiClient } from './client'

export interface ReportTemplate {
  id: number
  name: string
  modality?: string
  technique?: string
  findings?: string
  impression?: string
  recommendation?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CreateTemplateData {
  name: string
  modality?: string
  technique?: string
  findings?: string
  impression?: string
  recommendation?: string
}

export const templatesApi = {
  list: (params?: { modality?: string; active_only?: boolean }) =>
    apiClient.get<ReportTemplate[]>('/templates', { params }).then((r) => r.data),

  create: (data: CreateTemplateData) =>
    apiClient.post<ReportTemplate>('/templates', data).then((r) => r.data),

  update: (id: number, data: Partial<CreateTemplateData & { is_active: boolean }>) =>
    apiClient.put<ReportTemplate>(`/templates/${id}`, data).then((r) => r.data),

  delete: (id: number) =>
    apiClient.delete(`/templates/${id}`),
}
