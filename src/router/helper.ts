import type { RouteRecordRaw, RouteComponent } from 'vue-router'
import type { MenuInfo, RouteMeta } from '@/types'

/**
 * 组件白名单：只有命中 glob 结果才会被加载，杜绝后端注入任意路径。
 */
const viewModules = import.meta.glob(['/src/views/**/*.vue'])

export const Layout = () => import('@/layouts/index.vue')

function resolveView(component: string): RouteComponent | undefined {
  const clean = component.replace(/^\/+/, '').replace(/\.vue$/, '')
  const candidates = [`/src/views/${clean}.vue`, `/src/views/${clean}/index.vue`]
  for (const key of candidates) {
    if (viewModules[key]) return viewModules[key] as unknown as RouteComponent
  }
  return undefined
}

/** 菜单类型为 C/L 时使用 */
function leafComponent(menu: MenuInfo): RouteComponent | undefined {
  if (menu.type === 'L' || menu.isFrame === '1') {
    const inner = resolveView('common/InnerLink')
    if (inner) return inner
  }
  if (!menu.component) return undefined
  return resolveView(menu.component)
}

/**
 * 找到子树里第一个可落地页面的完整路径，用作目录级菜单的 redirect。
 * 没有它，点击/搜索到「系统管理」这类目录会被导航到 `/system`，
 * 而 `/system` 自身没有组件 → Vue Router 报 "No match found" → 内容区白屏。
 */
function firstLeafPath(prefix: string, children: RouteRecordRaw[]): string | undefined {
  for (const child of children) {
    const full = child.path.startsWith('/')
      ? child.path
      : `${prefix.replace(/\/$/, '')}/${child.path}`.replace(/\/+/g, '/')
    if (child.children?.length) {
      const deep = firstLeafPath(full, child.children)
      if (deep) return deep
      continue
    }
    // 隐藏页（如详情页）不作为目录的默认落地页
    if ((child.meta as RouteMeta | undefined)?.hidden) continue
    return full
  }
  return undefined
}

/** RuoYi 用 'noRedirect' 表示"目录点击不跳转"，不能当作真实路径 */
function resolveRedirect(raw: string | undefined, fallback: string | undefined): string | undefined {
  if (raw && raw !== 'noRedirect') return raw
  return fallback
}

function toRoute(menu: MenuInfo, isTop: boolean): RouteRecordRaw | null {
  if (menu.type === 'F') return null

  const meta: RouteMeta = {
    title: menu.title,
    icon: menu.icon,
    // 约定 visible：'0' 显示 / '1' 隐藏（与 RuoYi 一致），写反会导致菜单整棵被过滤掉
    hidden: menu.visible === '1',
    keepAlive: menu.isCache === '1',
    permission: menu.perms ? [menu.perms] : undefined,
    activeMenu: undefined
  }

  const children = (menu.children || [])
    .map((child) => toRoute(child, false))
    .filter(Boolean) as RouteRecordRaw[]

  if (menu.type === 'M' && isTop) {
    if (!children.length) return null
    const base = menu.path?.startsWith('/') ? menu.path : `/${menu.path ?? ''}`
    return {
      path: base,
      // 顶层布局路由必须带 name，否则 guard 无法按 name 判重、addRoute 会被静默跳过
      name: menu.name || toRouteName(menu.path),
      component: Layout,
      // 必须有 redirect：目录自身无组件，缺了会白屏
      redirect: resolveRedirect(menu.redirect, firstLeafPath(base, children)),
      meta: meta as any,
      children
    }
  }

  if (menu.type === 'M') {
    if (!children.length) return null
    return {
      path: menu.path ?? '',
      name: menu.name || toRouteName(menu.path),
      component: resolveView('common/ParentView') ?? Layout,
      redirect: resolveRedirect(menu.redirect, firstLeafPath('', children)),
      meta: meta as any,
      children
    }
  }

  const comp = leafComponent(menu)
  if (!comp) return null
  return {
    path: menu.path ?? '',
    // 叶子路由兜底命名，保证 TagsView / keep-alive 可用
    name: menu.name || toRouteName(menu.path),
    component: comp,
    meta: meta as any,
    props: menu.type === 'L' ? { url: menu.path } : undefined,
    children: children.length ? children : undefined
  }
}

/** 无 name 时用 path 生成一个稳定且唯一的驼峰名，如 /system/user → SystemUser */
function toRouteName(path?: string): string {
  const segs = String(path ?? '')
    .split(/[/\-_]+/)
    .filter(Boolean)
  const pascal = segs.map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join('')
  return pascal ? `Auto${pascal}` : `Auto${Math.random().toString(36).slice(2, 8)}`
}

/** 后端菜单树 → 前端路由表 */
export function buildRoutes(menus: MenuInfo[]): RouteRecordRaw[] {
  return menus
    .map((m) => toRoute(m, true))
    .filter(Boolean) as RouteRecordRaw[]
}

/**
 * 菜单是否可见。约定 visible：'0' 显示 / '1' 隐藏（与 RuoYi 一致）。
 * 这个语义只保留这一份实现 —— 各组件各写一遍极易写反，
 * 写反的表现是「整棵子菜单被过滤掉」，且不报任何错。
 */
export function isMenuVisible(menu: Pick<MenuInfo, 'type' | 'visible'>): boolean {
  return menu.type !== 'F' && menu.visible !== '1'
}

/** 用于菜单渲染：过滤隐藏项 */
export function filterVisibleMenus(menus: MenuInfo[]): MenuInfo[] {
  return menus
    .filter(isMenuVisible)
    .map((m) => ({ ...m, children: m.children ? filterVisibleMenus(m.children) : undefined }))
    .filter((m) => m.type === 'M' || m.type === 'C' || m.type === 'L')
}

/** 拍平出一维菜单（用于搜索），并拼出完整路径 */
export function flatMenus(menus: MenuInfo[], parentPath = ''): MenuInfo[] {
  const out: MenuInfo[] = []
  const walk = (list: MenuInfo[], prefix: string, parentIcon?: string) => {
    list.forEach((item) => {
      if (item.type === 'F') return
      const raw = String(item.path ?? '')
      const full =
        raw.startsWith('/') || raw.startsWith('http')
          ? raw
          : `${prefix}/${raw}`.replace(/\/+/g, '/')
      const copy: MenuInfo = {
        ...item,
        path: full,
        icon: item.icon || parentIcon,
        children: undefined
      }
      out.push(copy)
      if (item.children?.length) walk(item.children, full, copy.icon)
    })
  }
  walk(menus, parentPath)
  return out
}
