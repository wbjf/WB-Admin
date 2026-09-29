import { createRouter, createWebHashHistory, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { constantRoutes, baseRoutes } from './routes'

const useHash = import.meta.env.VITE_ROUTER_HISTORY === 'hash'

const router = createRouter({
  history: useHash
    ? createWebHashHistory(import.meta.env.VITE_BASE_URL)
    : createWebHistory(import.meta.env.VITE_BASE_URL),
  routes: [...constantRoutes, ...baseRoutes] as RouteRecordRaw[],
  scrollBehavior: () => ({ left: 0, top: 0 })
})

/** 清空动态路由（登出、切角色时使用） */
export function resetRouter(dynamicNames: string[] = []): void {
  dynamicNames.forEach((name) => {
    if (router.hasRoute(name)) router.removeRoute(name)
  })
}

export default router
