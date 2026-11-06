import { computed, ref, type ComputedRef, type Ref } from 'vue'
import { useUserStore } from '@/stores/modules/user'
import { aiApi, type OllamaTagsBody } from '@/api/ai'
import type { AiModel, ChatAttachment, ChatGroup, ChatMessage, ChatSession } from '@/types'

/** 未登录时的归档桶，与设备偏好同一口径 */
const GUEST_USER = 'guest'

/**
 * 全局 AI 会话状态。
 *
 * ## 为什么是模块级单例而不是组件内 ref
 * 触发入口（顶栏图标）和弹窗本体是两个不相干的组件，而且弹窗只在 layout 里挂一次。
 * 状态放进组件内部的话，顶栏拿不到它、关掉弹窗再打开也会丢上下文；
 * 放进 store 又过重（这是 UI 状态，不是业务数据）。
 * 所以跟 `useDevicePreference` 一样的做法：模块级 ref + 一个 `useAiChat()` 取用入口。
 *
 * ## 为什么 messages 是 computed
 * 多会话之后「当前消息」只是 `sessions[activeId].messages` 的一个视图。
 * 如果同时保留一份 `messages` ref 当副本，就一定会有一次忘了同步 —— 所以只认
 * sessions 这一份数据源，所有写入都走 `updateSession()`。
 *
 * ## 持久化边界
 * 只落「能序列化」的部分：文本、角色、模型、时间、附件元信息。
 * `File` 对象不能进 localStorage（刷新后必然失效），
 * 所以历史里的附件只保留名字和大小，用于展示「当时发过什么」。
 */

/** localStorage key 前缀，完整 key 按登录人拼接（见 storageKey） */
const STORAGE_KEY_PREFIX = 'wb-admin:ai-chat'
/** 数据格式版本：v2 引入多会话与分组。字段改了按版本丢弃重建，不要拿旧结构硬解析 */
const SCHEMA_VERSION = 2
/** 每个会话最多保留的消息条数，防止 localStorage 被长对话撑爆 */
const HISTORY_LIMIT = 100
/** 最多保留的会话数（按最近使用排序截断） */
const SESSION_LIMIT = 30
/** 自动标题的长度上限 */
const TITLE_LIMIT = 20
/** 单次最多携带的附件数 */
export const MAX_FILES = 5
/** 单文件体积上限（MB） */
export const MAX_FILE_SIZE_MB = 10
/** persist() 的防抖间隔（ms）：流式/连续输入时合并写盘 */
const SAVE_DEBOUNCE = 300

/** 拉不到模型列表时的兜底（`VITE_OLLAMA_MODEL` 可配，须与服务端实际存在的一致） */
export const DEFAULT_MODELS: AiModel[] = [
  {
    id: import.meta.env.VITE_OLLAMA_MODEL || 'qwen2.5:3b',
    name: import.meta.env.VITE_OLLAMA_MODEL || 'qwen2.5:3b',
    provider: 'Ollama',
    desc: '服务器部署'
  }
]

/** 附件体积展示（气泡里用整数，`@/utils` 那个固定一位小数是给列表页的） */
export function formatSize(bytes: number): string {
  if (!bytes) return '0 KB'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/**
 * `/api/tags` → `AiModel[]`。embedding 模型（bge-m3、qwen3-embedding 等）不支持
 * `/api/chat`，出现在下拉里就是给用户一个必然失败的选项，直接滤掉。
 */
export function normalizeModels(body: OllamaTagsBody | null | undefined): AiModel[] {
  return (body?.models ?? [])
    .filter((m) => {
      const id = String(m?.name ?? m?.model ?? '')
      return id !== '' && !id.toLowerCase().includes('embed') && m?.details?.family !== 'bert'
    })
    .map((m) => ({
      id: String(m.name ?? m.model),
      name: String(m.name ?? m.model),
      provider: m.details?.family ?? 'Ollama',
      desc: [m.details?.parameter_size, m.details?.quantization_level].filter(Boolean).join(' · ')
    }))
}

/** 弹窗开关 */
const visible = ref(false)
/** 会话列表是唯一数据源，当前会话的消息由 activeId 派生 */
const sessions = ref<ChatSession[]>([])
/** 会话分组（侧栏的「篮子」） */
const groups = ref<ChatGroup[]>([])
/** 当前会话 id；消息、标题都由它从 sessions 派生 */
const activeId = ref('')
/** 可选模型列表（`/api/tags` 拉回来、normalize 过的） */
const models = ref<AiModel[]>([])
/** 当前选中的模型 id，随会话切换同步（syncModelFromActive） */
const modelId = ref('')
/** 正在生成的会话 id 集合：允许切到别的会话后后台继续生成 */
const generating = ref<string[]>([])
/** 输入框草稿（只在当前会话，切会话即清空） */
const draft = ref('')
/** 待发送附件（含 File 本体，只活在内存里，不落盘） */
const attachments = ref<ChatAttachment[]>([])
/** 最近一次发送失败的原因，界面上给一条可关闭的提示 */
const lastError = ref('')
/** 当前历史归属的登录人，用于切换账号时重载 */
let owner = ''
/** 每个会话一个 controller，切换会话不会互相打断 */
const controllers = new Map<string, AbortController>()
/** persist() 排上的防抖定时器句柄 */
let saveTimer: ReturnType<typeof setTimeout> | null = null

/** 生成不重复的短 id（会话 / 消息 / 分组 / 附件共用） */
function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/** 当前登录人 id；拿不到（未登录 / pinia 未激活）一律归到 guest */
function resolveUserId(): string {
  try {
    // 用 try 包住而不是顶层直接读：pinia 未激活时 useUserStore() 会抛，
    // 而这个模块可能在应用初始化的早期就被调用
    const store = useUserStore()
    return String(store?.userId ?? '') || GUEST_USER
  } catch {
    return GUEST_USER
  }
}

/** 某个登录人的历史存储 key：`wb-admin:ai-chat:<userId>` */
function storageKey(userId: string): string {
  return `${STORAGE_KEY_PREFIX}:${userId || GUEST_USER}`
}

/* -------------------------------------------------------------------------- */
/*                              规范化（读存储）                                */
/* -------------------------------------------------------------------------- */

/** 历史里的附件会丢掉 File，这里统一补成只有元信息的形态 */
function sanitizeAttachments(list: unknown): ChatAttachment[] | undefined {
  if (!Array.isArray(list) || !list.length) return undefined
  return list.map((a: any) => ({
    uid: String(a?.uid ?? uid()),
    name: String(a?.name ?? ''),
    size: Number(a?.size ?? 0),
    type: String(a?.type ?? ''),
    url: a?.url ? String(a.url) : undefined
  }))
}

/** 把存储里的消息列表修成合法形态：字段补全、role 收敛、截断到 HISTORY_LIMIT */
function sanitizeMessages(list: unknown): ChatMessage[] {
  if (!Array.isArray(list)) return []
  return list
    .filter((m): m is Record<string, any> => !!m && typeof m === 'object')
    .slice(-HISTORY_LIMIT)
    .map((m) => ({
      id: String(m.id ?? uid()),
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content ?? ''),
      model: m.model ? String(m.model) : undefined,
      time: Number(m.time ?? Date.now()),
      attachments: sanitizeAttachments(m.attachments)
    }))
}

/** 分组列表规范化：名称截断、过滤无名项（无名分组渲染不出任何东西） */
function sanitizeGroups(list: unknown): ChatGroup[] {
  if (!Array.isArray(list)) return []
  return list
    .filter((g): g is Record<string, any> => !!g && typeof g === 'object')
    .map((g) => ({
      id: String(g.id ?? uid()),
      name: String(g.name ?? '').slice(0, 30),
      collapsed: !!g.collapsed,
      createdAt: Number(g.createdAt ?? Date.now())
    }))
    .filter((g) => !!g.name)
}

/** 会话列表规范化：GroupId 不在合法分组里就落回未分组，按 updatedAt 倒序截断 */
function sanitizeSessions(list: unknown, validGroups: string[]): ChatSession[] {
  if (!Array.isArray(list)) return []
  return list
    .filter((s): s is Record<string, any> => !!s && typeof s === 'object')
    .map((s) => {
      const messages = sanitizeMessages(s.messages)
      const groupId = String(s.groupId ?? '')
      return {
        id: String(s.id ?? uid()),
        title: String(s.title ?? '').slice(0, 30),
        // 分组被删掉了就落回未分组，别让会话成为孤儿
        groupId: validGroups.includes(groupId) ? groupId : '',
        messages,
        model: s.model ? String(s.model) : undefined,
        createdAt: Number(s.createdAt ?? messages[0]?.time ?? Date.now()),
        updatedAt: Number(s.updatedAt ?? messages[messages.length - 1]?.time ?? Date.now())
      }
    })
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, SESSION_LIMIT)
}

/* -------------------------------------------------------------------------- */
/*                                  持久化                                     */
/* -------------------------------------------------------------------------- */

/** 撤掉 persist() 排上的防抖定时器 */
function cancelScheduledSave(): void {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
}

/** 立即把当前状态写进 localStorage（结构类操作与页面卸载时走这里，不走防抖） */
function persistNow(): void {
  cancelScheduledSave()
  try {
    const payload = {
      v: SCHEMA_VERSION,
      activeId: activeId.value,
      model: modelId.value,
      groups: groups.value,
      sessions: sessions.value
        // 空会话不落库（当前这个除外）：不然每点一次「新建对话」都会多一条空记录
        .filter(
          (s) =>
            s.id === activeId.value ||
            s.messages.some((m) => m.content.trim() || m.attachments?.length)
        )
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, SESSION_LIMIT)
        .map((s) => ({
          ...s,
          // 逐条重建消息：直接 JSON.stringify 会把 File 序列化成 `{}`，
          // 既污染数据又让人误以为附件还能用。流式半成品同理不落库。
          messages: s.messages
            .filter((m) => !m.pending)
            .slice(-HISTORY_LIMIT)
            .map((m) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              model: m.model,
              time: m.time,
              attachments: (m.attachments ?? []).map((a) => ({
                uid: a.uid,
                name: a.name,
                size: a.size,
                type: a.type,
                url: a.url
              }))
            }))
        }))
    }
    localStorage.setItem(storageKey(owner), JSON.stringify(payload))
  } catch {
    // 隐私模式 / 配额满都会抛。历史丢了不影响继续对话，不能让它冒泡
  }
}

/** 防抖写盘：内容类变更（新消息、生成完成）走这里，合并短时间内的多次写 */
function persist(): void {
  cancelScheduledSave()
  saveTimer = setTimeout(persistNow, SAVE_DEBOUNCE)
}

/*
 * 页面要走了就把防抖里挂着的那次写掉。
 * 流式输出期间每条增量都走防抖，直接关标签页会丢掉最后一段；
 * 结构类操作（移动分组、建组……）已经改成同步落盘，这里是兜底。
 */
let flushBound = false
/** 注册「页面卸载 / 切后台」时的强制落盘监听，只绑一次 */
function bindFlushOnce(): void {
  if (flushBound || typeof window === 'undefined') return
  flushBound = true
  const flush = (): void => {
    if (saveTimer) persistNow()
  }
  // pagehide 比 beforeunload 更可靠（iOS Safari / 前进后退缓存里经常不触发后者）
  window.addEventListener('pagehide', flush)
  window.addEventListener('beforeunload', flush)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush()
  })
}

/* -------------------------------------------------------------------------- */
/*                                  会话操作                                   */
/* -------------------------------------------------------------------------- */

/** 由首条用户消息生成会话标题：压空白、截断到 TITLE_LIMIT */
function titleFrom(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, TITLE_LIMIT)
}

/** 按 id 找会话 */
function sessionById(id: string): ChatSession | undefined {
  return sessions.value.find((s) => s.id === id)
}

/** 当前会话（activeId 指向的那条） */
const activeSession = computed(() => sessionById(activeId.value))
/** 当前会话的消息列表（只读视图，写入必须走 updateSession） */
const messages = computed<ChatMessage[]>(() => activeSession.value?.messages ?? [])
/** 当前会话是否在生成中（决定按钮是「发送」还是「停止」） */
const sending = computed(() => generating.value.includes(activeId.value))

/**
 * 所有改会话的入口。
 * 不要直接改 `sessions.value[i]` —— 数组里是对象，原地改不会触发依赖它的 computed。
 */
function updateSession(id: string, patch: (s: ChatSession) => ChatSession): void {
  sessions.value = sessions.value.map((s) => (s.id === id ? patch(s) : s))
}

/** 新建一个空会话；当前会话本来就是空的就复用，避免点两下多出两条 */
function createSession(groupId = ''): void {
  const current = activeSession.value
  if (current && !current.messages.length) {
    if (current.groupId !== groupId) {
      updateSession(current.id, (s) => ({ ...s, groupId, updatedAt: Date.now() }))
      persistNow()
    }
    return
  }
  const now = Date.now()
  const session: ChatSession = {
    id: uid(),
    title: '',
    groupId,
    messages: [],
    model: modelId.value,
    createdAt: now,
    updatedAt: now
  }
  sessions.value = [session, ...sessions.value]
  activeId.value = session.id
  draft.value = ''
  attachments.value = []
  lastError.value = ''
  persistNow()
}

/** 没有任何可用会话时兜一个，保证「当前会话」永远存在 */
function ensureSession(): void {
  if (activeId.value && sessionById(activeId.value)) return
  if (sessions.value.length) {
    activeId.value = [...sessions.value].sort((a, b) => b.updatedAt - a.updatedAt)[0].id
  } else {
    const now = Date.now()
    const session: ChatSession = {
      id: uid(),
      title: '',
      groupId: '',
      messages: [],
      createdAt: now,
      updatedAt: now
    }
    sessions.value = [session]
    activeId.value = session.id
  }
  syncModelFromActive()
}

/** 切会话后把选中模型同步成该会话上次用的（不在可用列表里则回退） */
function syncModelFromActive(): void {
  const model = activeSession.value?.model
  const available = models.value.length ? models.value.some((m) => m.id === model) : true
  if (model && available) modelId.value = model
  else if (!modelId.value) modelId.value = models.value[0]?.id ?? DEFAULT_MODELS[0]?.id ?? ''
}

/** 切换到指定会话 */
function switchSession(id: string): void {
  if (id === activeId.value || !sessionById(id)) return
  activeId.value = id
  // 换会话时清空草稿与待发附件：否则很容易把上一条对话的内容发到新的会话里
  draft.value = ''
  attachments.value = []
  lastError.value = ''
  syncModelFromActive()
}

/** 重命名会话（压空白、截 30 字；空名直接忽略） */
function renameSession(id: string, title: string): void {
  const next = title.replace(/\s+/g, ' ').trim().slice(0, 30)
  if (!next) return
  updateSession(id, (s) => ({ ...s, title: next }))
  persistNow()
}

/** 删除会话：中断其生成、删掉后自动切到最近使用的下一条 */
function removeSession(id: string): void {
  controllers.get(id)?.abort()
  controllers.delete(id)
  generating.value = generating.value.filter((g) => g !== id)
  sessions.value = sessions.value.filter((s) => s.id !== id)
  if (activeId.value === id) {
    const next = [...sessions.value].sort((a, b) => b.updatedAt - a.updatedAt)[0]
    activeId.value = next?.id ?? ''
    ensureSession()
  }
  persistNow()
}

/** 把会话移动到指定分组（groupId 为空即未分组） */
function moveSession(id: string, groupId: string): void {
  updateSession(id, (s) => ({ ...s, groupId }))
  // 结构变更立即落盘：走防抖的话，用户「移动完马上刷新」就会丢，组里莫名空掉
  persistNow()
}

/* -------------------------------------------------------------------------- */
/*                                  分组操作                                   */
/* -------------------------------------------------------------------------- */

/** 新建分组；重名直接返回已有 id，避免列表里出现两个同名分组 */
function createGroup(name: string): string | null {
  const clean = name.replace(/\s+/g, ' ').trim().slice(0, 30)
  if (!clean) return null
  const existed = groups.value.find((g) => g.name === clean)
  if (existed) return existed.id
  const group: ChatGroup = { id: uid(), name: clean, createdAt: Date.now() }
  groups.value = [...groups.value, group]
  persistNow()
  return group.id
}

/** 重命名分组（压空白、截 30 字；空名直接忽略） */
function renameGroup(id: string, name: string): void {
  const clean = name.replace(/\s+/g, ' ').trim().slice(0, 30)
  if (!clean) return
  groups.value = groups.value.map((g) => (g.id === id ? { ...g, name: clean } : g))
  persistNow()
}

/** 删除分组只删「篮子」，组内会话回到未分组，不跟着被删掉 */
function removeGroup(id: string): void {
  groups.value = groups.value.filter((g) => g.id !== id)
  sessions.value = sessions.value.map((s) => (s.groupId === id ? { ...s, groupId: '' } : s))
  persistNow()
}

/** 折叠 / 展开分组（状态持久化） */
function toggleGroup(id: string): void {
  groups.value = groups.value.map((g) => (g.id === id ? { ...g, collapsed: !g.collapsed } : g))
  persistNow()
}

/* -------------------------------------------------------------------------- */
/*                                  读模型                                     */
/* -------------------------------------------------------------------------- */

/** 整段重载某个登录人的历史：v2 直接读，v1 旧单会话迁成一条「历史对话」，其余丢弃 */
function loadFor(userId: string): void {
  cancelScheduledSave()
  // 换人（或重载）时把在飞的请求一起掐掉，否则它们会把结果写进已经换掉的会话
  controllers.forEach((c) => c.abort())
  controllers.clear()
  owner = userId || GUEST_USER
  sessions.value = []
  groups.value = []
  activeId.value = ''
  modelId.value = ''
  generating.value = []
  controllers.clear()

  let data: any = null
  try {
    data = JSON.parse(localStorage.getItem(storageKey(owner)) || 'null')
  } catch {
    data = null
  }

  if (data?.v === SCHEMA_VERSION) {
    groups.value = sanitizeGroups(data.groups)
    sessions.value = sanitizeSessions(
      data.sessions,
      groups.value.map((g) => g.id)
    )
    if (typeof data.activeId === 'string' && sessionById(data.activeId)) {
      activeId.value = data.activeId
    }
    if (data.model) modelId.value = String(data.model)
  } else if (data?.v === 1) {
    // 老版本只有一份单会话。迁成「历史对话」放进未分组 —— 直接丢弃会让用户以为记录没了
    const msgs = sanitizeMessages(data.messages)
    if (msgs.length) {
      const id = uid()
      const first = msgs.find((m) => m.role === 'user' && m.content.trim())
      sessions.value = [
        {
          id,
          title: first ? titleFrom(first.content) : '',
          groupId: '',
          messages: msgs,
          model: data.model ? String(data.model) : undefined,
          createdAt: msgs[0].time,
          updatedAt: msgs[msgs.length - 1].time
        }
      ]
      activeId.value = id
      if (data.model) modelId.value = String(data.model)
    }
  }

  ensureSession()
}

/** 确保历史挂在正确的登录人名下；换人时整段重载 */
function ensureOwner(): void {
  const next = resolveUserId()
  if (next !== owner) loadFor(next)
}

/* -------------------------------------------------------------------------- */
/*                                  发送                                       */
/* -------------------------------------------------------------------------- */

/**
 * 模型列表的「在飞」请求。
 *
 * 初始化与每次打开面板都会调 `loadModels()`，而第一次请求通常还没回来 ——
 * 真机上就是同一瞬间打到服务器好几条 `/api/tags`。共享同一个 promise 即可去重。
 */
let modelsInflight: Promise<void> | null = null

/** 拉模型列表（带在飞去重）；失败退回 DEFAULT_MODELS，不阻塞面板可用 */
async function loadModels(): Promise<void> {
  if (models.value.length) return
  if (!modelsInflight) {
    modelsInflight = (async () => {
      try {
        const list = normalizeModels(await aiApi.tags())
        models.value = list.length ? list : DEFAULT_MODELS.map((m) => ({ ...m }))
      } catch {
        // 接口没通不该让面板不可用：退回兜底那条，错误留给发送时暴露
        models.value = DEFAULT_MODELS.map((m) => ({ ...m }))
      }
    })().finally(() => {
      modelsInflight = null
    })
  }
  await modelsInflight
  if (!modelId.value) modelId.value = models.value[0]?.id ?? ''
  // 记住的上次选择可能已经下线，回退到第一个可用模型
  if (modelId.value && !models.value.some((m) => m.id === modelId.value)) {
    modelId.value = models.value[0]?.id ?? ''
  }
}

export interface AddFilesResult {
  /** 成功加入待发区的文件数 */
  added: number
  /** 被拒绝的文件名（超大小或超数量），交给界面提示 */
  skipped: string[]
}

/** 把用户选的文件加进待发区，超限（数量 / 体积）的记入 skipped */
function addFiles(files: ArrayLike<File> | null | undefined): AddFilesResult {
  const incoming = Array.from(files ?? [])
  const skipped: string[] = []
  let added = 0
  for (const file of incoming) {
    if (!file) continue
    if (attachments.value.length >= MAX_FILES || file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      skipped.push(file.name)
      continue
    }
    attachments.value = [
      ...attachments.value,
      { uid: uid(), name: file.name, size: file.size, type: file.type || '', file }
    ]
    added += 1
  }
  return { added, skipped }
}

/** 从待发区移除指定附件 */
function removeAttachment(targetUid: string): void {
  attachments.value = attachments.value.filter((a) => a.uid !== targetUid)
}

/**
 * 交给模型的历史：只带文本。附件不拼进 content —— Ollama 的 `/api/chat` 不收文档，
 * 拼文件名只会让模型把文件名当正文。
 */
function plainHistory(list: ChatMessage[]): { role: 'user' | 'assistant'; content: string }[] {
  return list
    .filter((m) => !m.error && !m.pending && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content }))
}

/** 打开面板：核对归属、拉模型列表 */
function open(): void {
  ensureOwner()
  visible.value = true
  void loadModels()
}

/** 关闭面板（会话与生成中的请求都保留） */
function close(): void {
  visible.value = false
}

/** 顶栏图标用：开 ↔ 关 */
function toggle(): void {
  if (visible.value) close()
  else open()
}

/** 可否发送：不在生成中，且草稿或附件至少有一项 */
const canSend = computed(
  () => !sending.value && (draft.value.trim().length > 0 || attachments.value.length > 0)
)

/**
 * 发送一条消息：本地先插入 user 消息 + assistant 占位，再调 `/api/chat`。
 * 所有写入都认发送时捕获的 sid（不认「当前会话」），生成中切走也能写回原会话。
 */
async function send(): Promise<void> {
  if (!canSend.value) return
  ensureOwner()
  ensureSession()
  const sid = activeId.value
  const current = sessionById(sid)
  if (!sid || !current) return
  lastError.value = ''

  const files = attachments.value
  const text = draft.value.trim()
  // 历史必须在推入本条之前取，否则最后一条会被重复送一次
  const history = plainHistory(current.messages)
  const userMsg: ChatMessage = {
    id: uid(),
    role: 'user',
    content: text,
    time: Date.now(),
    attachments: files.length ? files.map((f) => ({ ...f })) : undefined
  }

  // 列表没回来就发送时 modelId 可能还是空 —— 兜默认值，否则请求里 model 为空必然 400
  const model = modelId.value || models.value[0]?.id || DEFAULT_MODELS[0]?.id || ''
  const replyId = uid()

  updateSession(sid, (s) => ({
    ...s,
    // 首条消息顺便生成标题；之后不再自动改，避免重命名被覆盖
    title: s.title || titleFrom(text),
    model,
    updatedAt: userMsg.time,
    messages: [
      ...s.messages,
      userMsg,
      { id: replyId, role: 'assistant', content: '', model, time: userMsg.time, pending: true }
    ]
  }))

  draft.value = ''
  attachments.value = []
  persist()

  /** 把回复文本写进 sid 会话里 replyId 那条占位消息 */
  const append = (chunk: string): void => {
    updateSession(sid, (s) => ({
      ...s,
      messages: s.messages.map((m) => (m.id === replyId ? { ...m, content: m.content + chunk } : m))
    }))
  }

  const controller = new AbortController()
  controllers.set(sid, controller)
  generating.value = [...generating.value, sid]

  try {
    const data = await aiApi.chat(
      {
        model,
        messages: [...history, { role: 'user', content: text }],
        stream: false,
        keep_alive: '30m',
        options: { num_ctx: 8192 }
      },
      controller.signal
    )
    append(String(data?.message?.content ?? ''))
    finishReply(sid, replyId, { error: false })
  } catch (e: any) {
    const aborted = controller.signal.aborted || e?.code === 'ERR_CANCELED'
    // 中断是用户主动的，不算失败
    finishReply(sid, replyId, { error: !aborted })
    // Ollama 的失败原因在 response.data.error（如 {"error":"model 'x' not found"}）
    if (!aborted)
      lastError.value = String(e?.response?.data?.error ?? e?.message ?? 'request failed')
  } finally {
    controllers.delete(sid)
    generating.value = generating.value.filter((g) => g !== sid)
    persist()
  }
}

/** 收尾：把占位消息的 pending 置 false（失败时补 error 标记），并刷新会话时间戳 */
function finishReply(sid: string, replyId: string, patch: { error: boolean }): void {
  updateSession(sid, (s) => ({
    ...s,
    updatedAt: Date.now(),
    messages: s.messages.map((m) => (m.id === replyId ? { ...m, pending: false, ...patch } : m))
  }))
}

/** 只中断当前会话；其他会话在后台生成的不受影响 */
function stop(): void {
  controllers.get(activeId.value)?.abort()
}

/** 清空当前会话的消息。生成中先中断，否则回调会往已清空的列表里继续写 */
function clear(): void {
  stop()
  const sid = activeId.value
  if (!sid) return
  updateSession(sid, (s) => ({ ...s, title: '', messages: [], updatedAt: Date.now() }))
  lastError.value = ''
  persistNow()
}

/** 侧栏用的会话列表：按最近使用倒序 */
const sortedSessions = computed(() => [...sessions.value].sort((a, b) => b.updatedAt - a.updatedAt))

export interface SessionBucket {
  /** null = 未分组 */
  group: ChatGroup | null
  sessions: ChatSession[]
}

/** 侧栏的渲染数据：未分组置顶，其余按分组创建顺序；空分组也保留，否则新建后看不到 */
const groupedSessions = computed<SessionBucket[]>(() => {
  const known = groups.value.map((g) => g.id)
  const ungrouped = sortedSessions.value.filter((s) => !s.groupId || !known.includes(s.groupId))
  return [
    { group: null, sessions: ungrouped },
    ...groups.value.map((g) => ({
      group: g,
      sessions: sortedSessions.value.filter((s) => s.groupId === g.id)
    }))
  ]
})

export interface AiChatApi {
  /** 弹窗开关 */
  visible: Ref<boolean>
  /** 当前会话的消息（派生自 sessions，只读） */
  messages: ComputedRef<ChatMessage[]>
  /** 可选模型列表 */
  models: Ref<AiModel[]>
  /** 当前选中的模型 id */
  modelId: Ref<string>
  /** 当前会话是否在生成中 */
  sending: ComputedRef<boolean>
  /** 输入框草稿 */
  draft: Ref<string>
  /** 待发送附件 */
  attachments: Ref<ChatAttachment[]>
  /** 最近一次发送失败的原因 */
  lastError: Ref<string>
  /** 是否可发送（有内容且当前会话不在生成中） */
  canSend: ComputedRef<boolean>
  /** 全部会话（按最近使用倒序） */
  sessions: ComputedRef<ChatSession[]>
  /** 分组列表 */
  groups: Ref<ChatGroup[]>
  /** 当前会话 id */
  activeId: Ref<string>
  /** 当前会话对象 */
  activeSession: ComputedRef<ChatSession | undefined>
  /** 侧栏渲染数据（未分组置顶 + 各分组桶） */
  groupedSessions: ComputedRef<SessionBucket[]>
  /** 打开面板 */
  open: () => void
  /** 关闭面板 */
  close: () => void
  /** 切换面板开关 */
  toggle: () => void
  /** 发送当前草稿与附件 */
  send: () => Promise<void>
  /** 中断当前会话的生成 */
  stop: () => void
  /** 清空当前会话 */
  clear: () => void
  /** 添加待发附件（返回成功数与被拒文件名） */
  addFiles: (files: ArrayLike<File> | null | undefined) => AddFilesResult
  /** 移除一个待发附件 */
  removeAttachment: (uid: string) => void
  /** 新建会话（可指定分组） */
  createSession: (groupId?: string) => void
  /** 切换会话 */
  switchSession: (id: string) => void
  /** 重命名会话 */
  renameSession: (id: string, title: string) => void
  /** 删除会话 */
  removeSession: (id: string) => void
  /** 移动会话到分组 */
  moveSession: (id: string, groupId: string) => void
  /** 新建分组（重名返回已有 id） */
  createGroup: (name: string) => string | null
  /** 重命名分组 */
  renameGroup: (id: string, name: string) => void
  /** 删除分组（会话回落未分组） */
  removeGroup: (id: string) => void
  /** 折叠 / 展开分组 */
  toggleGroup: (id: string) => void
  /** 重新按登录人载入历史（登出再登录时调用） */
  reload: () => void
}

/**
 * 取全局 AI 会话状态。
 * 第一次调用时按当前登录人载入历史与模型列表，之后所有调用点共享同一份。
 */
export function useAiChat(): AiChatApi {
  bindFlushOnce()
  if (!owner) loadFor(resolveUserId())
  ensureSession()
  // 先给个默认模型：模型接口慢或失败时下拉框不至于空着，用户也不会发出空 model 的请求
  if (!modelId.value) modelId.value = DEFAULT_MODELS[0]?.id ?? ''
  // 模型列表等真正打开面板时再拉（open() 里调）。挂在这里会让每个页面加载都打一次
  // /api/tags —— 用户可能从不打开 AI 面板，静态部署下还会平白多一条 404。

  return {
    visible,
    messages,
    models,
    modelId,
    sending,
    draft,
    attachments,
    lastError,
    canSend,
    sessions: sortedSessions,
    groups,
    activeId,
    activeSession,
    groupedSessions,
    open,
    close,
    toggle,
    send,
    stop,
    clear,
    addFiles,
    removeAttachment,
    createSession,
    switchSession,
    renameSession,
    removeSession,
    moveSession,
    createGroup,
    renameGroup,
    removeGroup,
    toggleGroup,
    reload: () => loadFor(resolveUserId())
  }
}

/** 供页面在登录人变化后主动切换归属（避免看到上一个人的对话） */
export function switchAiChatUser(userId?: string): void {
  loadFor(userId || resolveUserId())
}

/** 仅供测试：把单例恢复到初始态 */
export function resetAiChatForTest(): void {
  cancelScheduledSave()
  controllers.forEach((c) => c.abort())
  controllers.clear()
  visible.value = false
  sessions.value = []
  groups.value = []
  activeId.value = ''
  models.value = []
  modelId.value = ''
  generating.value = []
  draft.value = ''
  attachments.value = []
  lastError.value = ''
  owner = ''
}
