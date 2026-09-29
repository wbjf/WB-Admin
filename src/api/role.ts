import { http } from '@/utils/request'
import type { DataScopeType, PageQuery, PageResult, RoleInfo } from '@/types'

export interface RoleQuery extends PageQuery {
  roleName?: string
  roleKey?: string
  status?: string
}

export interface RoleVO extends RoleInfo {
  flag?: boolean
  admin?: boolean
}

export const roleApi = {
  list: (params: RoleQuery) => http.get<PageResult<RoleVO>>('/system/role/list', params),
  all: () => http.get<RoleVO[]>('/system/role/all'),
  detail: (roleId: string) => http.get<RoleVO>(`/system/role/${roleId}`),
  add: (data: Partial<RoleVO>) => http.post<void>('/system/role', data),
  update: (data: Partial<RoleVO>) => http.put<void>('/system/role', data),
  remove: (ids: string | string[]) =>
    http.del<void>('/system/role', { ids: Array.isArray(ids) ? ids.join(',') : ids }),
  changeStatus: (roleId: string, status: string) =>
    http.put<void>('/system/role/changeStatus', { roleId, status }),
  setDataScope: (roleId: string, dataScope: DataScopeType, deptIds: string[]) =>
    http.put<void>('/system/role/dataScope', { roleId, dataScope, deptIds: deptIds.join(',') }),
  allocatedUsers: (roleId: string, params: PageQuery) =>
    http.get<PageResult<any>>(`/system/role/authUser/allocatedList`, { roleId, ...params }),
  unallocatedUsers: (roleId: string, params: PageQuery) =>
    http.get<PageResult<any>>(`/system/role/authUser/unallocatedList`, { roleId, ...params }),
  cancelAuthUser: (roleId: string, userId: string) =>
    http.put<void>('/system/role/authUser/cancel', { roleId, userId }),
  cancelAllUsers: (roleId: string, userIds: string[]) =>
    http.put<void>('/system/role/authUser/cancelAll', { roleId, userIds: userIds.join(',') }),
  selectAllUsers: (roleId: string, userIds: string[]) =>
    http.put<void>('/system/role/authUser/selectAll', { roleId, userIds: userIds.join(',') })
}
