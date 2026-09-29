import { http } from '@/utils/request'
import { toArray } from '@/utils'
import type { DeptInfo } from '@/types'

export interface DeptQuery {
  deptName?: string
  status?: string
}

/**
 * 注意：后端这些「列表」接口（RuoYi 系）返回的是分页对象 TableDataInfo，
 * 而不是纯数组。api 层统一用 toArray 收敛成数组，
 * 否则调用方拿到的是 { list, total } —— 下拉框 v-for 会遍历出 undefined，
 * 树形表格直接报错，而且不抛异常、极难排查。
 */
export const deptApi = {
  list: async (params: DeptQuery = {}) =>
    toArray<DeptInfo>(await http.get<unknown>('/system/dept/list', params)),
  excludes: async (deptId: string) =>
    toArray<DeptInfo>(await http.get<unknown>(`/system/dept/list/exclude/${deptId}`)),
  detail: (deptId: string) => http.get<DeptInfo>(`/system/dept/${deptId}`),
  add: (data: Partial<DeptInfo>) => http.post<void>('/system/dept', data),
  update: (data: Partial<DeptInfo>) => http.put<void>('/system/dept', data),
  remove: (deptId: string) => http.del<void>(`/system/dept/${deptId}`),
  move: (deptId: string, parentId: string, targets: string[]) =>
    http.put<void>('/system/dept/move', { deptId, parentId, targets })
}

export { postApi } from './post'

export const dictApi = {
  typeList: async (params: Record<string, any> = {}) =>
    toArray<any>(await http.get<unknown>('/system/dict/type/list', params)),
  typeAll: async () => toArray<any>(await http.get<unknown>('/system/dict/type/all')),
  typeDetail: (dictId: string) => http.get<any>(`/system/dict/type/${dictId}`),
  typeAdd: (data: Record<string, any>) => http.post<void>('/system/dict/type', data),
  typeUpdate: (data: Record<string, any>) => http.put<void>('/system/dict/type', data),
  typeRemove: (ids: string | string[]) =>
    http.del<void>('/system/dict/type', { ids: Array.isArray(ids) ? ids.join(',') : ids }),
  refreshCache: () => http.del<void>('/system/dict/type/refreshCache'),
  dataList: async (params: Record<string, any> = {}) =>
    toArray<any>(await http.get<unknown>('/system/dict/data/list', params)),
  dataByType: async (dictType: string) =>
    toArray<any>(await http.get<unknown>(`/system/dict/data/type/${dictType}`)),
  dataDetail: (dictCode: string) => http.get<any>(`/system/dict/data/${dictCode}`),
  dataAdd: (data: Record<string, any>) => http.post<void>('/system/dict/data', data),
  dataUpdate: (data: Record<string, any>) => http.put<void>('/system/dict/data', data),
  dataRemove: (ids: string | string[]) =>
    http.del<void>('/system/dict/data', { ids: Array.isArray(ids) ? ids.join(',') : ids })
}

export const listDictDataByType = dictApi.dataByType

export const configApi = {
  list: async (params: Record<string, any> = {}) =>
    toArray<any>(await http.get<unknown>('/system/config/list', params)),
  detail: (configId: string) => http.get<any>(`/system/config/${configId}`),
  add: (data: Record<string, any>) => http.post<void>('/system/config', data),
  update: (data: Record<string, any>) => http.put<void>('/system/config', data),
  remove: (ids: string | string[]) =>
    http.del<void>('/system/config', { ids: Array.isArray(ids) ? ids.join(',') : ids }),
  refreshCache: () => http.del<void>('/system/config/refreshCache'),
  getByKey: (key: string) => http.get<string>(`/system/config/configKey/${key}`)
}

export const noticeApi = {
  list: async (params: Record<string, any> = {}) =>
    toArray<any>(await http.get<unknown>('/system/notice/list', params)),
  detail: (noticeId: string) => http.get<any>(`/system/notice/${noticeId}`),
  add: (data: Record<string, any>) => http.post<void>('/system/notice', data),
  update: (data: Record<string, any>) => http.put<void>('/system/notice', data),
  remove: (ids: string | string[]) =>
    http.del<void>('/system/notice', { ids: Array.isArray(ids) ? ids.join(',') : ids })
}
