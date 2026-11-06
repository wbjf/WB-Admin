import type { Plugin, Connect } from 'vite'

export interface MockOptions {
  enabled: boolean
  prefix?: string
  /**
   * 不走 mock、直接放行给 proxy 的路径。
   *
   * 这个中间件注册在 `configureServer` 里，**排在 vite 内置 proxy 之前**，
   * 而它对未命中的路由不是返回 404，而是 `ok(null)` + HTTP 200 —— 于是
   * 真实后端的接口会被「兜」成一个成功但空的响应，表现为「请求成功但没有数据」，
   * 比报错难查得多。Ollama 的 `/api/chat`、`/api/tags` 就属于这种，必须显式放行。
   */
  bypass?: string[]
}

/** 轻量 mock 中间件：不引入额外依赖，纯 vite-server 层实现 */
export function mockServer(options: MockOptions): Plugin {
  return {
    name: 'wb-admin-mock',
    configureServer(server) {
      if (!options.enabled) return
      const prefix = options.prefix || '/api'
      const bypass = options.bypass ?? []

      // 注意：这里必须用全匹配 use(fn)，因为 connect 的 use(path, fn)
      // 会把匹配到的前缀从 req.url 中剥离，导致后续判断失效并被 proxy 抢先处理
      server.middlewares.use(async (req: Connect.IncomingMessage, res, next) => {
        const rawUrl = (req.url || '').split('?')[0]
        if (!rawUrl.startsWith(prefix)) return next()
        if (bypass.some((p) => rawUrl === p || rawUrl.startsWith(`${p}/`))) return next()

        const query: Record<string, any> = {}
        const searchIdx = (req.url || '').indexOf('?')
        if (searchIdx > -1) {
          const search = new URLSearchParams((req.url || '').slice(searchIdx + 1))
          search.forEach((v, k) => {
            query[k] = v
          })
        }

        const body = await readBody(req)
        const path = rawUrl.slice(prefix.length) || '/'

        try {
          const mod = await server.ssrLoadModule('/src/mock/index.ts')
          const result = await mod.handleRequest((req.method || 'GET').toUpperCase(), path, query, body)
          res.setHeader('Content-Type', 'application/json;charset=utf-8')
          res.statusCode = 200
          res.end(JSON.stringify(result))
        } catch (err: any) {
          res.setHeader('Content-Type', 'application/json;charset=utf-8')
          res.statusCode = 500
          res.end(JSON.stringify({ code: 500, msg: err?.message || 'mock error', data: null }))
        }
      })
    }
  }
}

function readBody(req: Connect.IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf-8')
      if (!raw) return resolve({})
      try {
        resolve(JSON.parse(raw))
      } catch {
        resolve(raw)
      }
    })
    req.on('error', () => resolve({}))
  })
}
