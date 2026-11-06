import { http } from '@/utils/request'

/**
 * AI 对话接口（Ollama）。本文件只声明接口，解析逻辑在 `components/AiChat/useAiChat.ts`。
 * https://github.com/ollama/ollama/blob/main/docs/api.md
 */

/** `/api/tags` 里的一条模型 */
export interface OllamaTag {
  name?: string
  model?: string
  details?: {
    family?: string
    parameter_size?: string
    quantization_level?: string
  }
}

/** `GET /api/tags` 的原始返回 */
export interface OllamaTagsBody {
  models?: OllamaTag[]
}

/** `POST /api/chat` 的请求体 */
export interface OllamaChatBody {
  model: string
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
  /** false = 等模型生成完一次性返回全文（axios 拿不到流式增量） */
  stream?: boolean
  /** 默认 5 分钟卸载模型，下次提问要重新加载 */
  keep_alive?: string
  /** 默认上下文很短，聊几轮会被静默截断 */
  options?: { num_ctx?: number }
}

/** `POST /api/chat` 的返回（非流式） */
export interface OllamaChatResult {
  model?: string
  message?: { role?: string; content?: string }
  done?: boolean
}

export const aiApi = {
  /** 模型列表。拉不到时静默失败，由调用方兜底 */
  tags: () => http.get<OllamaTagsBody>('/tags', undefined, { showError: false }),

  /**
   * 对话。非流式：等模型生成完一次性返回全文。
   * `timeout: 0` 不限超时 —— 实例默认 30s 不够模型生成；
   * `repeatable: true` 让中断按钮的 signal 生效（否则会被防重复提交的 controller 覆盖）。
   */
  chat: (body: OllamaChatBody, signal?: AbortSignal) =>
    http.post<OllamaChatResult>(
      '/chat',
      body,
      { showError: false, repeatable: true },
      { signal, timeout: 0 }
    )
}
