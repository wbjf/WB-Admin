import { http } from '@/utils/request'
import type { PageQuery, PageResult, UserInfo } from '@/types'

export interface UserVO extends UserInfo {
  postIds?: string[]
  roleIds?: string[]
  password?: string
}

export interface UserQuery extends PageQuery {
  userName?: string
  phonenumber?: string
  status?: string
  deptId?: string
  beginTime?: string
  endTime?: string
}

export const userApi = {
  list: (params: UserQuery) => http.get<PageResult<UserVO>>('/system/user/list', params),
  detail: (userId: string) => http.get<UserVO>(`/system/user/${userId}`),
  add: (data: Partial<UserVO>) => http.post<void>('/system/user', data),
  update: (data: Partial<UserVO>) => http.put<void>('/system/user', data),
  remove: (ids: string | string[]) =>
    http.del<void>('/system/user', { ids: Array.isArray(ids) ? ids.join(',') : ids }),
  changeStatus: (userId: string, status: string) =>
    http.put<void>('/system/user/changeStatus', { userId, status }),
  resetPwd: (userId: string, password: string) =>
    http.put<{ password: string }>('/system/user/resetPwd', { userId, password }),
  authRole: (userId: string, roleIds: string[]) =>
    http.put<void>('/system/user/authRole', { userId, roleIds: roleIds.join(',') }),
  updateProfile: (data: Partial<UserVO>) => http.put<void>('/system/user/profile', data),
  updatePwd: (oldPassword: string, newPassword: string) =>
    http.put<void>('/system/user/profile/updatePwd', { oldPassword, newPassword }),
  updateAvatar: (avatar: string) => http.put<void>('/system/user/profile/avatar', { avatar })
}
