import { apiClient } from './client'

export interface DashboardStats {
  unsigned_reports: number
  orders_by_day: Array<{ date: string; count: number }>
  this_week_orders: number
  last_week_orders: number
  today_completed: number
}

export const dashboardApi = {
  getStats: () =>
    apiClient.get<DashboardStats>('/dashboard/stats').then((r) => r.data),
}
