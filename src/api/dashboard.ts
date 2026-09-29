import { http } from '@/utils/request'

export interface DashboardOverview {
  visit: number
  order: number
  amount: number
  userCount: number
  weekTrend: { date: string; value: number }[]
  category: { name: string; value: number }[]
  funnel: { name: string; value: number }[]
  todos: { title: string; count: number; color: string; icon: string }[]
  notices: { title: string; date: string; type: string }[]
}

export const dashboardApi = {
  overview: () => http.get<DashboardOverview>('/dashboard/overview'),
  weekTrend: (days = 7) => http.get<{ date: string; value: number }[]>('/dashboard/weekTrend', { days }),
  category: () => http.get<{ name: string; value: number }[]>('/dashboard/category'),
  todos: () => http.get<DashboardOverview['todos']>('/dashboard/todos'),
  notices: () => http.get<DashboardOverview['notices']>('/dashboard/notices')
}
