import { getTenantId, getToken } from '@/utils/auth'
import type {
  AiChatHandlers,
  AiChatRequest,
  AiChatTransport,
  AiModel,
  ChatAttachment
} from '@/types'

/**
 * AI 会话的传输层。
 *
 * ## 为什么默认实现是「本地模拟」
 * 这个仓库是纯前端脚手架，接口由 vite 插件里的 mock 中间件提供 —— 而那个中间件
 * **只在 dev server 里存在**，静态产物里一个请求都发不出去（详见 README 的部署说明）。
 * 如果 AI 对话也走接口，打包部署后点发送会直接 404。
 * 所以默认 transport 完全跑在浏览器里：不依赖任何后端，静态部署照样能演示完整交互。
 *
 * 接真实服务时只要换掉 transport，界面一行都不用改：
 * ```ts
 * configureAiTransport(createHttpTransport({ baseURL: '/api' }))
 * ```
 *
 * 接口契约、SSE 报文格式、后端职责清单与踩坑记录见 `docs/components/ai-chat.md`。
 */

/** 模型列表。真实项目里从后端拉，这里给一份静态清单让下拉框有东西可选 */
export const DEFAULT_MODELS: AiModel[] = [
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'OpenAI',
    context: 128000,
    desc: '通用能力最强，响应快'
  },
  {
    id: 'claude-sonnet-4',
    name: 'Claude Sonnet 4',
    provider: 'Anthropic',
    context: 200000,
    desc: '长文本与代码见长'
  },
  {
    id: 'qwen-max',
    name: '通义千问 Max',
    provider: '阿里云',
    context: 32000,
    desc: '中文场景表现好'
  },
  {
    id: 'deepseek-v3',
    name: 'DeepSeek V3',
    provider: 'DeepSeek',
    context: 64000,
    desc: '推理性价比高'
  },
  { id: 'glm-4', name: 'GLM-4', provider: '智谱', context: 128000, desc: '中文对话与工具调用' }
]

/** 单文件体积上限（MB），与上传组件保持一致 */
export const MAX_FILE_SIZE_MB = 10

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/**
 * 可被中断的等待。
 * abort 后必须立刻 resolve —— 否则「点了停止」还要等完当前这一片的定时器，
 * 界面看起来就是「停止按钮慢半拍」。
 */
function waitOrAbort(ms: number, signal?: AbortSignal): Promise<void> {
  if (!signal) return wait(ms)
  if (signal.aborted) return Promise.resolve()
  return new Promise((resolve) => {
    const timer = setTimeout(done, ms)
    function done(): void {
      clearTimeout(timer)
      signal?.removeEventListener('abort', done)
      resolve()
    }
    signal.addEventListener('abort', done, { once: true })
  })
}

export function formatSize(bytes: number): string {
  if (!bytes) return '0 KB'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function fileLine(files: ChatAttachment[], locale: string): string {
  if (!files?.length) return ''
  const names = files.map((f) => `${f.name}（${formatSize(f.size)}）`).join('、')
  return locale === 'en-US'
    ? `- Received ${files.length} file(s): ${names}\n`
    : `- 已收到 ${files.length} 个文件：${names}\n`
}

/** 模拟回复。刻意带 markdown（标题/列表/代码块），好顺带验证渲染链路 */
function buildReply(text: string, files: ChatAttachment[], locale: string): string {
  const topic = text.trim().slice(0, 40) || (locale === 'en-US' ? 'your question' : '你的问题')
  if (locale === 'en-US') {
    return [
      `### About “${topic}”\n`,
      fileLine(files, locale),
      'Break it down into three parts:\n',
      '1. **Context** — capture the constraints first (scope, data volume, who is affected).',
      '2. **Approach** — pick the smallest change that closes the loop end to end.',
      '3. **Verification** — make the result observable, otherwise you cannot tell it worked.\n',
      '```ts',
      '// sketch',
      'export function solve(input: string): string {',
      '  return input.trim()',
      '}',
      '```\n',
      '> This is a local mock reply — no model was actually called. Switch the transport to a real endpoint to go live.'
    ]
      .filter(Boolean)
      .join('\n')
  }
  return [
    `### 关于「${topic}」\n`,
    fileLine(files, locale),
    '我按三步拆一下：\n',
    '1. **确认上下文** —— 先把约束列清楚（范围、数据量、影响谁）。',
    '2. **给方案** —— 选能端到端跑通的最小改动，别一次铺太大。',
    '3. **能验证** —— 让结果可观测，否则做完也不知道有没有生效。\n',
    '```ts',
    '// 示例',
    'export function solve(input: string): string {',
    '  return input.trim()',
    '}',
    '```\n',
    '> 这是本地模拟回复，没有真实调用模型。接入真实服务请替换 transport。'
  ]
    .filter(Boolean)
    .join('\n')
}

export interface MockTransportOptions {
  /** 每片之间的间隔（ms）。单测里传 0 让流立刻走完 */
  charDelay?: number
  /** 每片的字符数 */
  chunkSize?: number
  /** 首片之前的「思考」延迟 */
  firstDelay?: number
}

/** 纯前端模拟：分块吐字，支持中断。不发起任何网络请求 */
export function createMockTransport(options: MockTransportOptions = {}): AiChatTransport {
  const { charDelay = 24, chunkSize = 6, firstDelay = 320 } = options

  return {
    async listModels(): Promise<AiModel[]> {
      return DEFAULT_MODELS.map((m) => ({ ...m }))
    },
    async chat(req: AiChatRequest, handlers: AiChatHandlers): Promise<void> {
      const last = [...req.messages].reverse().find((m) => m.role === 'user')
      const full = buildReply(last?.content ?? '', req.files ?? [], req.locale ?? 'zh-CN')
      await waitOrAbort(firstDelay, req.signal)
      for (let i = 0; i < full.length; i += chunkSize) {
        if (req.signal?.aborted) return
        handlers.onDelta(full.slice(i, i + chunkSize))
        await waitOrAbort(charDelay, req.signal)
      }
    }
  }
}

export interface HttpTransportOptions {
  /** 接口前缀，默认取 VITE_API_PREFIX 或 /api */
  baseURL?: string
  /** 模型列表接口 */
  modelsPath?: string
  /** 对话接口（POST，支持 SSE 流式与普通 JSON 两种响应） */
  chatPath?: string
}

/**
 * 解析统一响应体 `{ code, msg, data }`。
 *
 * 这里必须校验 `code`：后端习惯把业务错误塞进 HTTP 200 的响应体里（`{code:500,msg:'额度不足'}`），
 * 只看 `res.ok` 会把它当成成功 —— 界面上表现为「回复了但一个字都没有」，比报错更难查。
 * 成功码与 `utils/request.ts` 保持同一口径：200 / 0。
 */
function unwrapEnvelope(body: any): any {
  if (body && typeof body === 'object' && 'code' in body) {
    const code = Number(body.code)
    if (code !== 200 && code !== 0) throw new Error(String(body.msg || `code ${body.code}`))
    return body.data
  }
  // 不带 code 的响应：兼容 { data: ... } 与裸数据两种写法
  if (body && typeof body === 'object' && 'data' in body) return body.data
  return body
}

/** 接真实后端：multipart 提交 + SSE 增量解析，非流式响应自动降级为一次性输出 */
export function createHttpTransport(options: HttpTransportOptions = {}): AiChatTransport {
  const base = options.baseURL ?? import.meta.env.VITE_API_PREFIX ?? '/api'
  const modelsPath = options.modelsPath ?? '/ai/models'
  const chatPath = options.chatPath ?? '/ai/chat'

  return {
    async listModels(): Promise<AiModel[]> {
      const res = await fetch(`${base}${modelsPath}`, {
        headers: authHeaders()
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = unwrapEnvelope(await res.json())
      return (Array.isArray(data) ? data : []) as AiModel[]
    },

    async chat(req: AiChatRequest, handlers: AiChatHandlers): Promise<void> {
      const form = new FormData()
      form.append('model', req.model)
      form.append('messages', JSON.stringify(req.messages))
      form.append('locale', req.locale ?? '')
      for (const f of req.files ?? []) {
        if (f.file) form.append('files', f.file, f.name)
        else if (f.url) form.append('fileUrls', f.url)
      }

      const res = await fetch(`${base}${chatPath}`, {
        method: 'POST',
        headers: authHeaders(),
        body: form,
        signal: req.signal
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      // 后端没开流式时退化成一次性返回，界面表现一致（只是没有打字机效果）
      if (!(res.headers.get('content-type') || '').includes('event-stream')) {
        const data = unwrapEnvelope(await res.json())
        handlers.onDelta(String((data as any)?.content ?? data ?? ''))
        return
      }

      const reader = res.body?.getReader()
      if (!reader) {
        handlers.onDelta(await res.text())
        return
      }
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const blocks = buffer.split('\n\n')
        buffer = blocks.pop() ?? ''
        for (const block of blocks) {
          for (const line of block.split('\n')) {
            const payload = line.startsWith('data:') ? line.slice(5).trim() : ''
            if (!payload || payload === '[DONE]') continue
            let text = payload
            try {
              const json = JSON.parse(payload)
              text =
                json?.choices?.[0]?.delta?.content ?? json?.content ?? json?.data?.content ?? ''
            } catch {
              // 不是 JSON 就按纯文本流处理（部分网关直接吐裸文本）
            }
            if (text) handlers.onDelta(String(text))
          }
        }
      }
    }
  }
}

/**
 * 原生 fetch 不经过 `utils/request.ts` 的 axios 拦截器，请求头得自己带全。
 * 少 X-Tenant-Id 时多租户后端会按「无租户」处理 —— 表现为 403 或者读到别的租户的数据，
 * 而且很容易被误判成「AI 接口没权限」。
 */
function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Accept-Language': localStorage.getItem('wb-admin-locale') || 'zh-CN'
  }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  const tenantId = getTenantId()
  if (tenantId) headers['X-Tenant-Id'] = tenantId
  return headers
}

/* -------------------------------------------------------------------------- */
/*                         全局 transport 装配点                                */
/* -------------------------------------------------------------------------- */

let transport: AiChatTransport = createMockTransport()

/** 替换传输层（接真实后端时调用）。组件与 composable 都只读这一个实例 */
export function configureAiTransport(next: AiChatTransport): void {
  transport = next
}

export function getAiTransport(): AiChatTransport {
  return transport
}

/** 仅供测试：恢复成默认的本地模拟传输 */
export function resetAiTransportForTest(): void {
  transport = createMockTransport()
}
