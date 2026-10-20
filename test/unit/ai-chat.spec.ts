import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import {
  configureAiTransport,
  createHttpTransport,
  createMockTransport,
  DEFAULT_MODELS,
  resetAiTransportForTest
} from '@/components/AiChat/transport'
import {
  MAX_FILES,
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

function fastTransport(): ReturnType<typeof createMockTransport> {
  // 单测不关心打字机节奏，首片与每片延迟都归零
  return createMockTransport({ firstDelay: 0, charDelay: 0, chunkSize: 4096 })
}

describe('AI 传输层（本地模拟）', () => {
  beforeEach(() => {
    resetAiTransportForTest()
  })

  it('返回可选的模型列表', async () => {
    const list = await createMockTransport().listModels()
    expect(list.length).toBeGreaterThan(1)
    expect(list.map((m) => m.id)).toEqual(DEFAULT_MODELS.map((m) => m.id))
    // 返回的是副本，外部改了不能污染常量
    list[0].name = 'changed'
    expect(DEFAULT_MODELS[0].name).not.toBe('changed')
  })

  it('分片输出拼起来就是完整回复（含附件与 markdown）', async () => {
    const chunks: string[] = []
    await createMockTransport({ firstDelay: 0, charDelay: 0, chunkSize: 3 }).chat(
      {
        model: 'gpt-4o',
        locale: 'zh-CN',
        messages: [{ role: 'user', content: '帮我看看这个报错' }],
        files: [{ uid: '1', name: 'error.log', size: 2048, type: 'text/plain' }]
      },
      { onDelta: (c) => chunks.push(c) }
    )

    expect(chunks.length).toBeGreaterThan(10)
    const full = chunks.join('')
    expect(full).toContain('帮我看看这个报错')
    expect(full).toContain('error.log')
    expect(full).toContain('```ts')
  })

  it('英文环境返回英文回复', async () => {
    let full = ''
    await fastTransport().chat(
      { model: 'gpt-4o', locale: 'en-US', messages: [{ role: 'user', content: 'hello' }] },
      { onDelta: (c) => (full += c) }
    )
    expect(full).toContain('local mock reply')
  })

  it('abort 之后不再吐出任何增量', async () => {
    const controller = new AbortController()
    let deltas = 0
    const task = createMockTransport({ firstDelay: 0, charDelay: 5, chunkSize: 2 }).chat(
      { model: 'gpt-4o', messages: [{ role: 'user', content: 'hi' }], signal: controller.signal },
      { onDelta: () => (deltas += 1) }
    )

    await sleep(30)
    controller.abort()
    await task

    // 关键断言：中断后不能还有「已经排上队」的定时器继续吐字
    const atAbort = deltas
    await sleep(60)
    expect(deltas).toBe(atAbort)
    expect(atAbort).toBeGreaterThan(0)
  })
})

describe('AI 会话状态', () => {
  beforeEach(() => {
    localStorage.clear()
    resetAiChatForTest()
    configureAiTransport(fastTransport())
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
    expect(assistant.content).toContain('本地模拟')
    // 发完就清空草稿与待发送附件，否则下一次会重复带上
    expect(chat.draft.value).toBe('')
    expect(chat.attachments.value).toHaveLength(0)
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

  it('生成中可以停止，已产出的内容保留', async () => {
    configureAiTransport(createMockTransport({ firstDelay: 0, charDelay: 8, chunkSize: 4 }))
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
  })
})

describe('会话与分组', () => {
  beforeEach(() => {
    localStorage.clear()
    resetAiChatForTest()
    configureAiTransport(fastTransport())
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

  it('生成中切到别的会话，增量仍然写回原会话', async () => {
    configureAiTransport(createMockTransport({ firstDelay: 0, charDelay: 6, chunkSize: 4 }))
    const chat = useAiChat()
    chat.draft.value = '讲一个长一点的故事'
    const task = chat.send()
    const sid = chat.activeId.value

    await sleep(30)
    expect(chat.sending.value).toBe(true)

    chat.createSession()
    // 新会话不该显示「生成中」，但原会话的流还在继续
    expect(chat.sending.value).toBe(false)
    expect(chat.messages.value).toHaveLength(0)

    await task
    chat.switchSession(sid)
    expect(chat.messages.value).toHaveLength(2)
    expect(chat.messages.value[1].content.length).toBeGreaterThan(0)
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

describe('AI 传输层（HTTP / SSE）', () => {
  const realFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = realFetch
    localStorage.clear()
  })

  function jsonRes(body: unknown): any {
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => body
    }
  }

  function sseRes(parts: Uint8Array[]): any {
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        parts.forEach((p) => c.enqueue(p))
        c.close()
      }
    })
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'text/event-stream; charset=utf-8' },
      body: stream
    }
  }

  it('解包统一响应体，并带上鉴权 / 租户 / 语言头', async () => {
    localStorage.setItem('wb-admin-token', 't-1')
    localStorage.setItem('wb-admin-tenant', 'acme')
    localStorage.setItem('wb-admin-locale', 'en-US')
    let init: any = null
    globalThis.fetch = (async (_url: string, i: any) => {
      init = i
      return jsonRes({ code: 200, msg: 'ok', data: [{ id: 'm1', name: 'M1' }] })
    }) as any

    const list = await createHttpTransport({ baseURL: '/api' }).listModels()

    expect(list.map((m) => m.id)).toEqual(['m1'])
    expect(init.headers.Authorization).toBe('Bearer t-1')
    // 裸 fetch 不走 axios 拦截器，租户头必须自己带，否则多租户后端按「无租户」处理
    expect(init.headers['X-Tenant-Id']).toBe('acme')
    expect(init.headers['Accept-Language']).toBe('en-US')
  })

  it('HTTP 200 但 code 失败时抛错，而不是静默当成空回复', async () => {
    globalThis.fetch = (async () => jsonRes({ code: 500, msg: '额度不足' })) as any

    await expect(
      createHttpTransport().chat(
        { model: 'm1', messages: [{ role: 'user', content: 'hi' }] },
        { onDelta() {} }
      )
    ).rejects.toThrow('额度不足')
  })

  it('multipart 提交 model / messages，SSE 增量按序拼装', async () => {
    const chunks: string[] = []
    let body: FormData | null = null
    globalThis.fetch = (async (_url: string, i: any) => {
      body = i.body
      return sseRes([
        new TextEncoder().encode('data: {"choices":[{"delta":{"content":"你好"}}]}\n\n'),
        new TextEncoder().encode('data: [DONE]\n\n')
      ])
    }) as any

    await createHttpTransport().chat(
      { model: 'qwen-max', messages: [{ role: 'user', content: '测试' }], locale: 'zh-CN' },
      { onDelta: (c) => chunks.push(c) }
    )

    expect(body).toBeInstanceOf(FormData)
    expect((body as unknown as FormData).get('model')).toBe('qwen-max')
    expect((body as unknown as FormData).get('messages')).toBe(
      JSON.stringify([{ role: 'user', content: '测试' }])
    )
    expect(chunks.join('')).toBe('你好')
  })

  it('一个汉字被拆到两个数据块时不会乱码', async () => {
    const chunks: string[] = []
    const bytes = new TextEncoder().encode('data: 你好\n\n')
    // 'data: ' 占 6 字节，「你」的 3 字节从第 6 位开始 —— 从第 7 位切，正好切在汉字中间
    globalThis.fetch = (async () =>
      sseRes([
        bytes.slice(0, 7),
        bytes.slice(7),
        new TextEncoder().encode('data: [DONE]\n\n')
      ])) as any

    await createHttpTransport().chat(
      { model: 'm1', messages: [{ role: 'user', content: 'hi' }] },
      { onDelta: (c) => chunks.push(c) }
    )

    expect(chunks.join('')).toBe('你好')
  })
})
