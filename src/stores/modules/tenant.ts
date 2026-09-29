import { defineStore } from 'pinia'
import type { TenantInfo } from '@/types'
import { listTenants, getTenantDetail } from '@/api/tenant'
import { setTenantId, getTenantId } from '@/utils/auth'
import { toArray } from '@/utils'
import { ElMessage } from 'element-plus'
import { t } from '@/locales'

/** 多租户：租户列表 + 当前租户上下文 */
export const useTenantStore = defineStore('wb-tenant', {
  state: () => ({
    tenants: [] as TenantInfo[],
    currentId: getTenantId(),
    current: null as TenantInfo | null,
    enabled: import.meta.env.VITE_ENABLE_TENANT === 'true',
    loaded: false
  }),
  getters: {
    currentName(state): string {
      return state.current?.tenantName ?? ''
    },
    isExpired(state): boolean {
      if (!state.current?.expireTime) return false
      return new Date(state.current.expireTime).getTime() < Date.now()
    },
    /**
     * 租户下拉选项 —— 界面上取租户列表的唯一入口。
     *
     * 这里必须用 toArray 兜底，不能直接返回 state.tenants：
     * 该字段早期参与过持久化，旧版本把分页对象（{ list, total }）写进了 localStorage，
     * 水合后 `.filter` 会抛 TypeError，把 Navbar 的渲染整个打断（表现是整页空白）。
     * 历史脏数据在代码侧清不掉，所以这里做无条件归一化，而不是在调用点各自防御。
     */
    options(state): TenantInfo[] {
      return toArray<TenantInfo>(state.tenants).filter((it) => Boolean(it?.tenantId))
    }
  },
  actions: {
    async loadTenants(): Promise<TenantInfo[]> {
      if (this.loaded && this.options.length) return this.options
      this.tenants = toArray<TenantInfo>(await listTenants())
      this.loaded = true
      // 刷新后 current 会丢，用列表回填一次，避免租户名显示为空
      if (this.currentId) {
        this.current = this.options.find((it) => it.tenantId === this.currentId) ?? null
      }
      return this.tenants
    },
    async setCurrent(id: string): Promise<void> {
      this.currentId = id
      setTenantId(id)
      if (id) {
        this.current = await getTenantDetail(id)
      } else {
        this.current = null
      }
      ElMessage.success(t('tenant.switched'))
      window.dispatchEvent(new CustomEvent('tenant-changed', { detail: id }))
    },
    reset() {
      this.currentId = ''
      this.current = null
      this.tenants = []
      this.loaded = false
      setTenantId('')
    }
  },
  persist: {
    key: 'wb-admin-tenant',
    /**
     * 只持久化「当前选中租户」。
     * tenants 是可随时重新拉取的服务端列表：持久化它只会让旧版本的数据结构
     * 一直活在用户浏览器里，而 state 里存着非预期结构，迟早会在某个 computed 里炸掉。
     */
    pick: ['currentId']
  }
})
