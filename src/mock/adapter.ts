import axios, {
  type AxiosAdapter,
  type AxiosResponse,
  type InternalAxiosRequestConfig
} from 'axios'
import { handleRequest } from './index'

/**
 * 浏览器内的 mock adapter —— 给**静态部署**用。
 *
 * 开发环境下 mock 由 Vite dev server 的中间件提供（见 ./plugin.ts 的
 * `configureServer`）。但静态托管（GitHub Pages 等）没有 dev server，
 * 那个中间件根本不会被加载，接口会全部 404 —— 连登录都过不去。
 *
 * 这里把 `./index.ts` 的 `handleRequest` 直接包成 axios adapter。
 * `handleRequest(method, path, query, body)` 是**纯函数**（不碰任何 Node API），
 * 所以可以原样在浏览器里跑，接口行为与开发环境完全一致，
 * 不需要像 mockjs 那样去劫持 XMLHttpRequest（那会和 axios 的取消、
 * 拦截器、blob 下载打架 —— 见 docs/guide/mock.md）。
 *
 * 只在 `import.meta.env.PROD && VITE_USE_MOCK === 'true'` 时被安装
 * （见 `src/utils/request.ts`）：开发环境的请求照旧走 dev server 中间件，
 * 行为一行都不变。
 */

const PREFIX = import.meta.env.VITE_API_PREFIX || '/api'

/** 把 axios 的 config 归一化成 handleRequest 需要的 (path, query, body) */
function normalize(config: InternalAxiosRequestConfig): {
  path: string
  query: Record<string, any>
  body: any
} {
  // adapter 拿到的 config 里 baseURL 与 url 是分开的，这里自己拼起来
  const combined = `${config.baseURL ?? ''}${config.url ?? ''}`
  const qIndex = combined.indexOf('?')
  const rawPath = qIndex > -1 ? combined.slice(0, qIndex) : combined
  const rawQuery = qIndex > -1 ? combined.slice(qIndex + 1) : ''

  // dev server 中间件是靠「剥掉前缀」得到 path 的，这里保持同样的口径
  let path = rawPath
  if (PREFIX && path.startsWith(PREFIX)) path = path.slice(PREFIX.length)
  if (!path.startsWith('/')) path = `/${path}`

  const query: Record<string, any> = {}
  if (rawQuery) {
    new URLSearchParams(rawQuery).forEach((value, key) => {
      query[key] = value
    })
  }
  // config.params 里是原始类型（数字 / 布尔），比 URL 上的字符串更准，覆盖之
  Object.entries(config.params ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query[key] = value
  })

  let body: any = config.data
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body)
    } catch {
      /* 非 JSON（如已被序列化的 FormData）原样透传 */
    }
  }

  return { path, query, body }
}

export const mockAdapter: AxiosAdapter = async (config) => {
  // 和真实 adapter 一样尊重取消信号，否则路由切换时的 clearPending() 会静默失效
  if (config.signal?.aborted) throw new axios.CanceledError()

  const { path, query, body } = normalize(config)
  const method = (config.method ?? 'get').toUpperCase()

  let data: any
  try {
    data = handleRequest(method, path, query, body)
  } catch (err: any) {
    // 与 dev server 中间件的错误口径保持一致
    data = { code: 500, msg: err?.message || 'mock error', data: null }
  }

  const response: AxiosResponse = {
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
    request: { mock: true }
  }
  return response
}
