import dayjs from 'dayjs'

export interface TreeOptions {
  id?: string
  parentId?: string
  children?: string
  rootValue?: string | number | null
}

/**
 * 把「分页对象 / 纯数组 / null」统一成数组。
 * 列表接口在真实后端里有的返回 `{list,total}`、有的直接返回数组，
 * 缺了这层归一化就会出现 `list.map is not a function` 这类运行时崩溃。
 */
export function toArray<T = any>(res: unknown, listKey = 'list'): T[] {
  if (Array.isArray(res)) return res as T[]
  if (res && typeof res === 'object') {
    const v = (res as Record<string, any>)[listKey]
    if (Array.isArray(v)) return v as T[]
    const rows = (res as Record<string, any>).rows
    if (Array.isArray(rows)) return rows as T[]
    const data = (res as Record<string, any>).data
    if (Array.isArray(data)) return data as T[]
  }
  return []
}

/** 扁平数组 → 树 */
export function buildTree<T extends Record<string, any>>(
  list: T[],
  options: TreeOptions = {}
): T[] {
  const { id = 'id', parentId = 'parentId', children = 'children', rootValue = '0' } = options
  const map = new Map<string, T>()
  const roots: T[] = []
  // 入参可能是分页对象或 null，先归一化，避免 .map 崩溃
  const safe = Array.isArray(list) ? list : toArray<T>(list)
  const clone = safe.map((item) => ({ ...item }))
  clone.forEach((item) => {
    map.set(String((item as any)[id]), item)
    ;(item as any)[children] = []
  })
  clone.forEach((item) => {
    const pid = String((item as any)[parentId])
    const parent = map.get(pid)
    if (parent && pid !== String((item as any)[id])) {
      ;((parent as any)[children] as T[]).push(item)
    } else if (pid === String(rootValue) || (!parent && rootValue === null)) {
      roots.push(item)
    } else if (!parent) {
      roots.push(item)
    }
  })
  const strip = (nodes: T[]): T[] =>
    nodes.map((n) => {
      const kids = ((n as any)[children] as T[]) ?? []
      const copy = { ...n }
      ;(copy as any)[children] = strip(kids)
      return copy
    })
  const result = strip(roots)
  const clean = (nodes: T[]) => {
    nodes.forEach((n) => {
      if (Array.isArray((n as any)[children]) && (n as any)[children].length === 0) {
        delete (n as any)[children]
      } else {
        clean((n as any)[children])
      }
    })
  }
  clean(result)
  return result
}

/** 树 → 扁平数组 */
export function flattenTree<T extends Record<string, any>>(tree: T[], children = 'children'): T[] {
  const out: T[] = []
  const walk = (nodes: T[]) => {
    nodes.forEach((n) => {
      out.push(n)
      const kids = (n as any)[children]
      if (Array.isArray(kids) && kids.length) walk(kids)
    })
  }
  walk(tree)
  return out
}

/** 在树中查找节点 */
export function findTreeNode<T extends Record<string, any>>(
  tree: T[],
  predicate: (node: T) => boolean,
  children = 'children'
): T | undefined {
  for (const node of tree) {
    if (predicate(node)) return node
    const kids = (node as any)[children]
    if (Array.isArray(kids)) {
      const hit = findTreeNode(kids, predicate, children)
      if (hit) return hit
    }
  }
  return undefined
}

/** 取某节点的父链 */
export function findTreePath<T extends Record<string, any>>(
  tree: T[],
  predicate: (node: T) => boolean,
  children = 'children'
): T[] {
  const path: T[] = []
  const walk = (nodes: T[]): boolean => {
    for (const node of nodes) {
      path.push(node)
      if (predicate(node)) return true
      const kids = (node as any)[children]
      if (Array.isArray(kids) && walk(kids)) return true
      path.pop()
    }
    path.pop()
    return false
  }
  walk(tree)
  return path
}

export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map((i) => deepClone(i)) as unknown as T
  const res: Record<string, any> = {}
  Object.keys(obj as Record<string, any>).forEach((k) => {
    res[k] = deepClone((obj as Record<string, any>)[k])
  })
  return res as T
}

export function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export const formatTime = (v?: string | number | Date, pattern = 'YYYY-MM-DD HH:mm:ss') =>
  v ? dayjs(v).format(pattern) : ''

/** 相对时间 */
export function formatRelative(v?: string | number | Date): string {
  if (!v) return ''
  const diff = dayjs().diff(dayjs(v), 'minute')
  if (diff < 1) return '刚刚'
  if (diff < 60) return `${diff} 分钟前`
  if (diff < 1440) return `${Math.floor(diff / 60)} 小时前`
  if (diff < 43200) return `${Math.floor(diff / 1440)} 天前`
  return dayjs(v).format('YYYY-MM-DD')
}

/** 把日期范围拆成 beginTime / endTime 注入查询参数 */
export function addDateRange<P extends Record<string, any>>(
  params: P,
  dateRange?: [any, any] | null,
  beginKey = 'beginTime',
  endKey = 'endTime',
  pattern = 'YYYY-MM-DD'
): P {
  if (!dateRange || dateRange.length !== 2 || !dateRange[0]) return params
  return {
    ...params,
    [beginKey]: dayjs(dateRange[0]).format(pattern),
    [endKey]: dayjs(dateRange[1]).format(pattern)
  }
}

/** 去空参数 */
export function pruneParams<T extends Record<string, any>>(params: T): Partial<T> {
  const out: Record<string, any> = {}
  Object.keys(params).forEach((k) => {
    const v = params[k]
    if (v !== undefined && v !== null && v !== '') out[k] = v
  })
  return out as Partial<T>
}

/** 文件字节数格式化 */
export function formatSize(bytes?: number): string {
  if (!bytes && bytes !== 0) return '-'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let size = bytes
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024
    i++
  }
  return `${size.toFixed(1)} ${units[i]}`
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/** 千分位 */
export function toThousands(v: number | string, digits = 2): string {
  const n = Number(v)
  if (Number.isNaN(n)) return '-'
  return n.toLocaleString('zh-CN', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}
