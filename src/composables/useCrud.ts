import { reactive, ref, shallowRef } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { PageResult } from '@/types'
import { t } from '@/locales'

export type CrudMode = 'add' | 'edit' | 'detail'

export interface CrudConfig<T = any> {
  listApi: (params: Record<string, any>) => Promise<PageResult<T>>
  detailApi?: (id: string) => Promise<T>
  addApi?: (data: Partial<T>) => Promise<any>
  updateApi?: (data: Partial<T>) => Promise<any>
  delApi?: (ids: string) => Promise<any>
  /** 主键字段名，默认 id */
  pk?: string
  /** 固定查询参数 */
  params?: Record<string, any>
  /** 新增后是否自动刷新 */
  refreshOnSave?: boolean
  /** 删除提示文案 */
  deleteTip?: string
}

/**
 * 标准 CRUD 逻辑封装
 * 一个页面 = useCrud(...) + ProTable + ProDialog，其余都是差异业务
 */
export function useCrud<T extends Record<string, any> = any>(config: CrudConfig<T>) {
  const pk = config.pk ?? 'id'
  const tableRef = shallowRef<any>(null)
  const list = ref<T[]>([]) as any
  const total = ref(0)
  const loading = ref(false)
  const selected = ref<T[]>([])
  const visible = ref(false)
  const submitting = ref(false)
  const mode = ref<CrudMode>('add')
  const formData = reactive<Record<string, any>>({})

  const titleMap: Record<CrudMode, string> = {
    add: t('common.add'),
    edit: t('common.edit'),
    detail: t('common.detail')
  }
  const title = ref(titleMap.add)

  /** 交给 ProTable 的 request */
  async function query(params: Record<string, any>): Promise<{ list: T[]; total: number }> {
    loading.value = true
    try {
      const res = await config.listApi({ ...config.params, ...params })
      list.value = res?.list ?? []
      total.value = res?.total ?? 0
      return { list: list.value, total: total.value }
    } catch {
      return { list: [], total: 0 }
    } finally {
      loading.value = false
    }
  }

  function reload(): void {
    tableRef.value?.reload?.()
  }

  function refresh(): void {
    tableRef.value?.refresh?.()
  }

  function setParam(key: string, value: any): void {
    ;(config.params as Record<string, any>)[key] = value
  }

  function resetForm(row?: Partial<T>): void {
    Object.keys(formData).forEach((k) => delete formData[k])
    if (row) Object.assign(formData, row)
  }

  function openAdd(row: Partial<T> = {}): void {
    mode.value = 'add'
    title.value = titleMap.add
    resetForm(row)
    visible.value = true
  }

  async function openEdit(row: T | string): Promise<void> {
    mode.value = 'edit'
    title.value = titleMap.edit
    if (typeof row === 'string' && config.detailApi) {
      const data = await config.detailApi(row)
      resetForm(data)
    } else if (typeof row === 'object') {
      if (row[pk] && config.detailApi) {
        const data = await config.detailApi(row[pk])
        resetForm(data)
      } else {
        resetForm(row)
      }
    } else {
      resetForm()
    }
    visible.value = true
  }

  async function openDetail(row: T | string): Promise<void> {
    mode.value = 'detail'
    title.value = titleMap.detail
    const id = typeof row === 'string' ? row : row?.[pk]
    if (id && config.detailApi) {
      const data = await config.detailApi(id)
      resetForm(data)
    } else if (typeof row === 'object') {
      resetForm(row)
    }
    visible.value = true
  }

  async function submit(): Promise<boolean> {
    const api = mode.value === 'edit' ? config.updateApi : config.addApi
    if (!api) {
      ElMessage.warning('未配置提交接口')
      return false
    }
    submitting.value = true
    try {
      await api({ ...formData } as Partial<T>)
      ElMessage.success(t('common.success'))
      visible.value = false
      if (config.refreshOnSave !== false) reload()
      return true
    } catch (e: any) {
      ElMessage.error(e?.message || t('common.failed'))
      return false
    } finally {
      submitting.value = false
    }
  }

  async function remove(ids?: string | string[]): Promise<boolean> {
    const target = Array.isArray(ids) ? ids : ids ? [ids] : selected.value.map((r: any) => r[pk])
    if (!target.length) {
      ElMessage.warning(t('common.selectAtLeastOne'))
      return false
    }
    if (!config.delApi) return false
    try {
      await ElMessageBox.confirm(config.deleteTip || t('common.confirmDelete'), t('common.tip'), {
        type: 'warning',
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel')
      })
    } catch {
      return false
    }
    try {
      await config.delApi(target.join(','))
      ElMessage.success(t('common.success'))
      reload()
      return true
    } catch (e: any) {
      ElMessage.error(e?.message || t('common.failed'))
      return false
    }
  }

  function onSelectionChange(rows: T[]): void {
    selected.value = rows
  }

  return {
    tableRef,
    list,
    total,
    loading,
    selected,
    visible,
    submitting,
    mode,
    title,
    formData,
    query,
    reload,
    refresh,
    setParam,
    openAdd,
    openEdit,
    openDetail,
    submit,
    remove,
    onSelectionChange,
    clearSelection: () => tableRef.value?.clearSelection?.()
  }
}

export default useCrud
