import { apiClient } from './client'

function downloadBlob(data: Blob, filename: string) {
  const url = URL.createObjectURL(data)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export const exportApi = {
  patients: async (format: 'csv' | 'xlsx' = 'csv') => {
    const res = await apiClient.get('/export/patients', { params: { format }, responseType: 'blob' })
    downloadBlob(res.data, `pacientes.${format}`)
  },

  orders: async (format: 'csv' | 'xlsx' = 'csv', status?: string) => {
    const res = await apiClient.get('/export/orders', { params: { format, status }, responseType: 'blob' })
    downloadBlob(res.data, `ordenes.${format}`)
  },

  worklist: async (format: 'csv' | 'xlsx' = 'csv') => {
    const res = await apiClient.get('/export/worklist', { params: { format }, responseType: 'blob' })
    downloadBlob(res.data, `worklist.${format}`)
  },
}
