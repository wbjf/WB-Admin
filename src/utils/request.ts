import axios, {
  type AxiosAdapter,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig
} from 'axios'
import { ElMessage, ElMessageBox, ElNotification } from 'element-plus'
import { getToken, getTenantId, removeToken, setToken } from './auth'
import { t } from '@/locales'

declare module 'axios' {
  interface InternalAxiosRequestConfig {
    meta?: RequestMeta
  }
}

export interface RequestMeta {
  /** 是否需要 token，默认 true */
  auth?: boolean
  /** 是否开启防重复提交，默认 true */
  repeatable?: boolean
  /** 是否显示全局错误提示，默认 true */
  showError?: boolean
  /** 是否跳过统一成功提示 */
  silent?: boolean
  /** 是否返回完整响应（blob / 原始体） */
  raw?: boolean
  /** 是否全局 loading */
  loading?: boolean
  /** 超时重试次数 */
  retry?: number
  /** 重试间隔 ms */
  retryDelay?: number
}

const pending = new Map<string, AbortController>()
let refreshing = false
let waitQueue: Array<(token: string) => void> = []

/** 生成请求指纹 */
function requestKey(config: InternalAxiosRequestConfig): string {
  return [
    config.method,
    config.url,
    JSON.stringify(config.params ?? {}),
    JSON.stringify(config.data ?? {})
  ].join('&')
}

function removePending(config: InternalAxiosRequestConfig) {
  const key = requestKey(config)
  pending.delete(key)
}

/** 路由切换时取消未完成请求 */
export function clearPending() {
  pending.forEach((ctrl) => ctrl.abort())
  pending.clear()
}

const service = axios.create({
  baseURL: import.meta.env.VITE_API_PREFIX || '/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json;charset=utf-8' }
})

/**
 * 静态部署（GitHub Pages 等）下的浏览器内 mock。
 *
 * mock 中间件挂在 Vite dev server 上（src/mock/plugin.ts 的 configureServer），
 * 静态托管里没有 dev server → 接口全 404，登录都过不去。
 * 所以生产构建若开着 `VITE_USE_MOCK`，就把 adapter 换成浏览器内的 mock。
 *
 * 用**懒加载**而不是顶层 import：`import()` 会切成独立 chunk，
 * 于是 `VITE_USE_MOCK=false` 的正式构建里这个分支是死代码，
 * Rollup 会把整个 chunk（连带 mockjs）一并去掉，正式包不会被拖大。
 */
let mockAdapterPromise: Promise<AxiosAdapter> | null = null
const lazyMockAdapter: AxiosAdapter = async (config) => {
  mockAdapterPromise ??= import('@/mock/adapter').then((m) => m.mockAdapter)
  return (await mockAdapterPromise)(config)
}

if (import.meta.env.PROD && import.meta.env.VITE_USE_MOCK === 'true') {
  service.defaults.adapter = lazyMockAdapter
}

service.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const meta = config.meta ?? {}
  const token = getToken()
  if (meta.auth !== false && token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  const tenantId = getTenantId()
  if (tenantId) config.headers['X-Tenant-Id'] = tenantId
  config.headers['Accept-Language'] = localStorage.getItem('wb-admin-locale') || 'zh-CN'

  if (meta.repeatable !== true) {
    const key = requestKey(config)
    const ctrl = new AbortController()
    if (pending.has(key)) {
      pending.get(key)?.abort()
    }
    config.signal = ctrl.signal
    pending.set(key, ctrl)
  }
  return config
})

service.interceptors.response.use(
  (res: AxiosResponse) => {
    removePending(res.config)
    const meta = res.config.meta ?? {}
    const body = res.data
    const isRaw =
      meta.raw || res.config.responseType === 'blob' || res.request?.responseType === 'blob'
    if (isRaw) return body as any
    // 统一解包 R<T>：成功返回 data，失败走错误提示
    if (body && typeof body === 'object' && 'code' in (body as Record<string, unknown>)) {
      const r = body as { code: number; msg?: string; data: any }
      if (r.code === 200 || r.code === 0) return r.data
      if (meta.showError !== false) {
        ElMessage({ message: r.msg || t('common.failed'), type: 'error', grouping: true })
      }
      return Promise.reject(new Error(r.msg || 'business error'))
    }
    return body as any
  },
  async (error: any) => {
    const config = error?.config as InternalAxiosRequestConfig | undefined
    if (config) removePending(config)
    if (axios.isCancel(error) || (error.code === 'ERR_CANCELED' && !config)) {
      return Promise.reject(error)
    }

    const meta = config?.meta ?? {}
    const status = error?.response?.status

    // 401 无感刷新
    if (status === 401 && meta.auth !== false && getToken()) {
      if (!refreshing) {
        refreshing = true
        try {
          const { data } = await axios.post(`${service.defaults.baseURL}/auth/refresh`, null, {
            headers: { Authorization: `Bearer ${getToken()}` }
          })
          const newToken = data?.data?.access_token ?? data?.data?.token
          if (newToken) {
            setToken(newToken)
            waitQueue.forEach((cb) => cb(newToken))
            waitQueue = []
            refreshing = false
            if (config) return service.request(config)
          }
        } catch {
          refreshing = false
          waitQueue = []
          await forceLogout()
          return Promise.reject(error)
        }
      }
      return new Promise((resolve) => {
        waitQueue.push((token: string) => {
          if (config) {
            config.headers.Authorization = `Bearer ${token}`
            resolve(service.request(config))
          } else {
            resolve(null)
          }
        })
      })
    }

    // 超时 / 网络错误重试
    const retry = meta.retry ?? 0
    if ((error.code === 'ECONNABORTED' || !status) && retry > 0 && config) {
      config.meta = { ...meta, retry: retry - 1 }
      await new Promise((r) => setTimeout(r, meta.retryDelay ?? 1000))
      return service.request(config)
    }

    if (meta.showError !== false) {
      const msg = pickErrorMessage(error)
      ElMessage({ message: msg, type: 'error', duration: 4_000, grouping: true })
    }
    return Promise.reject(error)
  }
)

function pickErrorMessage(error: any): string {
  const status = error?.response?.status
  const serverMsg = error?.response?.data?.msg || error?.response?.data?.message
  if (serverMsg) return serverMsg
  const map: Record<number, string> = {
    400: t('http.400'),
    401: t('http.401'),
    403: t('http.403'),
    404: t('http.404'),
    408: t('http.408'),
    500: t('http.500'),
    502: t('http.502'),
    503: t('http.503'),
    504: t('http.504')
  }
  return status && map[status] ? map[status] : t('http.network')
}

/** 强制登出 */
export async function forceLogout() {
  removeToken()
  try {
    await ElMessageBox.confirm(t('http.sessionExpired'), t('common.tip'), {
      confirmButtonText: t('common.confirm'),
      cancelButtonText: t('common.cancel'),
      type: 'warning'
    })
  } catch {
    /* 用户取消也走登出 */
  }
  ElNotification.closeAll()
  window.location.href = `/login?redirect=${encodeURIComponent(window.location.hash.slice(1) || '/')}`
}

export const http = {
  get<T = any>(url: string, params?: any, meta?: RequestMeta, config?: AxiosRequestConfig) {
    return service.get<any, T>(url, { params, meta, ...config } as AxiosRequestConfig)
  },
  post<T = any>(url: string, data?: any, meta?: RequestMeta, config?: AxiosRequestConfig) {
    return service.post<any, T>(url, data, { meta, ...config } as AxiosRequestConfig)
  },
  put<T = any>(url: string, data?: any, meta?: RequestMeta, config?: AxiosRequestConfig) {
    return service.put<any, T>(url, data, { meta, ...config } as AxiosRequestConfig)
  },
  del<T = any>(url: string, params?: any, meta?: RequestMeta, config?: AxiosRequestConfig) {
    return service.delete<any, T>(url, { params, meta, ...config } as AxiosRequestConfig)
  },
  request: service.request,
  instance: service
}

export default service
