import {
  computed,
  ref,
  toValue,
  watch,
  type ComputedRef,
  type MaybeRefOrGetter,
  type Ref
} from 'vue'
import { useUserStore } from '@/stores/modules/user'
import type { DeviceFavoriteRecord, DeviceItem } from '@/types'

/**
 * 设备偏好（收藏）能力。
 *
 * ## 三条设计约束
 * 1. **按登录人隔离**：key 里必须带 userId，否则 A 登出 B 登录会直接看到 A 的收藏。
 *    未登录时落到 `guest` 桶，不跟任何真人混在一起。
 * 2. **存储可替换**：读写全部走 `PreferenceAdapter`。现在是 localStorage，
 *    将来接后端只要 `configureDevicePreference({ adapter: remoteAdapter })`，组件无感。
 * 3. **宁可降级也不能抛错**：localStorage 在隐私模式、配额满、跨域 iframe 下都可能直接抛，
 *    而这个模块会在 app 初始化的早期被调用，一次未捕获异常就是整页白屏。
 *    所以下面每一处读写都包了 try/catch。
 *
 * ## 为什么允许「失效收藏项」存在
 * 设备被删、或当前用户被收回了某区域的权限之后，收藏项在原树里就查不到了。
 * 如果此时静默丢弃，用户的感受是「我的收藏自己消失了」——比留着更糟。
 * 所以记录里保留一份 name 快照，查不到时渲染成「已失效」，由用户自己点掉。
 */

const STORAGE_KEY_PREFIX = 'wb-admin:device-favorite'
/** 数据格式版本：将来字段改了按版本迁移或丢弃，不要拿旧结构硬解析 */
const SCHEMA_VERSION = 1
/** 未登录用户的归档桶 */
export const GUEST_USER = 'guest'
const SAVE_DEBOUNCE = 300

export interface PreferenceAdapter {
  load(userId: string): DeviceFavoriteRecord[] | null | Promise<DeviceFavoriteRecord[] | null>
  save(userId: string, records: DeviceFavoriteRecord[]): void | Promise<void>
}

interface StoredShape {
  version?: number
  favorites?: DeviceFavoriteRecord[]
}

function keyOf(userId: string, prefix = STORAGE_KEY_PREFIX): string {
  return `${prefix}:${userId || GUEST_USER}`
}

/** 把任意来源的数据洗成合法记录：去空、去重、补时间戳 */
function normalize(list: unknown): DeviceFavoriteRecord[] {
  if (!Array.isArray(list)) return []
  const seen = new Set<string>()
  const out: DeviceFavoriteRecord[] = []
  for (const raw of list as any[]) {
    const id = String(raw?.id ?? '').trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push({
      id,
      name: raw?.name == null ? undefined : String(raw.name),
      areaId: raw?.areaId == null ? undefined : String(raw.areaId),
      addedAt: Number.isFinite(Number(raw?.addedAt)) ? Number(raw.addedAt) : Date.now()
    })
  }
  return out
}

/**
 * 默认的 localStorage 适配器。
 *
 * 读到的结构一律当作「不可信」处理：手改 devtools、旧版本写的数据、
 * 别的库占用同一个 key，都可能让 `JSON.parse` 出来的东西不符合预期。
 */
export function createLocalAdapter(prefix = STORAGE_KEY_PREFIX): PreferenceAdapter {
  return {
    load(userId) {
      try {
        const raw = localStorage.getItem(keyOf(userId, prefix))
        if (!raw) return []
        const parsed = JSON.parse(raw) as StoredShape
        if (!parsed || typeof parsed !== 'object') return []
        // 版本不一致时宁可丢：错误的字段结构会让后面所有 UI 判空逻辑失真
        if (parsed.version !== SCHEMA_VERSION) return []
        return normalize(parsed.favorites)
      } catch {
        return []
      }
    },
    save(userId, records) {
      try {
        const payload: StoredShape = { version: SCHEMA_VERSION, favorites: records }
        localStorage.setItem(keyOf(userId, prefix), JSON.stringify(payload))
      } catch {
        /* 隐私模式 / 配额耗尽：偏好只是锦上添花，不能因此中断业务流程 */
      }
    }
  }
}

let adapter: PreferenceAdapter = createLocalAdapter()

const records = ref<DeviceFavoriteRecord[]>([])
const ready = ref(false)
const currentUser = ref<string>(GUEST_USER)
let saveTimer: ReturnType<typeof setTimeout> | null = null
let bound = false
/** 用户监听只绑一次：多处调用本 composable 时不应重复挂 watcher（切换用户会被触发多次） */
let userWatchBound = false
/** 加载序号：切换用户时防止「慢的旧请求」后到覆盖了新用户的数据 */
let loadSeq = 0

function cancelScheduledSave(): void {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
}

/** 立刻落盘（对外暴露，切换账号 / 关页面前必须调用） */
export function flushDevicePreference(): void {
  cancelScheduledSave()
  try {
    adapter.save(currentUser.value, records.value.slice())
  } catch {
    /* 适配器是外部代码，写失败不能冒泡 */
  }
}

function scheduleSave(): void {
  cancelScheduledSave()
  saveTimer = setTimeout(() => {
    saveTimer = null
    flushDevicePreference()
  }, SAVE_DEBOUNCE)
}

async function loadFor(userId: string): Promise<void> {
  const seq = ++loadSeq
  currentUser.value = userId || GUEST_USER
  ready.value = false
  cancelScheduledSave()
  let list: DeviceFavoriteRecord[] = []
  try {
    list = normalize(await adapter.load(currentUser.value))
  } catch {
    // 加载失败就用空集合，界面照常渲染，不能让偏好功能拖垮整个树
    list = []
  }
  if (seq !== loadSeq) return // 期间又切了用户，本次结果作废
  records.value = list
  // 放在赋值之后：await 期间可能在 init 早期被调用ready过早为 true 会让 UI 读到空列表
  ready.value = true
}

function onBeforeUnload(): void {
  flushDevicePreference()
}

function onVisibilityChange(): void {
  if (document.visibilityState === 'hidden') flushDevicePreference()
}

/** 跨标签页同步：另一个标签点了收藏，这边要跟着变 */
function onStorage(e: StorageEvent): void {
  if (!e.key || e.key !== keyOf(currentUser.value)) return
  try {
    const parsed = JSON.parse(e.newValue ?? '') as StoredShape
    if (!parsed || parsed.version !== SCHEMA_VERSION) return
    records.value = normalize(parsed.favorites)
  } catch {
    /* 别的标签页写入了脏数据，保留当前内存中的值 */
  }
}

function bindGlobalOnce(): void {
  if (bound || typeof window === 'undefined') return
  bound = true
  // pagehide 比 beforeunload 更可靠（iOS Safari 经常不触发后者）
  window.addEventListener('pagehide', onBeforeUnload)
  window.addEventListener('beforeunload', onBeforeUnload)
  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('storage', onStorage)
}

/** 换适配器（接后端时调用一次） */
export function configureDevicePreference(options: { adapter?: PreferenceAdapter }): void {
  if (options.adapter) {
    flushDevicePreference()
    adapter = options.adapter
    if (ready.value) void loadFor(currentUser.value)
  }
}

export interface UseDevicePreferenceOptions {
  /**
   * 用户标识的来源。默认取登录用户的 userId。
   * 传字符串、ref 或 getter 都行，方便在无 pinia 的环境（单测、嵌入式组件）里使用。
   */
  userId?: MaybeRefOrGetter<string>
  /** 切换用户时是否自动重新加载，默认 true */
  followUser?: boolean
}

export interface DevicePreferenceApi {
  /** 收藏记录列表（最近收藏的排前面） */
  favorites: Ref<DeviceFavoriteRecord[]>
  /** id 集合，供模板 / 计算属性做 O(1) 判定 */
  favoriteIds: ComputedRef<Set<string>>
  count: ComputedRef<number>
  ready: Ref<boolean>
  /** 当前归档在哪个用户桶下（调试 / 排查用） */
  owner: Ref<string>
  isFavorite: (id: string) => boolean
  add: (device: Pick<DeviceItem, 'id'> & Partial<DeviceItem>) => boolean
  remove: (id: string) => boolean
  toggle: (device: Pick<DeviceItem, 'id'> & Partial<DeviceItem>) => boolean
  /**
   * 按「当前真实存在的设备 id」清理失效收藏。
   * @returns 被清理掉的数量
   */
  prune: (validIds: Iterable<string>) => number
  clear: () => number
  /** 立刻落盘 */
  flush: () => void
}

export function useDevicePreference(options: UseDevicePreferenceOptions = {}): DevicePreferenceApi {
  bindGlobalOnce()

  const resolveUser = (): string => {
    if (options.userId !== undefined) return String(toValue(options.userId) ?? '') || GUEST_USER
    try {
      // 用可选链而不是顶层 import 后直接读：pinia 未激活时 useUserStore() 会抛
      const store = useUserStore()
      return String(store?.userId ?? '') || GUEST_USER
    } catch {
      return GUEST_USER
    }
  }

  const followUser = options.followUser !== false

  if (!ready.value) void loadFor(resolveUser())

  if (followUser && !userWatchBound) {
    userWatchBound = true
    watch(resolveUser, (next, prev) => {
      if (next === prev) return
      flushDevicePreference() // 先把上一个用户的改动写回去，别丢
      void loadFor(next)
    })
  }

  const favoriteIds = computed(() => new Set(records.value.map((r) => r.id)))

  function isFavorite(id: string): boolean {
    return favoriteIds.value.has(String(id))
  }

  function add(device: Pick<DeviceItem, 'id'> & Partial<DeviceItem>): boolean {
    const id = String(device?.id ?? '').trim()
    if (!id || isFavorite(id)) return false
    records.value = [
      {
        id,
        name: device?.name,
        areaId: device?.areaId,
        addedAt: Date.now()
      },
      ...records.value
    ]
    scheduleSave()
    return true
  }

  function remove(id: string): boolean {
    const key = String(id)
    const next = records.value.filter((r) => r.id !== key)
    if (next.length === records.value.length) return false
    records.value = next
    scheduleSave()
    return true
  }

  function toggle(device: Pick<DeviceItem, 'id'> & Partial<DeviceItem>): boolean {
    return isFavorite(device?.id) ? remove(device.id) : add(device)
  }

  function prune(validIds: Iterable<string>): number {
    const valid = new Set(Array.from(validIds, String))
    const next = records.value.filter((r) => valid.has(r.id))
    const removed = records.value.length - next.length
    if (removed) {
      records.value = next
      scheduleSave()
    }
    return removed
  }

  function clear(): number {
    const n = records.value.length
    if (!n) return 0
    records.value = []
    scheduleSave()
    return n
  }

  return {
    favorites: records,
    favoriteIds,
    count: computed(() => records.value.length),
    ready,
    owner: currentUser,
    isFavorite,
    add,
    remove,
    toggle,
    prune,
    clear,
    flush: flushDevicePreference
  }
}

/** 测试用：清空内存状态与全局副作用 */
export function resetDevicePreferenceForTest(): void {
  cancelScheduledSave()
  loadSeq++
  userWatchBound = false
  records.value = []
  ready.value = false
  currentUser.value = GUEST_USER
  adapter = createLocalAdapter()
}
