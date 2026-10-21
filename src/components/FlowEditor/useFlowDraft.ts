import { ref, type Ref } from 'vue'
import type { FlowGraph } from '@/types'
import { useUserStore } from '@/stores/modules/user'
import { migrateFlow } from './serialize'

const DB_NAME = 'wb-admin-flow'
const DB_VERSION = 1
const STORE = 'drafts'
const LS_PREFIX = 'wb-admin:flow-draft:'

export interface DraftRecord {
  key: string
  graph: FlowGraph
  savedAt: number
}

let dbPromise: Promise<IDBDatabase | null> | null = null

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null)
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'key' })
      }
      req.onsuccess = () => resolve(req.result)
      // 打开失败一律降级：草稿写不了，但编辑器要能继续用
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
  return dbPromise
}

function tx<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T | null> {
  return openDb().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (!db) return resolve(null)
        try {
          const t = db.transaction(STORE, mode)
          const req = run(t.objectStore(STORE))
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => resolve(null)
        } catch {
          resolve(null)
        }
      })
  )
}

function currentUser(): string {
  try {
    return String(useUserStore().userId || 'guest')
  } catch {
    // pinia 未激活（单测 / 未登录）时降级
    return 'guest'
  }
}

export interface UseFlowDraftOptions {
  flowId: string
  /** 'indexeddb' | 'local' | false */
  medium: 'indexeddb' | 'local' | false
  debounce?: number
  onSaved?: (at: number) => void
}

/**
 * 本地草稿。
 *
 * 为什么必须有：`AppMain.vue` 没有 KeepAlive，切走页面组件就销毁，
 * 「没画完切走不丢」只能靠落盘。缩略图是 base64，所以默认走 IndexedDB
 * （localStorage 5MB 配额容易满，且同步写会卡 UI）。
 * 所有读写都包 try/catch —— 持久化失败只影响草稿，不能让编辑器崩。
 */
export function useFlowDraft(opts: UseFlowDraftOptions) {
  const key = `${LS_PREFIX}${currentUser()}:${opts.flowId || 'new'}`
  const lastSavedAt = ref<number>(0)
  const restored = ref(false)
  const saving = ref(false)
  let timer: ReturnType<typeof setTimeout> | null = null
  let pending: FlowGraph | null = null
  let bound = false

  function clearTimer(): void {
    if (timer) clearTimeout(timer)
    timer = null
  }

  async function writeNow(graph: FlowGraph): Promise<void> {
    pending = null
    // 存纯数据：不能把 Vue 的响应式 proxy 交给 IndexedDB（结构化克隆会失败）
    const plain = JSON.parse(JSON.stringify(graph)) as FlowGraph
    const record: DraftRecord = { key, graph: plain, savedAt: Date.now() }
    try {
      if (opts.medium === 'indexeddb') {
        await tx('readwrite', (s) => s.put(record) as IDBRequest<IDBValidKey>)
      } else if (opts.medium === 'local') {
        // localStorage 兜底：缩略图可能很大，写失败就丢掉缩略图再试一次
        try {
          localStorage.setItem(key, JSON.stringify(record))
        } catch {
          const slim: DraftRecord = {
            ...record,
            graph: { ...graph, meta: { ...graph.meta, thumbnail: '' } }
          }
          localStorage.setItem(key, JSON.stringify(slim))
        }
      }
      lastSavedAt.value = record.savedAt
      opts.onSaved?.(record.savedAt)
    } catch {
      /* 写失败不影响编辑 */
    } finally {
      saving.value = false
    }
  }

  function save(graph: FlowGraph, immediate = false): void {
    if (!opts.medium) return
    saving.value = true
    pending = graph
    clearTimer()
    if (immediate) {
      void writeNow(graph)
      return
    }
    timer = setTimeout(() => pending && void writeNow(pending), opts.debounce ?? 500)
  }

  function flush(): void {
    if (pending) {
      clearTimer()
      void writeNow(pending)
    }
  }

  async function load(): Promise<FlowGraph | null> {
    if (!opts.medium) return null
    try {
      let raw: DraftRecord | undefined
      if (opts.medium === 'indexeddb') {
        raw =
          (await tx<DraftRecord>('readonly', (s) => s.get(key) as IDBRequest<DraftRecord>)) ||
          undefined
      } else if (typeof localStorage !== 'undefined') {
        const text = localStorage.getItem(key)
        raw = text ? (JSON.parse(text) as DraftRecord) : undefined
      }
      if (!raw?.graph) return null
      lastSavedAt.value = raw.savedAt || 0
      restored.value = true
      return migrateFlow(raw.graph)
    } catch {
      return null
    }
  }

  async function remove(): Promise<void> {
    try {
      if (opts.medium === 'indexeddb') {
        await tx('readwrite', (s) => s.delete(key) as IDBRequest<undefined>)
      } else if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key)
      }
      lastSavedAt.value = 0
    } catch {
      /* ignore */
    }
  }

  /** 页面卸载 / 隐藏时强制落盘（只绑一次） */
  function bindFlushOnce(): void {
    if (bound || !opts.medium) return
    bound = true
    const handler = () => flush()
    window.addEventListener('pagehide', handler)
    window.addEventListener('beforeunload', handler)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush()
    })
  }

  function destroy(): void {
    clearTimer()
  }

  return { save, flush, load, remove, lastSavedAt, restored, saving, bindFlushOnce, destroy, key }
}

export type FlowDraftStore = ReturnType<typeof useFlowDraft>

/** 列表页用：清除某张图的草稿（保存成功后调用） */
export async function clearDraft(
  flowId: string,
  medium: 'indexeddb' | 'local' = 'indexeddb'
): Promise<void> {
  const key = `${LS_PREFIX}${currentUser()}:${flowId}`
  try {
    if (medium === 'indexeddb') {
      await tx('readwrite', (s) => s.delete(key) as IDBRequest<undefined>)
    } else if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key)
    }
  } catch {
    /* ignore */
  }
}

/** 列表页用：有哪些图存在未提交的草稿 */
export async function listDrafts(): Promise<DraftRecord[]> {
  try {
    const db = await openDb()
    if (!db) return []
    return (
      (await tx<DraftRecord[]>('readonly', (s) => s.getAll() as IDBRequest<DraftRecord[]>)) || []
    )
  } catch {
    return []
  }
}

export type { Ref }
