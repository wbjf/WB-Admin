import type { Plugin, Connect } from 'vite'

export interface MockOptions {
  enabled: boolean
  prefix?: string
}

/** 轻量 mock 中间件：不引入额外依赖，纯 vite-server 层实现 */
export function mockServer(options: MockOptions): Plugin {
  return {
    name: 'wb-admin-mock',
    configureServer(server) {
      if (!options.enabled) return
      const prefix = options.prefix || '/api'

      // 注意：这里必须用全匹配 use(fn)，因为 connect 的 use(path, fn)
      // 会把匹配到的前缀从 req.url 中剥离，导致后续判断失效并被 proxy 抢先处理
      server.middlewares.use(async (req: Connect.IncomingMessage, res, next) => {
        const rawUrl = (req.url || '').split('?')[0]
        if (!rawUrl.startsWith(prefix)) return next()

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
