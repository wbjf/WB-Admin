import { ref } from 'vue'
import type { PageResult } from '@/types'

export interface UseTableOptions<T> {
  api: (params: Record<string, any>) => Promise<PageResult<T>>
  params?: Record<string, any>
  defaultPageSize?: number
  immediate?: boolean
}

/** 轻量列表请求（不需要完整 CRUD 时使用） */
export function useTable<T = any>(options: UseTableOptions<T>) {
  const list = ref<T[]>([]) as any
  const total = ref(0)
  const loading = ref(false)
  const pageNum = ref(1)
  const pageSize = ref(options.defaultPageSize ?? 10)
  const params = ref<Record<string, any>>({ ...(options.params ?? {}) })

  async function load(extra: Record<string, any> = {}): Promise<void> {
    loading.value = true
    try {
      const res = await options.api({
        ...params.value,
        ...extra,
        pageNum: pageNum.value,
        pageSize: pageSize.value
      })
      list.value = res?.list ?? []
      total.value = res?.total ?? 0
    } catch {
      list.value = []
      total.value = 0
    } finally {
      loading.value = false
    }
  }

  function reset(extra: Record<string, any> = {}): void {
    pageNum.value = 1
    load(extra)
  }

  if (options.immediate !== false) void load()

  return { list, total, loading, pageNum, pageSize, params, load, reset }
}

export default useTable
