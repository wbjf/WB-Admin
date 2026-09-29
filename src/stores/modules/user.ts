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
    isSuperAdmin: false
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
    }
  },
  persist: {
    key: 'wb-admin-user',
    pick: ['userId', 'userName', 'nickName', 'avatar', 'roles', 'permissions', 'tenantId', 'currentRole', 'isSuperAdmin']
  }
})
