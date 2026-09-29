import { defineStore } from 'pinia'
import type { RouteRecordRaw } from 'vue-router'
import type { MenuInfo } from '@/types'
import { buildRoutes, filterVisibleMenus } from '@/router/helper'
import { getRouteMenus, getUserMenus } from '@/api/menu'

export const usePermissionStore = defineStore('wb-permission', {
  state: () => ({
    dynamicRoutes: [] as RouteRecordRaw[],
    menuTree: [] as MenuInfo[],
    rawMenus: [] as MenuInfo[],
    loaded: false
  }),
  getters: {
    visibleMenus(state): MenuInfo[] {
      return filterVisibleMenus(state.menuTree)
    },
    routeNames(state): string[] {
      return state.dynamicRoutes.map((r) => String(r.name ?? '')).filter(Boolean)
    }
  },
  actions: {
    /** 拉取路由（后端已按当前角色过滤） */
    async loadRoutes(): Promise<RouteRecordRaw[]> {
      const menus = await getRouteMenus()
      this.rawMenus = menus
      this.dynamicRoutes = buildRoutes(menus)
      this.loaded = true
      return this.dynamicRoutes
    },

    /** 拉取用于渲染的菜单树 */
    async loadMenus(): Promise<MenuInfo[]> {
      this.menuTree = await getUserMenus()
      return this.menuTree
    },

    resetRoute() {
      this.dynamicRoutes = []
      this.menuTree = []
      this.rawMenus = []
      this.loaded = false
    }
  }
})
