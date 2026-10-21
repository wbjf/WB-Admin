import { http } from '@/utils/request'
import type { FlowGraph, FlowListItem, FlowVersion, PageQuery, PageResult } from '@/types'

/** 流程图接口。首版全部走 mock，接真实后端只改这个文件 */
export const flowApi = {
  list: (params: PageQuery & { name?: string; category?: string }) =>
    http.get<PageResult<FlowListItem>>('/flow/list', params),
  detail: (id: string) => http.get<FlowGraph>(`/flow/${id}`),
  add: (data: Partial<FlowListItem>) => http.post<{ id: string }>('/flow', data),
  update: (data: Partial<FlowListItem>) => http.put<void>('/flow', data),
  remove: (ids: string | string[]) =>
    http.del<void>('/flow', { ids: Array.isArray(ids) ? ids.join(',') : ids }),

  /** 保存图内容（正式版） */
  saveGraph: (id: string, graph: FlowGraph) => http.put<void>(`/flow/${id}/graph`, graph),
  /** 仅保存草稿到服务端（可选能力） */
  saveDraft: (id: string, graph: FlowGraph) => http.put<void>(`/flow/${id}/draft`, graph),

  versions: (id: string) => http.get<FlowVersion[]>(`/flow/${id}/versions`),
  publish: (id: string, data: { name?: string; remark?: string }) =>
    http.post<FlowVersion>(`/flow/${id}/versions`, data),
  rollback: (id: string, data: { version: number }) =>
    http.post<FlowGraph>(`/flow/${id}/rollback`, data),

  /** 上传 .flow.json 导入 */
  importJson: (graph: FlowGraph) => http.post<{ id: string }>('/flow/import', graph)
}
