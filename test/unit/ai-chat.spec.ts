import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { aiApi } from '@/api/ai'
import {
  DEFAULT_MODELS,
  MAX_FILES,
  normalizeModels,
  resetAiChatForTest,
  switchAiChatUser,
  useAiChat
} from '@/components/AiChat/useAiChat'

/** jsdom 的 File.size 由内容决定，这里按需伪造一个「超大文件」 */
function makeFile(name: string, size = 1024): File {
  const file = new File(['x'], name, { type: 'text/plain' })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/**
 * 把 `/api/chat` 换成可控的假实现：非流式，一次性返回全文。
 *
 * `delay` 用来复现「生成中」状态（可中断）；被 abort 时抛 AbortError，
 * 与 axios 取消请求的行为一致。会话状态机跟 HTTP 无关，
 * 桩放在测试里直接替换 `aiApi.chat` 最贴近调用点。
 */
function stubChat(opts: { text?: string; delay?: number } = {}) {
  return vi.spyOn(aiApi, 'chat').mockImplementation(async (body, signal) => {
    const last = [...body.messages].reverse().find((m) => m.role === 'user')?.content ?? ''
    if (opts.delay) {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, opts.delay)
        signal?.addEventListener('abort', () => {
          clearTimeout(timer)
          reject(new DOMException('Aborted', 'AbortError'))
        })
      })
    }
    return {
      model: body.model,
      message: { role: 'assistant', content: opts.text ?? `关于「${last}」的回答` },
      done: true
    }
  })
}

/** 模型列表默认返回兜底那条，避免每个用例都要写一遍 */
function stubTags(body: unknown = { models: [{ name: DEFAULT_MODELS[0].id }] }) {
  return vi.spyOn(aiApi, 'tags').mockResolvedValue(body as any)
}

describe('AI 会话状态', () => {
  beforeEach(() => {
    localStorage.clear()
    resetAiChatForTest()
    stubTags()
    stubChat()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('附件：正常加入，超大小与超数量被拒绝', () => {
    const chat = useAiChat()
    const first = chat.addFiles([makeFile('a.txt'), makeFile('huge.pdf', 11 * 1024 * 1024)])
    expect(first.added).toBe(1)
    expect(first.skipped).toEqual(['huge.pdf'])
    expect(chat.attachments.value.map((a) => a.name)).toEqual(['a.txt'])

    chat.addFiles(Array.from({ length: MAX_FILES }, (_, i) => makeFile(`f${i}.txt`)))
    expect(chat.attachments.value.length).toBe(MAX_FILES)

    const overflow = chat.addFiles([makeFile('extra.txt')])
    expect(overflow.added).toBe(0)
    expect(overflow.skipped).toEqual(['extra.txt'])
  })

  it('发送：生成用户消息 + 助手回复，附件随消息快照保存', async () => {
    const chat = useAiChat()
    chat.draft.value = '这个接口怎么设计'
    chat.addFiles([makeFile('spec.md')])
    expect(chat.canSend.value).toBe(true)

    await chat.send()

    expect(chat.messages.value).toHaveLength(2)
    const [user, assistant] = chat.messages.value
    expect(user.role).toBe('user')
    expect(user.content).toBe('这个接口怎么设计')
    expect(user.attachments?.[0].name).toBe('spec.md')
    expect(assistant.role).toBe('assistant')
    expect(assistant.model).toBe(chat.modelId.value)
    expect(assistant.pending).toBe(false)
    expect(assistant.content).toBe('关于「这个接口怎么设计」的回答')
    // 发完就清空草稿与待发送附件，否则下一次会重复带上
    expect(chat.draft.value).toBe('')
    expect(chat.attachments.value).toHaveLength(0)
  })

  it('发送时提交给 /api/chat 的字段：model / messages / stream / keep_alive', async () => {
    const spy = stubChat()
    const chat = useAiChat()
    chat.draft.value = '你好'
    await chat.send()

    const body = spy.mock.calls[0][0]
    expect(body.model).toBe(chat.modelId.value)
    expect(body.messages).toEqual([{ role: 'user', content: '你好' }])
    // axios 拿不到流式增量，必须是 false：等模型生成完一次性返回
    expect(body.stream).toBe(false)
    expect(body.keep_alive).toBe('30m')
    expect(body.options?.num_ctx).toBe(8192)
  })

  it('空输入既不发送也不产生消息', async () => {
    const chat = useAiChat()
    chat.draft.value = '   '
    expect(chat.canSend.value).toBe(false)
    await chat.send()
    expect(chat.messages.value).toHaveLength(0)
  })

  it('历史按登录人隔离，且不持久化 File 对象', async () => {
    const chat = useAiChat()
    chat.draft.value = '第一个人的问题'
    chat.addFiles([makeFile('a.txt')])
    await chat.send()
    // 落盘有 300ms 防抖
    await sleep(400)
    await flushPromises()

    const keys = Object.keys(localStorage).filter((k) => k.startsWith('wb-admin:ai-chat'))
    expect(keys).toEqual(['wb-admin:ai-chat:guest'])

    const raw = JSON.parse(localStorage.getItem('wb-admin:ai-chat:guest') as string)
    expect(raw.v).toBe(2)
    // 多会话之后消息挂在 sessions 里，当前会话由 activeId 指过去
    const session = raw.sessions.find((s: any) => s.id === raw.activeId)
    expect(session.messages).toHaveLength(2)
    expect(session.messages[0].attachments[0].name).toBe('a.txt')
    // File 不可序列化，历史里只保留元信息
    expect(session.messages[0].attachments[0].file).toBeUndefined()

    switchAiChatUser('u2')
    expect(chat.messages.value).toHaveLength(0)

    // 切回原用户，历史回来了
    switchAiChatUser('guest')
    expect(chat.messages.value).toHaveLength(2)
    expect(chat.messages.value[0].content).toBe('第一个人的问题')
  })

  it('clear 清空当前会话并立即落盘', async () => {
    const chat = useAiChat()
    chat.draft.value = 'hi'
    await chat.send()
    expect(chat.messages.value.length).toBe(2)

    chat.clear()
    expect(chat.messages.value).toHaveLength(0)
    const raw = JSON.parse(localStorage.getItem('wb-admin:ai-chat:guest') as string)
    expect(raw.sessions.find((s: any) => s.id === raw.activeId).messages).toHaveLength(0)
  })

  it('生成中可以停止，主动中断不算失败', async () => {
    stubChat({ text: '长回复', delay: 200 })
    const chat = useAiChat()
    chat.draft.value = '讲一个长一点的故事'
    const task = chat.send()

    await sleep(40)
    expect(chat.sending.value).toBe(true)
    chat.stop()
    await task

    expect(chat.sending.value).toBe(false)
    const assistant = chat.messages.value[1]
    expect(assistant.pending).toBe(false)
    // 主动中断不算失败
    expect(assistant.error).toBeFalsy()
    expect(chat.lastError.value).toBe('')
  })

  it('接口失败时消息标红并记下原因，不是静默空白', async () => {
    // 模拟 axios 的错误形状：Ollama 的原因在 response.data.error
    vi.spyOn(aiApi, 'chat').mockRejectedValue(
      Object.assign(new Error('Request failed with status code 404'), {
        code: 'ERR_BAD_REQUEST',
        response: { status: 404, data: { error: "model 'qwen2.5:3b' not found" } }
      })
    )

    const chat = useAiChat()
    chat.draft.value = 'hi'
    await chat.send()

    const assistant = chat.messages.value[1]
    expect(assistant.error).toBe(true)
    expect(assistant.pending).toBe(false)
    expect(chat.lastError.value).toMatch(/not found/)
  })
})

describe('会话与分组', () => {
  beforeEach(() => {
    localStorage.clear()
    resetAiChatForTest()
    stubTags()
    stubChat()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  async function sendText(text: string): Promise<void> {
    const chat = useAiChat()
    chat.draft.value = text
    await chat.send()
  }

  it('新建会话后各聊各的，标题取首条消息，切回来消息还在', async () => {
    const chat = useAiChat()
    await sendText('第一个会话的问题')
    const first = chat.activeId.value
    expect(chat.activeSession.value?.title).toBe('第一个会话的问题')

    chat.createSession()
    expect(chat.activeId.value).not.toBe(first)
    expect(chat.messages.value).toHaveLength(0)

    await sendText('第二个会话的问题')
    expect(chat.messages.value).toHaveLength(2)

    // 列表按最近使用倒序，刚聊过的排第一
    expect(chat.sessions.value.map((s) => s.title)).toEqual([
      '第二个会话的问题',
      '第一个会话的问题'
    ])

    chat.switchSession(first)
    expect(chat.messages.value[0].content).toBe('第一个会话的问题')
  })

  it('当前会话本来就是空的时候，新建对话不会再堆一条空记录', () => {
    const chat = useAiChat()
    expect(chat.sessions.value).toHaveLength(1)
    chat.createSession()
    chat.createSession()
    expect(chat.sessions.value).toHaveLength(1)
  })

  it('分组：新建、移动、改名、删除分组后会话回落未分组', async () => {
    const chat = useAiChat()
    await sendText('需求梳理')
    const sid = chat.activeId.value

    const gid = chat.createGroup('需求') as string
    expect(gid).toBeTruthy()
    chat.moveSession(sid, gid)
    expect(chat.sessions.value.find((s) => s.id === sid)?.groupId).toBe(gid)
    expect(chat.groupedSessions.value.find((b) => b.group?.id === gid)?.sessions).toHaveLength(1)

    chat.renameGroup(gid, '需求 v2')
    expect(chat.groups.value[0].name).toBe('需求 v2')

    chat.removeGroup(gid)
    expect(chat.groups.value).toHaveLength(0)
    // 删组只删篮子：会话必须还在，并回到未分组
    expect(chat.sessions.value).toHaveLength(1)
    expect(chat.sessions.value[0].groupId).toBe('')
  })

  it('新会话一律落在未分组，不跟随当前会话所在的分组', async () => {
    const chat = useAiChat()
    await sendText('已归组的会话')
    const sid = chat.activeId.value
    const gid = chat.createGroup('需求') as string
    chat.moveSession(sid, gid)

    // 当前会话就在分组里，此时新建：不能继承 gid
    chat.createSession()
    expect(chat.activeSession.value?.groupId).toBe('')
    await sendText('新会话')
    expect(chat.activeSession.value?.groupId).toBe('')
    // 分组里还是那一条，新会话在「未分组」桶
    expect(chat.groupedSessions.value.find((b) => b.group?.id === gid)?.sessions).toHaveLength(1)
    expect(chat.groupedSessions.value[0].group).toBe(null)
    expect(chat.groupedSessions.value[0].sessions).toHaveLength(1)
  })

  it('同名分组复用已有分组，不产生两条同名记录', () => {
    const chat = useAiChat()
    const a = chat.createGroup('需求')
    const b = chat.createGroup(' 需求 ')
    expect(b).toBe(a)
    expect(chat.groups.value).toHaveLength(1)
  })

  it('删除当前会话后自动切到下一条，不会停在空视图', async () => {
    const chat = useAiChat()
    await sendText('会话 A')
    const a = chat.activeId.value
    chat.createSession()
    await sendText('会话 B')
    const b = chat.activeId.value

    chat.removeSession(b)
    expect(chat.activeId.value).toBe(a)
    expect(chat.messages.value[0].content).toBe('会话 A')
    expect(chat.sessions.value.map((s) => s.id)).toEqual([a])
  })

  it('生成中切到别的会话，回复仍然写回原会话', async () => {
    stubChat({ text: '一整段回复', delay: 120 })
    const chat = useAiChat()
    chat.draft.value = '讲一个长一点的故事'
    const task = chat.send()
    const sid = chat.activeId.value

    await sleep(40)
    expect(chat.sending.value).toBe(true)

    chat.createSession()
    // 新会话不该显示「生成中」，但原会话的请求还在跑
    expect(chat.sending.value).toBe(false)
    expect(chat.messages.value).toHaveLength(0)

    await task
    chat.switchSession(sid)
    expect(chat.messages.value).toHaveLength(2)
    expect(chat.messages.value[1].content).toBe('一整段回复')
    expect(chat.messages.value[1].pending).toBe(false)
  })

  it('v1 的单会话历史迁移成一条会话，不丢记录', () => {
    localStorage.setItem(
      'wb-admin:ai-chat:guest',
      JSON.stringify({
        v: 1,
        model: 'qwen-max',
        messages: [
          { id: 'm1', role: 'user', content: '老版本的问题', time: 1 },
          { id: 'm2', role: 'assistant', content: '老版本的回复', time: 2 }
        ]
      })
    )

    const chat = useAiChat()
    expect(chat.sessions.value).toHaveLength(1)
    expect(chat.messages.value).toHaveLength(2)
    expect(chat.activeSession.value?.title).toBe('老版本的问题')
    expect(chat.modelId.value).toBe('qwen-max')
  })
})

describe('模型列表（/api/tags）', () => {
  beforeEach(() => {
    localStorage.clear()
    resetAiChatForTest()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('打开面板时才拉，接口返回的那份直接用（id 取带 tag 的 name）', async () => {
    const spy = stubTags({ models: [{ name: 'llama3:8b', details: { family: 'llama' } }] })
    const chat = useAiChat()
    // 未打开面板前不请求 —— 否则每个页面加载都平白打一条 /api/tags
    expect(spy).not.toHaveBeenCalled()

    chat.open()
    await flushPromises()

    expect(spy).toHaveBeenCalledTimes(1)
    expect(chat.models.value.map((m) => m.id)).toEqual(['llama3:8b'])
    expect(chat.modelId.value).toBe('llama3:8b')
  })

  it('连点两次只发一次请求（in-flight 去重）', async () => {
    const spy = stubTags({ models: [{ name: 'a:1b' }] })
    const chat = useAiChat()
    chat.open()
    chat.open()
    await flushPromises()
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('拉失败时退回兜底那条，面板不至于空着', async () => {
    vi.spyOn(aiApi, 'tags').mockRejectedValue(new Error('ECONNREFUSED'))
    const chat = useAiChat()
    chat.open()
    await flushPromises()

    expect(chat.models.value.map((m) => m.id)).toEqual(DEFAULT_MODELS.map((m) => m.id))
    // 兜底模型要能被选中并真的发出去，否则首条消息的 model 是空串
    expect(chat.modelId.value).toBe(DEFAULT_MODELS[0].id)
  })

  it('服务端一个模型都没给时也用兜底，不留在空列表', async () => {
    stubTags({ models: [] })
    const chat = useAiChat()
    chat.open()
    await flushPromises()
    expect(chat.models.value).toHaveLength(1)
  })
})

describe('模型归一化（normalizeModels）', () => {
  it('把 { models } 转成界面用的 AiModel[]', () => {
    const list = normalizeModels({
      models: [
        {
          name: 'qwen2.5:3b',
          model: 'qwen2.5:3b',
          details: { family: 'qwen2', parameter_size: '3.1B', quantization_level: 'Q4_K_M' }
        }
      ]
    })
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe('qwen2.5:3b')
    expect(list[0].provider).toBe('qwen2')
    expect(list[0].desc).toBe('3.1B · Q4_K_M')
  })

  it('结构不对时给空数组，不抛错', () => {
    expect(normalizeModels(null)).toEqual([])
    expect(normalizeModels({})).toEqual([])
    expect(normalizeModels({ models: [{ name: 'a' }, {}] }).map((m) => m.id)).toEqual(['a'])
  })

  it('过滤 embedding 模型（不支持 chat，出现在下拉里就是必然失败）', () => {
    const list = normalizeModels({
      models: [
        { name: 'bge-m3:latest', details: { family: 'bert' } },
        { name: 'qwen3-embedding:0.6b', details: { family: 'qwen3' } },
        { name: 'qwen2.5:3b', details: { family: 'qwen2' } }
      ]
    })
    expect(list.map((m) => m.id)).toEqual(['qwen2.5:3b'])
  })
})
