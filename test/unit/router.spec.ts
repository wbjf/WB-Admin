import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { buildRoutes, filterVisibleMenus, isMenuVisible } from '@/router/helper'
import { constantRoutes } from '@/router/routes'
import { buildMenus } from '@/mock/db'

/**
 * 回归用例来源：真实线上问题「点侧边栏『系统管理』后内容区白屏」。
 * 根因是目录级菜单既没有 redirect、又因为 visible 判断写反而被当成叶子菜单，
 * 点击后导航到 /system —— 该路径没有组件，router-view 渲染空白且不报错。
 */

const menus = buildMenus()

/** 把路由树拍平成叶子路径，用于校验 redirect 指向真实存在的页面 */
function leafPaths(list: RouteRecordRaw[], prefix = ''): string[] {
  return list.flatMap((item) => {
    const full = item.path.startsWith('/')
      ? item.path
      : `${prefix}/${item.path}`.replace(/\/+/g, '/')
    return item.children?.length ? leafPaths(item.children as RouteRecordRaw[], full) : [full]
  })
}

/**
 * 用空组件替身替换真实页面。
 * 单测只关心「菜单 → 路由表 → 重定向」这层逻辑，
 * 真去加载页面会连带加载 Element Plus 的 .css，Node 环境无法处理。
 */
function stubComponents(routes: RouteRecordRaw[]): RouteRecordRaw[] {
  return routes.map((route) => {
    const next = { ...route } as RouteRecordRaw
    if (next.component) next.component = { template: '<div />' }
    if (next.children?.length) next.children = stubComponents(next.children as RouteRecordRaw[])
    return next
  })
}

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: stubComponents([...constantRoutes, ...buildRoutes(menus)])
  })
}

describe('菜单 → 路由转换', () => {
  const routes = buildRoutes(menus)

  it('顶层目录必须带 name（否则 addRoute 会被静默跳过）', () => {
    routes.forEach((r) => expect(r.name, `${r.path} 缺少 name`).toBeTruthy())
  })

  it('顶层目录必须有 redirect，且指向真实存在的子页面', () => {
    expect(routes.length).toBeGreaterThan(0)
    routes.forEach((r) => {
      expect(r.redirect, `${r.path} 缺少 redirect，点它会白屏`).toBeTruthy()
      expect(leafPaths(r.children as RouteRecordRaw[], String(r.path))).toContain(r.redirect)
    })
  })

  it('直接访问目录地址 /system 会被重定向到第一个子页面', async () => {
    const router = createTestRouter()
    await router.push('/system')
    await router.isReady()
    expect(router.currentRoute.value.path).toBe('/system/user')
  })

  it('未知路径落到 404 兜底，而不是渲染空白', async () => {
    const router = createTestRouter()
    await router.push('/this-path-does-not-exist')
    await router.isReady()
    expect(router.currentRoute.value.path).toBe('/404')
  })

  it('每个业务页面的路由都能解析到（component 白名单命中）', () => {
    const paths = routes.flatMap((r) => leafPaths(r.children as RouteRecordRaw[], String(r.path)))
    expect(paths).toContain('/system/user')
    expect(paths).toContain('/monitor/server')
    expect(paths).toContain('/demo/crud')
    // 解析不到组件的菜单会被静默丢弃，数量对不上说明白名单漏了文件
    // 菜单叶子页共 18 个：系统管理 9 + 系统监控 5 + 系统工具 3 + 示例演示 1
    expect(paths.length).toBe(18)
  })
})

describe('菜单可见性语义', () => {
  it("visible='0' 显示、'1' 隐藏（RuoYi 约定，写反会整棵菜单消失）", () => {
    expect(isMenuVisible({ type: 'C', visible: '0' })).toBe(true)
    expect(isMenuVisible({ type: 'C', visible: '1' })).toBe(false)
    expect(isMenuVisible({ type: 'F', visible: '0' })).toBe(false)
  })

  it('过滤后仍保留目录及其子菜单', () => {
    const visible = filterVisibleMenus(menus)
    expect(visible.length).toBe(4)
    expect(visible[0].children?.length).toBe(9)
  })
})
