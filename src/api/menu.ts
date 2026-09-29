import { http } from '@/utils/request'
import type { MenuInfo } from '@/types'

export interface MenuQuery {
  menuName?: string
  status?: string
}

export const menuApi = {
  /** 当前用户可见菜单树（用于侧栏渲染） */
  userMenus: () => http.get<MenuInfo[]>('/system/menu/getUserMenuList'),
  /** 当前用户可用路由树（用于动态路由生成） */
  routeMenus: () => http.get<MenuInfo[]>('/system/menu/getRouteList'),
  list: (params: MenuQuery) => http.get<MenuInfo[]>('/system/menu/list', params),
  detail: (menuId: string) => http.get<MenuInfo>(`/system/menu/${menuId}`),
  add: (data: Partial<MenuInfo>) => http.post<void>('/system/menu', data),
  update: (data: Partial<MenuInfo>) => http.put<void>('/system/menu', data),
  remove: (menuId: string) => http.del<void>(`/system/menu/${menuId}`),
  /** 角色已分配的菜单 */
  roleMenuIds: (roleId: string) => http.get<string[]>(`/system/menu/roleMenuTreeselect/${roleId}`)
}

export const getUserMenus = menuApi.userMenus
export const getRouteMenus = menuApi.routeMenus
