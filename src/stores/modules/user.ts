import { defineStore } from 'pinia'
import { ElMessage } from 'element-plus'
import type { UserInfo, RoleInfo } from '@/types'
import { getToken, getTenantId, removeToken, setTenantId, setToken, setRefreshToken } from '@/utils/auth'
import { loginApi, logoutApi, getUserProfile, refreshTokenApi, smsLoginApi } from '@/api/auth'
import { t } from '@/locales'

export interface LoginForm {
  username: string
  password: string
  code?: string
  uuid?: string
  tenantId?: string
}

export const useUserStore = defineStore('wb-user', {
  state: () => ({
    token: getToken(),
    userId: '' as string,
    userName: '' as string,
    nickName: '' as string,
    avatar: '' as string,
    email: '' as string,
    phonenumber: '' as string,
    deptId: '' as string,
    deptName: '' as string,
    roles: [] as RoleInfo[],
    permissions: [] as string[],
    currentRole: '' as string,
    tenantId: getTenantId(),
    isSuperAdmin: false,
    /**
     * 本次「页面会话」是否已经向后端拉过用户信息。
     * 权限是后端下发的派生数据，持久化里那份只是上次会话的快照：
     * 后端新增权限点后本机永远拿不到（要点退出重登才发现），后端收回权限本机也照样放行。
     * 所以每次进页面都重新拉一次，用这个标记避免同一个 SPA 会话内重复请求。
     * **故意不进 persist.pick** —— 它要表达的就是「这一次页面加载拉过了没」。
     */
    infoLoaded: false
  }),
  getters: {
    roleKeys(state): string[] {
      return state.roles.map((r) => r.roleKey)
    },
    displayName(state): string {
      return state.nickName || state.userName || 'WB-Admin'
    }
  },
  actions: {
    async login(form: LoginForm, remember = false) {
      const res = await loginApi(form)
      const accessToken = res.access_token ?? res.token ?? ''
      setToken(accessToken, remember)
      if (res.refresh_token) setRefreshToken(res.refresh_token)
      this.token = accessToken
      if (form.tenantId) this.setTenant(form.tenantId)
      ElMessage.success(t('login.success'))
      return accessToken
    },

    async smsLogin(phone: string, code: string) {
      const res = await smsLoginApi({ phonenumber: phone, code })
      const accessToken = res.access_token ?? res.token ?? ''
      setToken(accessToken, true)
      this.token = accessToken
      ElMessage.success(t('login.success'))
    },

    async refreshToken() {
      const res = await refreshTokenApi()
      const accessToken = res.access_token ?? res.token
      if (accessToken) {
        setToken(accessToken)
        this.token = accessToken
      }
      return accessToken
    },

    async loadUserInfo() {
      const info: UserInfo = await getUserProfile()
      this.setProfile(info)
      this.infoLoaded = true
      return info
    },

    setProfile(info: Partial<UserInfo>) {
      this.userId = info.userId ?? ''
      this.userName = info.userName ?? ''
      this.nickName = info.nickName ?? ''
      this.avatar = info.avatar ?? ''
      this.email = info.email ?? ''
      this.phonenumber = info.phonenumber ?? ''
      this.deptId = info.deptId ?? ''
      this.deptName = info.deptName ?? ''
      this.roles = info.roles ?? []
      this.permissions = info.permissions ?? []
      this.isSuperAdmin = info.isSuperAdmin ?? (info.roles ?? []).some((r) => r.roleKey === 'admin' || r.roleKey === 'superadmin')
      if (this.roles.length && !this.currentRole) this.currentRole = this.roles[0].roleKey
      if (info.tenantId) this.tenantId = info.tenantId
    },

    /** 多角色切换：切换后重新拉权并重进（保证路由干净） */
    async switchRole(roleKey: string) {
      if (!this.roleKeys.includes(roleKey)) return false
      this.currentRole = roleKey
      window.location.reload()
      return true
    },

    setTenant(tenantId: string) {
      this.tenantId = tenantId
      setTenantId(tenantId)
    },

    async logout() {
      try {
        await logoutApi()
      } catch {
        /* 后端可能已失效 */
      }
      this.resetState()
      removeToken()
    },

    resetState() {
      this.token = ''
      this.userId = ''
      this.userName = ''
      this.nickName = ''
      this.avatar = ''
      this.roles = []
      this.permissions = []
      this.currentRole = ''
      this.isSuperAdmin = false
      this.infoLoaded = false
    }
  },
  persist: {
    key: 'wb-admin-user',
    // permissions / roles / isSuperAdmin 只是「上次会话的快照」，用来让顶栏首帧就有内容，
    // 真正生效前会被 loadUserInfo() 覆盖。infoLoaded 不在列表里，见 state 里的说明。
    pick: ['userId', 'userName', 'nickName', 'avatar', 'roles', 'permissions', 'tenantId', 'currentRole', 'isSuperAdmin']
  }
})
