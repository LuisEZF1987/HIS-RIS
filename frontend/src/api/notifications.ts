import { apiClient } from './client'

export interface Notification {
  id: number
  type: string
  title: string
  body: string | null
  link: string | null
  is_read: boolean
  created_at: string
}

export const notificationsApi = {
  list: () => apiClient.get<Notification[]>('/notifications').then((r) => r.data),
  unreadCount: () => apiClient.get<{ count: number }>('/notifications/unread-count').then((r) => r.data.count),
  markRead: (id: number) => apiClient.put(`/notifications/${id}/read`),
  markAllRead: () => apiClient.put('/notifications/read-all'),
}
