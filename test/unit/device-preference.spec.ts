import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import type { DeviceFavoriteRecord } from '@/types'
import {
  configureDevicePreference,
  createLocalAdapter,
  flushDevicePreference,
  GUEST_USER,
  resetDevicePreferenceForTest,
  useDevicePreference,
  type PreferenceAdapter
} from '@/composables/useDevicePreference'

interface MemAdapter extends PreferenceAdapter {
  store: Map<string, any[]>
}

/** 内存适配器：把读写全部拦下来，便于断言「到底存了什么、存给谁」 */
function memoryAdapter(): MemAdapter {
  const store = new Map<string, any[]>()
  return {
    store,
    load: (userId: string) => store.get(userId) ?? [],
    save: (userId: string, records: any[]) => {
      store.set(userId, [...records])
    }
  }
}

const KEY_PREFIX = 'wb-admin:device-favorite'

describe('useDevicePreference', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useRealTimers()
    resetDevicePreferenceForTest()
  })

  it('新增 / 取消 / 重复新增都幂等', () => {
    const api = useDevicePreference({ userId: 'u1' })
    expect(api.add({ id: 'd1', name: '空压机' })).toBe(true)
    expect(api.add({ id: 'd1' })).toBe(false) // 已经收藏过
    expect(api.count.value).toBe(1)
    expect(api.isFavorite('d1')).toBe(true)

    expect(api.toggle({ id: 'd1' })).toBe(true) // toggle 返回「操作是否生效」
    expect(api.isFavorite('d1')).toBe(false)
    expect(api.remove('d1')).toBe(false) // 再删一次没有东西可删
  })

  it('最近收藏的排在最前面', () => {
    const api = useDevicePreference({ userId: 'u1' })
    api.add({ id: 'a' })
    api.add({ id: 'b' })
    expect(api.favorites.value.map((r) => r.id)).toEqual(['b', 'a'])
  })

  it('防抖写入：300ms 后才落盘', () => {
    vi.useFakeTimers()
    const adapter = memoryAdapter()
    configureDevicePreference({ adapter })
    const api = useDevicePreference({ userId: 'u1' })
    api.add({ id: 'd1' })
    expect(adapter.store.size).toBe(0)

    vi.advanceTimersByTime(301)
    expect(adapter.store.get('u1')?.map((r) => r.id)).toEqual(['d1'])
    vi.useRealTimers()
  })

  it('按 userId 隔离：换账号看到的是自己的数据，且旧账号的改动不丢', async () => {
    const adapter = memoryAdapter()
    adapter.store.set('u1', [{ id: 'A1', name: 'u1 的设备' }])
    adapter.store.set('u2', [{ id: 'B1', name: 'u2 的设备' }])
    configureDevicePreference({ adapter })

    const userId = ref('u1')
    const api = useDevicePreference({ userId })
    await flushPromises()
    expect(api.favorites.value.map((r) => r.id)).toEqual(['A1'])

    userId.value = 'u2'
    await nextTick()
    await flushPromises()
    expect(api.favorites.value.map((r) => r.id)).toEqual(['B1'])
    expect(adapter.store.get('u1')?.map((r) => r.id)).toEqual(['A1'])
  })

  it('prune 只清理当前已不存在的收藏，并返回清理条数', () => {
    const api = useDevicePreference({ userId: 'u1' })
    api.add({ id: 'keep' })
    api.add({ id: 'gone' })
    expect(api.prune(['keep'])).toBe(1)
    expect(api.favorites.value.map((r) => r.id)).toEqual(['keep'])
  })

  it('clear 清空并返回数量', () => {
    const api = useDevicePreference({ userId: 'u1' })
    api.add({ id: 'a' })
    api.add({ id: 'b' })
    expect(api.clear()).toBe(2)
    expect(api.count.value).toBe(0)
  })
})

describe('createLocalAdapter', () => {
  beforeEach(() => {
    localStorage.clear()
    resetDevicePreferenceForTest()
  })

  it('写入内容带版本号，key 里带 userId', () => {
    const adapter = createLocalAdapter()
    adapter.save('u9', [{ id: 'd1' }])
    const raw = localStorage.getItem(`${KEY_PREFIX}:u9`)
    expect(raw).toBeTruthy()
    const parsed = JSON.parse(raw!)
    expect(parsed.version).toBe(1)
    expect(parsed.favorites[0].id).toBe('d1')
  })

  it('未登录落到 guest 桶，不和真人共用', () => {
    const adapter = createLocalAdapter()
    adapter.save('', [{ id: 'anonymous' }])
    expect(localStorage.getItem(`${KEY_PREFIX}:${GUEST_USER}`)).toBeTruthy()
  })

  it('坏 JSON / 旧版本结构都被当成空数据，不抛异常', () => {
    localStorage.setItem(`${KEY_PREFIX}:u1`, '{不是 json')
    expect(() => createLocalAdapter().load('u1')).not.toThrow()
    expect(createLocalAdapter().load('u1')).toEqual([])

    localStorage.setItem(
      `${KEY_PREFIX}:u1`,
      JSON.stringify({ version: 99, favorites: [{ id: 'x' }] })
    )
    expect(createLocalAdapter().load('u1')).toEqual([])
  })

  it('去重并丢弃没有 id 的脏记录', () => {
    localStorage.setItem(
      `${KEY_PREFIX}:u1`,
      JSON.stringify({ version: 1, favorites: [{ id: 'a' }, { id: 'a' }, { name: '没id' }, null] })
    )
    const loaded = createLocalAdapter().load('u1') as DeviceFavoriteRecord[]
    expect(loaded.map((r) => r.id)).toEqual(['a'])
  })

  it('localStorage 抛异常时保存不能冒泡（隐私模式 / 配额满）', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    const adapter = createLocalAdapter()
    expect(() => adapter.save('u1', [{ id: 'd1' }])).not.toThrow()
    spy.mockRestore()
  })
})

describe('容错', () => {
  beforeEach(() => {
    localStorage.clear()
    resetDevicePreferenceForTest()
  })

  it('flush 在 adapter 抛错时也不冒泡', () => {
    configureDevicePreference({
      adapter: {
        load: () => [],
        save: () => {
          throw new Error('boom')
        }
      }
    })
    const api = useDevicePreference({ userId: 'u1' })
    expect(() => api.flush()).not.toThrow()
  })

  it('load 抛错时退化为空集合，ready 仍为 true', async () => {
    configureDevicePreference({
      adapter: {
        load: () => {
          throw new Error('network down')
        },
        save: () => undefined
      }
    })
    const api = useDevicePreference({ userId: 'u1' })
    await flushPromises()
    expect(api.favorites.value).toEqual([])
    expect(api.ready.value).toBe(true)
  })

  it('切换用户时慢请求不会覆盖新用户的数据', async () => {
    let resolveU1: (v: any[]) => void = () => undefined
    configureDevicePreference({
      adapter: {
        load: (userId: string) =>
          userId === 'u1'
            ? new Promise((r) => {
                resolveU1 = r
              })
            : [{ id: 'new-user-item' }],
        save: () => undefined
      }
    })

    const userId = ref('u1')
    const api = useDevicePreference({ userId })
    await nextTick()
    userId.value = 'u2'
    await nextTick()
    await flushPromises()
    expect(api.favorites.value.map((r) => r.id)).toEqual(['new-user-item'])

    // u1 的慢请求这时候才回来：必须被丢弃，否则 u2 会看见 u1 的收藏
    resolveU1([{ id: 'stale-item' }])
    await flushPromises()
    expect(api.favorites.value.map((r) => r.id)).toEqual(['new-user-item'])
  })

  it('resetDevicePreferenceForTest 后回到干净状态', () => {
    const api = useDevicePreference({ userId: 'u1' })
    api.add({ id: 'tmp' })
    resetDevicePreferenceForTest()
    expect(api.count.value).toBe(0)
    expect(() => flushDevicePreference()).not.toThrow()
  })
})
