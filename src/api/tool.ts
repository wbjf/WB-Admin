import { http } from '@/utils/request'
import { toArray } from '@/utils'

/** 代码生成 */
export const genApi = {
  tables: (params: { tableName?: string; pageNum?: number; pageSize?: number }) =>
    http.get<{ list: any[]; total: number }>('/tool/gen/db/list', params),
  preview: (tableId: string) => http.get<Record<string, string>>(`/tool/gen/preview/${tableId}`),
  downloadZip: (tables: string[]) => http.post<Blob>('/tool/gen/download/batch', tables, { raw: true }),
  generate: (data: Record<string, any>) => http.post<void>('/tool/gen/generate', data),
  tableDetail: (tableId: string) => http.get<any>(`/tool/gen/${tableId}`)
}

/** 定时任务 */
export const jobApi = {
  list: async (params: Record<string, any> = {}) =>
    toArray<any>(await http.get<unknown>('/monitor/job/list', params)),
  detail: (jobId: string) => http.get<any>(`/monitor/job/${jobId}`),
  add: (data: Record<string, any>) => http.post<void>('/monitor/job', data),
  update: (data: Record<string, any>) => http.put<void>('/monitor/job', data),
  remove: (ids: string | string[]) =>
    http.del<void>('/monitor/job', { ids: Array.isArray(ids) ? ids.join(',') : ids }),
  changeStatus: (jobId: string, status: string) => http.put<void>('/monitor/job/changeStatus', { jobId, status }),
  runOnce: (jobId: string) => http.put<void>('/monitor/job/run', { jobId }),
  logs: async (params: Record<string, any> = {}) =>
    toArray<any>(await http.get<unknown>('/monitor/jobLog/list', params)),
  cleanLogs: () => http.del<void>('/monitor/jobLog/clean')
}

/** 文件管理 */
export const fileApi = {
  list: (params: Record<string, any>) => http.get<{ list: any[]; total: number }>('/system/file/list', params),
  remove: (ids: string | string[]) =>
    http.del<void>('/system/file', { ids: Array.isArray(ids) ? ids.join(',') : ids }),
  rename: (fileId: string, fileName: string) => http.put<void>('/system/file/rename', { fileId, fileName }),
  mkdir: (parentId: string, name: string) => http.post<void>('/system/file/mkdir', { parentId, name })
}

export const UPLOAD_URL = `${import.meta.env.VITE_API_PREFIX || '/api'}/system/file/upload`
export const UPLOAD_IMAGE_URL = `${import.meta.env.VITE_API_PREFIX || '/api'}/system/file/upload/image`
