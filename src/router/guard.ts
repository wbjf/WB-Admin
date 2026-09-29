import NProgress from 'nprogress'
import 'nprogress/nprogress.css'
import type { RouteLocationNormalized } from 'vue-router'
import router from './index'
import { WHITE_LIST } from './routes'
import { getToken } from '@/utils/auth'
import { hasPermi } from '@/utils/permission'
import { useUserStore } from '@/stores/modules/user'
import { usePermissionStore } from '@/stores/modules/permission'
import { useTagsViewStore } from '@/stores/modules/tagsView'
import { clearPending } from '@/utils/request'
import { setPageTitle } from '@/utils/page'

NProgress.configure({ showSpinner: false, speed: 400 })

router.beforeEach(async (to: RouteLocationNormalized, _from, next) => {
  NProgress.start()
  setPageTitle(to)

  const token = getToken()
  const userStore = useUserStore()
  const permStore = usePermissionStore()

  if (token) {
    if (to.path === '/login') {
      next({ path: '/', replace: true })
      NProgress.done()
      return
    }

    // ⚠️ 不能只判 `!userStore.userId`：userId / permissions 是持久化的，
    // 刷新页面时它们「有值但可能是上一次会话的旧快照」，于是这里被整体跳过、
    // 全程不请求 getInfo —— 后端新增的权限点在本机永远拿不到，直接 403
    // （实测：点「示例演示 → 弹窗能力」报「抱歉，你没有访问权限」，只要不退出重登就一直在）。
    // infoLoaded 不参与持久化，所以每次页面加载都会走到这里重新拉一次。
    if (!userStore.userId || !userStore.infoLoaded) {
      try {
        await userStore.loadUserInfo()
        const routes = await permStore.loadRoutes()
        applyDynamicRoutes(routes)
        if (routes.length) await permStore.loadMenus()
        next({ path: resolveTarget(to), replace: true })
        return
      } catch (e) {
        console.error('[router] 加载用户信息/动态路由失败', e)
        await userStore.logout()
        clearPending()
        next({ path: '/login', query: { redirect: encodeURIComponent(to.fullPath) } })
        NProgress.done()
        return
      }
    }

    const required = to.meta.permission as string[] | undefined
    if (required?.length && !hasPermi(required)) {
      next({ path: '/403', replace: true })
      NProgress.done()
      return
    }

    // 刷新后动态路由丢失（例如直接 F5 落在动态页）
    if (permStore.dynamicRoutes.length === 0) {
      try {
        const routes = await permStore.loadRoutes()
        applyDynamicRoutes(routes)
        // 菜单树同样会丢，不补的话刷新后侧边栏是空的
        if (routes.length) await permStore.loadMenus()
        next({ path: resolveTarget(to), replace: true })
        return
      } catch (e) {
        console.error('[router] 动态路由补偿失败', e)
      }
    }

    next()
    return
  }

  if (WHITE_LIST.includes(to.path)) {
    next()
    return
  }
  next({ path: '/login', query: { redirect: encodeURIComponent(to.fullPath) } })
  NProgress.done()
})

/** 本次会话已注册的路由键，避免重复 addRoute 造成路由表膨胀 */
const addedRouteKeys = new Set<string>()

/**
 * 取用户原本想去的地址。
 * 动态路由还没注册时，目标可能已被兜底路由（/:pathMatch(.*)*）先一步重定向到 /404，
 * 此时 `to` 已经是重定向后的结果，必须用 redirectedFrom 才能回到原地址。
 */
function resolveTarget(to: RouteLocationNormalized): string {
  return to.redirectedFrom?.fullPath ?? to.fullPath
}

/**
 * 注册动态路由。
 * 注意：不能写成 `if (r.name && ...)`，无 name 的路由会被整条跳过且不报错，
 * 表现为「菜单有、页面全白」——这里按 name/path 双通道判重，无 name 也照样注册。
 */
function applyDynamicRoutes(routes: import('vue-router').RouteRecordRaw[]) {
  routes.forEach((r) => {
    const key = r.name ? `name:${String(r.name)}` : `path:${String(r.path)}`
    if (addedRouteKeys.has(key)) return
    if (r.name && router.hasRoute(r.name)) {
      addedRouteKeys.add(key)
      return
    }
    addedRouteKeys.add(key)
    router.addRoute(r)
  })
}

router.afterEach((to) => {
  const tagsStore = useTagsViewStore()
  if (!to.meta.hidden && to.name) {
    tagsStore.addView({ ...to, meta: { ...to.meta } } as any)
  }
  clearPendingOfOthers()
  NProgress.done()
})

router.onError((err) => {
  console.error('[router] chunk load failed', err)
  window.location.reload()
})

function clearPendingOfOthers() {
  clearPending()
}

export default router
