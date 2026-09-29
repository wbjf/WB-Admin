import { http } from '@/utils/request'
import type { PageQuery, PageResult } from '@/types'

export interface DemoItem {
  id: string
  name: string
  category: string
  price: number
  stock: number
  status: '0' | '1'
  tags: string[]
  cover?: string
  remark?: string
  createTime: string
}

export const demoApi = {
  list: (params: PageQuery) => http.get<PageResult<DemoItem>>('/demo/list', params),
  detail: (id: string) => http.get<DemoItem>(`/demo/${id}`),
  add: (data: Partial<DemoItem>) => http.post<void>('/demo', data),
  update: (data: Partial<DemoItem>) => http.put<void>('/demo', data),
  remove: (ids: string | string[]) =>
    http.del<void>('/demo', { ids: Array.isArray(ids) ? ids.join(',') : ids })
}
