import { apiClient } from './client'

export interface SearchResult {
  patients: Array<{
    id: number
    mrn: string
    full_name: string
    dni?: string
  }>
  orders: Array<{
    id: number
    accession_number: string
    modality: string
    procedure_description: string
    status: string
    patient_id: number
  }>
}

export const searchApi = {
  search: (q: string) =>
    apiClient.get<SearchResult>('/search', { params: { q } }).then((r) => r.data),
}
