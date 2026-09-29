import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useTenantStore } from '@/stores/modules/tenant'
import type { TenantInfo } from '@/types'

/**
 * 回归用例：租户列表的归一化。
 *
 * 线上出过这个崩溃 —— tenants 被持久化成「分页对象」后水合回 state，
 * Navbar 里的 `.filter` 抛 TypeError，把整页渲染打断（表现为白屏）。
 * 根因是「服务端返回结构」直接进了 state，所以 options getter
 * 必须对任意结构都稳定返回数组，而不是在调用点各自防御。
 */
describe('tenant store · options getter', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('正常数组原样返回，并过滤掉缺 tenantId 的项', () => {
    const store = useTenantStore()
    store.tenants = [
      { tenantId: '1', tenantName: 'A' },
      { tenantName: '没有 tenantId 的脏项' }
    ] as unknown as TenantInfo[]

    expect(store.options.map((t) => t.tenantId)).toEqual(['1'])
  })

  it('分页对象（{ list, total }）也能归一化成数组', () => {
    const store = useTenantStore()
    ;(store as unknown as { tenants: unknown }).tenants = {
      list: [{ tenantId: '1', tenantName: 'A' }],
      total: 3
    }

    expect(Array.isArray(store.options)).toBe(true)
    expect(store.options).toHaveLength(1)
  })

  it('其它畸形结构退化为空数组，而不是抛错', () => {
    const store = useTenantStore()
    ;(store as unknown as { tenants: unknown }).tenants = { tenantId: '1' }

    expect(store.options).toEqual([])
  })
})
