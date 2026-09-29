import { http } from '@/utils/request'
import { toArray } from '@/utils'
import type { TenantInfo } from '@/types'

export const tenantApi = {
  /**
   * 后端 /system/tenant/list 返回分页对象（TableDataInfo），这里统一成数组。
   * 不规范化会让 v-for 遍历到对象属性，el-option 的 value 变成 undefined。
   */
  list: async (params: Record<string, any> = {}) =>
    toArray<TenantInfo>(await http.get<unknown>('/system/tenant/list', params)),
  detail: (tenantId: string) => http.get<TenantInfo>(`/system/tenant/${tenantId}`),
  add: (data: Partial<TenantInfo>) => http.post<void>('/system/tenant', data),
  update: (data: Partial<TenantInfo>) => http.put<void>('/system/tenant', data),
  remove: (ids: string | string[]) =>
    http.del<void>('/system/tenant', { ids: Array.isArray(ids) ? ids.join(',') : ids }),
  changeStatus: (tenantId: string, status: string) =>
    http.put<void>('/system/tenant/changeStatus', { tenantId, status }),
  syncPackage: (tenantId: string, packageId: string) =>
    http.put<void>('/system/tenant/syncPackage', { tenantId, packageId })
}

export const listTenants = tenantApi.list
export const getTenantDetail = tenantApi.detail
