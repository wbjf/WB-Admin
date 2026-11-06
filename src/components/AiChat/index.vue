<script setup lang="ts">
import {
  computed,
  defineAsyncComponent,
  h,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch
} from 'vue'
import { ElMessage, ElMessageBox, type UploadFile, type UploadInstance } from 'element-plus'
import {
  ArrowRight,
  ChatLineSquare,
  Close,
  Delete,
  Document,
  DocumentCopy,
  FolderAdd,
  FullScreen,
  MagicStick,
  MoreFilled,
  Paperclip,
  Picture,
  Plus,
  Promotion,
  VideoPause
} from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '@/stores/modules/settings'
import { useUserStore } from '@/stores/modules/user'
import { formatSize, MAX_FILES, MAX_FILE_SIZE_MB, useAiChat } from './useAiChat'
import type { ChatAttachment, ChatMessage, ChatSession } from '@/types'

defineOptions({ name: 'AiChat' })

/**
 * 全局 AI 对话弹窗。
 *
 * 三处布局是需求里点名的：左下角「添加文件」、右下角「模型选择 + 发送」。
 * 消息体走 markdown 渲染（复用仓库里已装的 md-editor-v3），用异步组件是因为
 * 它体积不小 —— 只有真正打开过 AI 面板的人才会下载这份 chunk。
 */
const MdPreview = defineAsyncComponent({
  loader: async () => {
    // mermaid 一起懒加载：AI 回复里的 ```mermaid 代码块由 md-editor-v3 渲染成流程图。
    // 不配 instance 的话它会去 unpkg CDN 拉 mermaid 脚本 —— 国内拉不动，
    // 图表静默退化成代码文本。本地注入体积约 1MB，只在首个 mermaid 场景下载一次。
    const [mod, mermaid] = await Promise.all([import('md-editor-v3'), import('mermaid')])
    // 样式跟着预览组件一起懒加载，避免首屏多一份 200KB 的 css
    await import('md-editor-v3/lib/style.css')
    mod.config({ editorExtensions: { mermaid: { instance: mermaid.default } } })
    return mod.MdPreview
  },
  // 加载失败降级成纯文本：宁可排版差一点，也不能让整条回复变成空白
  errorComponent: {
    props: ['modelValue'],
    setup(props: { modelValue?: string }) {
      return () => h('div', { class: 'wb-ai__plain' }, String(props.modelValue ?? ''))
    }
  }
})

const { t } = useI18n()
const settings = useSettingsStore()
const userStore = useUserStore()

/*
 * 解构到顶层：ref 在模板里会自动解包，所以模板里直接写 `modelId` 而不是 `modelId.value`。
 * 单例状态的引用本身不会变，所以这里的解构是安全的（丢的只是 .value 包装，不是响应式）。
 */
const {
  visible,
  messages,
  models,
  modelId,
  sending,
  draft,
  attachments,
  lastError,
  canSend,
  groups,
  activeId,
  groupedSessions,
  close,
  send: doSend,
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
  toggleGroup
} = useAiChat()

const fileRef = ref<UploadInstance>()
const inputRef = ref<{ focus: () => void } | null>(null)
const scrollRef = ref<HTMLElement | null>(null)
const fullscreen = ref(false)
/** 窄屏默认收起会话栏，否则消息区只剩一条缝 */
const sideOpen = ref(window.innerWidth > 900)

const ACCEPT = 'image/*,.pdf,.txt,.md,.json,.csv,.xlsx,.xls,.docx,.doc,.pptx,.zip'

const isEmpty = computed(() => messages.value.length === 0)

/** 建议问题：空态时一键填入，省得用户不知道能问什么 */
const suggestions = computed(() => [t('ai.suggest1'), t('ai.suggest2'), t('ai.suggest3')])

const mdTheme = computed(() => (settings.isDark ? 'dark' : 'light'))

const dialogWidth = computed(() => (fullscreen.value ? '100%' : 'min(820px, 94vw)'))

function scrollToBottom(): void {
  const el = scrollRef.value
  if (!el) return
  el.scrollTop = el.scrollHeight
}

/** 内容一变（含流式增量）就贴底。消息不多，直接全量滚不心疼 */
watch(
  () => messages.value.map((m) => `${m.id}:${m.content.length}`).join('|') + String(sending.value),
  () => void nextTick(scrollToBottom)
)

watch(
  () => visible.value,
  (open) => {
    if (!open) return
    void nextTick(() => {
      scrollToBottom()
      applyInputHeight()
      inputRef.value?.focus()
    })
  }
)

/*
 * ── 输入法回车守卫 ─────────────────────────────────────────────
 * 只用 ev.isComposing 是不够的：输入法上屏时事件顺序在不同浏览器/输入法下并不一致。
 * Safari 与部分第三方输入法是 **compositionend → keydown(Enter, isComposing=false)**，
 * 于是「按回车确认候选词」会被当成发送（实测打两个字发一条）。
 * 所以额外用 composition 生命周期记状态：组合中不发；刚上屏的 IME_GUARD_MS 内那一发也吞掉。
 * 窗口只拦第一次 —— 命中后清零，用户上屏完马上再按 Enter 仍能正常发送。
 *
 * 模板上只挂 `@keydown.enter`：裸 `@keydown` 会把 Backspace / Delete / 方向键一起送进来，
 * 草稿非空时它们同样满足 canSend，「输入一段文字再按退格」会被当成发送。
 */
const IME_GUARD_MS = 100
let composing = false
let composeEndedAt = 0

function onCompositionStart(): void {
  composing = true
}

function onCompositionEnd(): void {
  composing = false
  composeEndedAt = Date.now()
}

function onEnter(e: KeyboardEvent | Event): void {
  const ev = e as KeyboardEvent
  if (ev.shiftKey || ev.ctrlKey || ev.metaKey || ev.altKey) return

  const imePending =
    composing ||
    ev.isComposing ||
    // 229 = IME 正在处理的按键，部分输入法在 keydown 上不会标记 isComposing
    ev.keyCode === 229 ||
    (composeEndedAt > 0 && Date.now() - composeEndedAt < IME_GUARD_MS)

  if (imePending) {
    // 只吞掉紧跟在上屏之后的那一次；否则「上屏 + 立刻回车发送」要按两次才有效果
    if (!composing && !ev.isComposing && ev.keyCode !== 229) composeEndedAt = 0
    return
  }

  ev.preventDefault()
  void send()
}

async function send(): Promise<void> {
  if (!canSend.value) return
  await doSend()
  await nextTick()
  scrollToBottom()
}

function applySuggestion(text: string): void {
  draft.value = text
  void nextTick(() => inputRef.value?.focus())
}

/*
 * ── 输入框高度 ────────────────────────────────────────────────
 * 不用 el-input 的 autosize：它把高度算成**内联样式**，而且只在 autosize 为真时重算。
 * 一旦用户拖过高度再关掉 autosize，那份 `height/min-height` 还留在元素上，
 * 优先级高于任何 class 规则（实测拖到 138px，元素仍死死停在 58px）。
 * 所以高度全部自己管：inputH = null 时按内容量（2~6 行），拖动/键盘后固定像素。
 */
const inputH = ref<number | null>(null)
const resizing = ref(false)

function composerTextarea(): HTMLTextAreaElement | null {
  return document.querySelector<HTMLTextAreaElement>('.wb-ai .wb-ai__input textarea')
}

/** 行高与「内边距 + 边框」决定下限和自动增高的上限 —— 从计算样式里取，不写死像素 */
function inputMetrics(ta: HTMLTextAreaElement): {
  minH: number
  maxAutoH: number
  borderH: number
} {
  const cs = getComputedStyle(ta)
  const lineH = parseFloat(cs.lineHeight) || Math.round(parseFloat(cs.fontSize) * 1.5)
  const borderH = parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth)
  const chromeH = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + borderH
  return {
    minH: Math.round(lineH * 2 + chromeH),
    maxAutoH: Math.round(lineH * 6 + chromeH),
    borderH
  }
}

/**
 * 拖动上限，两条约束取小：
 * ① 别把对话区挤没 —— 按「输入框底边 → 弹窗顶边」的真实几何算，至少留 170px
 *    （表头 60 + 消息区 110）。不用 calc(100vh - 260px) 那种硬编码：它会随手风琴/
 *    页脚/浏览器工具栏漂移，既不准也不会自愈。
 * ② 窗口模式下弹窗高度是跟着输入框一起长的，所以还要受视口限制；全屏模式增长由
 *    对话区吸收（弹窗高度不变），不受这条约束。
 */
function maxInputHeight(ta: HTMLTextAreaElement): number {
  const dialog = ta.closest('.wb-ai') as HTMLElement | null
  const taBox = ta.getBoundingClientRect()
  const dlgBox = (dialog ?? document.documentElement).getBoundingClientRect()
  const byChat = taBox.bottom - dlgBox.top - 170
  const byViewport = dialog?.classList.contains('is-fullscreen')
    ? Number.POSITIVE_INFINITY
    : ta.offsetHeight + (window.innerHeight - dlgBox.height - 24)
  return Math.min(byChat, byViewport)
}

/** 把当前状态写到 textarea 上：拖动模式用固定值，自动模式先归零再量内容 */
function applyInputHeight(): void {
  const ta = composerTextarea()
  // 弹窗没打开时（display:none）量出来全是 0，直接跳过
  if (!ta || !ta.offsetParent) return
  const { minH, maxAutoH, borderH } = inputMetrics(ta)

  if (inputH.value) {
    ta.style.height = `${Math.max(inputH.value, minH)}px`
    return
  }
  ta.style.height = 'auto'
  // scrollHeight 不含边框，补回来才是真正要设的高度
  const need = ta.scrollHeight + borderH
  ta.style.height = `${Math.min(Math.max(need, minH), Math.max(maxAutoH, minH))}px`
}

function clampToBounds(next: number, ta: HTMLTextAreaElement): number {
  const { minH } = inputMetrics(ta)
  return Math.round(Math.min(Math.max(next, minH), Math.max(maxInputHeight(ta), minH)))
}

function onResizeStart(e: PointerEvent): void {
  if (e.button !== 0) return
  const ta = composerTextarea()
  if (!ta) return
  e.preventDefault()

  const handle = e.currentTarget as HTMLElement
  const startY = e.clientY
  const startH = ta.offsetHeight
  // 上限在按下时定死：拖动过程中弹窗高度会变（align-center 上下同时长），
  // 边拖边算会形成反馈回路，手感发飘
  const { minH } = inputMetrics(ta)
  const maxH = Math.max(maxInputHeight(ta), minH)
  const prevCursor = document.body.style.cursor
  const prevSelect = document.body.style.userSelect

  // 指针捕获 + 锁选区：拖到弹窗外面也不会中断，也不会顺手选中半屏文字
  handle.setPointerCapture?.(e.pointerId)
  document.body.style.cursor = 'row-resize'
  document.body.style.userSelect = 'none'
  resizing.value = true

  const onMove = (ev: PointerEvent) => {
    // 往上拖 = 变高
    inputH.value = Math.round(Math.min(maxH, Math.max(minH, startH + (startY - ev.clientY))))
    applyInputHeight()
  }
  const onEnd = () => {
    resizing.value = false
    document.body.style.cursor = prevCursor
    document.body.style.userSelect = prevSelect
    handle.removeEventListener('pointermove', onMove)
    handle.removeEventListener('pointerup', onEnd)
    handle.removeEventListener('pointercancel', onEnd)
  }

  handle.addEventListener('pointermove', onMove)
  handle.addEventListener('pointerup', onEnd)
  handle.addEventListener('pointercancel', onEnd)
}

/** 键盘也能调：拖动条获得焦点后按 ↑ / ↓ 各 16px */
function nudgeInputHeight(delta: number): void {
  const ta = composerTextarea()
  if (!ta) return
  inputH.value = clampToBounds((inputH.value ?? ta.offsetHeight) + delta, ta)
  applyInputHeight()
}

/** 双击复位：回到「跟随内容自动增高」 */
function resetInputHeight(): void {
  inputH.value = null
  applyInputHeight()
}

/** 视口或全屏状态变了就把固定高度收回来，否则弹窗会顶出屏幕 */
function fitInputHeight(): void {
  const ta = composerTextarea()
  if (!ta || !ta.offsetParent) return
  if (inputH.value) inputH.value = clampToBounds(inputH.value, ta)
  applyInputHeight()
}

// 输入内容变了要重量（自动增高就靠这个）
watch(draft, () => void nextTick(applyInputHeight))
watch(fullscreen, () => void nextTick(fitInputHeight))
onMounted(() => {
  window.addEventListener('resize', fitInputHeight)
})
onBeforeUnmount(() => window.removeEventListener('resize', fitInputHeight))

function onFileChange(file: UploadFile): void {
  const raw = file.raw
  if (!raw) return
  const { skipped } = addFiles([raw])
  if (skipped.length) {
    ElMessage.warning(t('ai.fileRejected', { n: MAX_FILE_SIZE_MB, max: MAX_FILES }))
  }
  // el-upload 内部会累计 fileList，不清掉的话下一次 on-change 的下标会越滚越大
  fileRef.value?.clearFiles()
}

function isImage(a: ChatAttachment): boolean {
  return (a.type || '').startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(a.name)
}

async function copy(msg: ChatMessage): Promise<void> {
  try {
    await navigator.clipboard.writeText(msg.content)
    ElMessage.success(t('common.copied'))
  } catch {
    ElMessage.error(t('common.failed'))
  }
}

async function clearAll(): Promise<void> {
  if (!messages.value.length) return
  try {
    await ElMessageBox.confirm(t('ai.clearConfirm'), t('common.tip'), {
      confirmButtonText: t('common.confirm'),
      cancelButtonText: t('common.cancel'),
      type: 'warning'
    })
    clear()
  } catch {
    /* cancel */
  }
}

/* ── 会话与分组 ──────────────────────────────────────────────── */

/** 统一的文本输入框：null = 取消；空串 = 没填（调用方忽略） */
async function promptText(
  title: string,
  value: string,
  placeholder: string
): Promise<string | null> {
  try {
    const { value: input } = await ElMessageBox.prompt(title, t('common.tip'), {
      inputValue: value,
      inputPlaceholder: placeholder,
      confirmButtonText: t('common.confirm'),
      cancelButtonText: t('common.cancel'),
      // 校验放在弹窗里做：关掉再提示「名称不能为空」体验很差
      inputValidator: (v: string) => !!String(v ?? '').trim() || t('ai.nameRequired')
    })
    return String(input ?? '').trim()
  } catch {
    return null
  }
}

function findSession(id: string): ChatSession | undefined {
  for (const bucket of groupedSessions.value) {
    const hit = bucket.sessions.find((s) => s.id === id)
    if (hit) return hit
  }
  return undefined
}

function onNewChat(): void {
  /*
   * 新建对话一律落在「未分组」。
   * 曾经让新对话跟随当前会话的分组（在某个组里点新建就留在该组），实际用起来很别扭：
   * 手动把几条对话归组之后，接下来新建的全都自动跑进那个组，还得再手动挪出来。
   * 归组是明确的动作，只由「移动到分组」触发。
   */
  createSession()
}

async function onNewGroup(): Promise<void> {
  const name = await promptText(t('ai.newGroup'), '', t('ai.groupName'))
  if (name) createGroup(name)
}

async function onSessionCommand(cmd: string, id: string): Promise<void> {
  if (cmd === 'rename') {
    const name = await promptText(
      t('ai.renameSession'),
      findSession(id)?.title ?? '',
      t('ai.sessionTitle')
    )
    if (name) renameSession(id, name)
    return
  }
  if (cmd === 'remove') {
    try {
      await ElMessageBox.confirm(t('ai.deleteSessionConfirm'), t('ai.deleteSession'), {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      })
      removeSession(id)
    } catch {
      /* cancel */
    }
    return
  }
  // 移动目标直接列在菜单里（move:<groupId>，空串代表未分组），省掉二级菜单
  if (cmd.startsWith('move:')) moveSession(id, cmd.slice(5))
}

async function onGroupCommand(cmd: string, id: string): Promise<void> {
  if (cmd === 'rename') {
    const name = await promptText(
      t('ai.renameGroup'),
      groups.value.find((g) => g.id === id)?.name ?? '',
      t('ai.groupName')
    )
    if (name) renameGroup(id, name)
    return
  }
  try {
    await ElMessageBox.confirm(t('ai.deleteGroupConfirm'), t('ai.deleteGroup'), {
      confirmButtonText: t('common.confirm'),
      cancelButtonText: t('common.cancel'),
      type: 'warning'
    })
    removeGroup(id)
  } catch {
    /* cancel */
  }
}

/** 会话项上的时间：今天显示时分，更早显示月-日 */
function dateText(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  if (d.toDateString() === new Date().toDateString()) {
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`
  }
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// 切换会话后要贴到底：新会话是空态，旧会话应该停在最后一轮
watch(activeId, () => void nextTick(scrollToBottom))

function timeText(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}
</script>

<template>
  <el-dialog
    v-model="visible"
    class="wb-ai"
    modal-class="wb-ai-modal"
    :width="dialogWidth"
    :fullscreen="fullscreen"
    :close-on-click-modal="false"
    :show-close="false"
    append-to-body
    align-center
  >
    <template #header>
      <div class="wb-ai__header">
        <div class="wb-ai__title">
          <span class="wb-ai__logo">
            <el-icon><MagicStick /></el-icon>
          </span>
          <span>{{ t('ai.title') }}</span>
          <el-tag v-if="modelId" size="small" type="info" effect="plain">
            {{ models.find((m) => m.id === modelId)?.name || modelId }}
          </el-tag>
        </div>
        <div class="wb-ai__actions">
          <el-tooltip :content="sideOpen ? t('ai.sideHide') : t('ai.sideShow')" placement="bottom">
            <el-icon class="wb-ai__act" data-test="ai-side-toggle" @click="sideOpen = !sideOpen">
              <ChatLineSquare />
            </el-icon>
          </el-tooltip>
          <el-tooltip :content="t('ai.newChat')" placement="bottom">
            <el-icon class="wb-ai__act" data-test="ai-new-chat" @click="onNewChat">
              <Plus />
            </el-icon>
          </el-tooltip>
          <el-tooltip
            :content="fullscreen ? t('common.exitFullscreen') : t('common.fullscreen')"
            placement="bottom"
          >
            <el-icon class="wb-ai__act" data-test="ai-fullscreen" @click="fullscreen = !fullscreen">
              <component :is="fullscreen ? Close : FullScreen" />
            </el-icon>
          </el-tooltip>
          <el-tooltip :content="t('ai.clear')" placement="bottom">
            <el-icon class="wb-ai__act" data-test="ai-clear" @click="clearAll"><Delete /></el-icon>
          </el-tooltip>
          <el-tooltip :content="t('common.close')" placement="bottom">
            <el-icon class="wb-ai__act" @click="close()"><Close /></el-icon>
          </el-tooltip>
        </div>
      </div>
    </template>

    <div class="wb-ai__body">
      <!-- 会话栏：分组 + 会话列表 -->
      <aside v-show="sideOpen" class="wb-ai__side" data-test="ai-side">
        <div class="wb-ai__side-head">
          <el-button
            class="wb-ai__new"
            size="small"
            :icon="Plus"
            data-test="ai-side-new"
            @click="onNewChat"
          >
            {{ t('ai.newChat') }}
          </el-button>
        </div>

        <div class="wb-ai__sessions">
          <div
            v-for="bucket in groupedSessions"
            :key="bucket.group?.id || '__ungrouped'"
            class="wb-ai__group"
          >
            <!-- 没有分组时不显示「未分组」标题，它就是一个普通列表 -->
            <div
              v-if="bucket.group"
              class="wb-ai__group-head"
              data-test="ai-group"
              @click="toggleGroup(bucket.group.id)"
            >
              <el-icon class="wb-ai__chevron" :class="{ 'is-collapsed': bucket.group.collapsed }">
                <ArrowRight />
              </el-icon>
              <span class="wb-ai__group-name" :title="bucket.group.name">
                {{ bucket.group.name }}
              </span>
              <span class="wb-ai__group-count">{{ bucket.sessions.length }}</span>
              <el-dropdown
                trigger="click"
                @command="(cmd: string) => onGroupCommand(cmd, bucket.group!.id)"
              >
                <el-icon class="wb-ai__more" data-test="ai-group-more" @click.stop>
                  <MoreFilled />
                </el-icon>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="rename">{{ t('ai.rename') }}</el-dropdown-item>
                    <el-dropdown-item command="remove" divided>
                      {{ t('ai.deleteGroup') }}
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
            <div v-else-if="groups.length" class="wb-ai__group-head is-plain">
              {{ t('ai.ungrouped') }}
            </div>

            <template v-if="!bucket.group?.collapsed">
              <div
                v-for="s in bucket.sessions"
                :key="s.id"
                class="wb-ai__session"
                :class="{ 'is-active': s.id === activeId }"
                data-test="ai-session"
                @click="switchSession(s.id)"
              >
                <span class="wb-ai__session-main">
                  <span class="wb-ai__session-title">{{ s.title || t('ai.defaultTitle') }}</span>
                  <span class="wb-ai__session-time">{{ dateText(s.updatedAt) }}</span>
                </span>
                <el-dropdown
                  trigger="click"
                  @command="(cmd: string) => onSessionCommand(cmd, s.id)"
                >
                  <el-icon class="wb-ai__more" data-test="ai-session-more" @click.stop>
                    <MoreFilled />
                  </el-icon>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item command="rename">{{ t('ai.rename') }}</el-dropdown-item>
                      <el-dropdown-item
                        v-for="g in groups"
                        :key="g.id"
                        :command="`move:${g.id}`"
                        :disabled="s.groupId === g.id"
                      >
                        {{ t('ai.moveTo') }} · {{ g.name }}
                      </el-dropdown-item>
                      <el-dropdown-item command="move:" :disabled="!s.groupId">
                        {{ t('ai.moveTo') }} · {{ t('ai.ungrouped') }}
                      </el-dropdown-item>
                      <el-dropdown-item command="remove" divided>
                        {{ t('ai.deleteSession') }}
                      </el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>
              <div v-if="!bucket.sessions.length" class="wb-ai__group-empty">
                {{ t('ai.emptyGroup') }}
              </div>
            </template>
          </div>
        </div>

        <div class="wb-ai__side-foot">
          <el-button
            link
            size="small"
            :icon="FolderAdd"
            data-test="ai-new-group"
            @click="onNewGroup"
          >
            {{ t('ai.newGroup') }}
          </el-button>
        </div>
      </aside>

      <div class="wb-ai__chat">
        <div ref="scrollRef" class="wb-ai__scroll">
          <!-- 空态 -->
          <div v-if="isEmpty" class="wb-ai__empty">
            <div class="wb-ai__empty-logo">
              <el-icon><MagicStick /></el-icon>
            </div>
            <div class="wb-ai__empty-title">{{ t('ai.emptyTitle') }}</div>
            <div class="wb-ai__empty-desc">{{ t('ai.emptyDesc') }}</div>
            <div class="wb-ai__chips">
              <span
                v-for="s in suggestions"
                :key="s"
                class="wb-ai__chip"
                @click="applySuggestion(s)"
              >
                {{ s }}
              </span>
            </div>
          </div>

          <!-- 消息 -->
          <div v-for="msg in messages" :key="msg.id" class="wb-ai__row" :class="`is-${msg.role}`">
            <div class="wb-ai__avatar" :class="`is-${msg.role}`">
              <el-icon v-if="msg.role === 'assistant'"><MagicStick /></el-icon>
              <template v-else>{{ userStore.displayName.slice(0, 1) }}</template>
            </div>
            <div class="wb-ai__main">
              <div class="wb-ai__bubble" :class="{ 'is-error': msg.error }">
                <div v-if="msg.attachments?.length" class="wb-ai__files">
                  <span v-for="a in msg.attachments" :key="a.uid" class="wb-ai__file">
                    <el-icon><component :is="isImage(a) ? Picture : Document" /></el-icon>
                    <span class="wb-ai__file-name">{{ a.name }}</span>
                    <span class="wb-ai__file-size">{{ formatSize(a.size) }}</span>
                  </span>
                </div>

                <!-- 助手回复走 markdown；流式中也实时渲染，看起来才像在「打字」 -->
                <MdPreview
                  v-if="msg.role === 'assistant' && msg.content"
                  :model-value="msg.content"
                  :theme="mdTheme"
                  class="wb-ai__md"
                  data-test="ai-msg-md"
                />
                <div v-else-if="msg.content" class="wb-ai__plain">{{ msg.content }}</div>

                <div v-if="msg.pending && !msg.content" class="wb-ai__typing">
                  <i />
                  <i />
                  <i />
                </div>
                <span v-else-if="msg.pending" class="wb-ai__caret" />

                <div v-if="msg.error" class="wb-ai__error">{{ t('ai.failed') }}</div>
              </div>

              <div class="wb-ai__meta">
                <span>{{ timeText(msg.time) }}</span>
                <span v-if="msg.role === 'assistant' && msg.model" class="wb-ai__meta-model">
                  {{ msg.model }}
                </span>
                <el-icon
                  v-if="msg.content && !msg.pending"
                  class="wb-ai__copy"
                  :title="t('ai.copy')"
                  @click="copy(msg)"
                >
                  <DocumentCopy />
                </el-icon>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="wb-ai__composer">
        <!-- 拖动条：上下拖动改输入框高度，双击复位（键盘 ↑/↓ 也可） -->
        <div
          class="wb-ai__resizer"
          :class="{ 'is-active': resizing }"
          role="separator"
          aria-orientation="horizontal"
          :aria-label="t('ai.resizeHint')"
          :title="t('ai.resizeHint')"
          tabindex="0"
          data-test="ai-resizer"
          @pointerdown="onResizeStart"
          @dblclick="resetInputHeight"
          @keydown.up.prevent="nudgeInputHeight(16)"
          @keydown.down.prevent="nudgeInputHeight(-16)"
        >
          <span class="wb-ai__resizer-bar" />
        </div>

        <el-alert
          v-if="lastError"
          :title="lastError"
          type="error"
          :closable="true"
          show-icon
          class="wb-ai__alert"
          @close="lastError = ''"
        />

        <!-- 待发送附件 -->
        <div v-if="attachments.length" class="wb-ai__pending">
          <span v-for="a in attachments" :key="a.uid" class="wb-ai__pending-item">
            <el-icon><component :is="isImage(a) ? Picture : Document" /></el-icon>
            <span class="wb-ai__pending-name" :title="a.name">{{ a.name }}</span>
            <span class="wb-ai__pending-size">{{ formatSize(a.size) }}</span>
            <el-icon class="wb-ai__pending-del" @click="removeAttachment(a.uid)"><Close /></el-icon>
          </span>
        </div>

        <el-input
          ref="inputRef"
          v-model="draft"
          type="textarea"
          resize="none"
          :rows="2"
          :placeholder="t('ai.placeholder')"
          class="wb-ai__input"
          data-test="ai-input"
          @keydown.enter="onEnter"
          @compositionstart="onCompositionStart"
          @compositionend="onCompositionEnd"
        />

        <div class="wb-ai__bar">
          <div class="wb-ai__bar-left">
            <el-upload
              ref="fileRef"
              class="wb-ai__upload"
              :auto-upload="false"
              :show-file-list="false"
              :multiple="true"
              :accept="ACCEPT"
              :on-change="onFileChange"
            >
              <el-button :icon="Paperclip" size="small" data-test="ai-add-file">
                {{ t('ai.addFile') }}
              </el-button>
            </el-upload>
            <span class="wb-ai__hint">
              {{ t('ai.fileHint', { n: MAX_FILE_SIZE_MB, max: MAX_FILES }) }}
            </span>
          </div>

          <div class="wb-ai__bar-right">
            <el-select
              v-model="modelId"
              size="small"
              class="wb-ai__model"
              :placeholder="t('ai.model')"
              data-test="ai-model"
            >
              <el-option
                v-for="m in models"
                :key="m.id"
                :label="m.name"
                :value="m.id"
                :disabled="m.disabled"
              >
                <span class="wb-ai__model-opt">
                  <span>{{ m.name }}</span>
                  <span class="wb-ai__model-provider">{{ m.provider }}</span>
                </span>
              </el-option>
            </el-select>

            <el-button
              v-if="!sending"
              type="primary"
              size="small"
              :icon="Promotion"
              :disabled="!canSend"
              data-test="ai-send"
              @click="send"
            >
              {{ t('ai.send') }}
            </el-button>
            <el-button
              v-else
              type="danger"
              size="small"
              plain
              :icon="VideoPause"
              data-test="ai-stop"
              @click="stop()"
            >
              {{ t('ai.stop') }}
            </el-button>
          </div>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.wb-ai {
  --wb-ai-gap: 12px;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  &__title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 15px;
    font-weight: 600;
  }

  &__logo {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 7px;
    color: #fff;
    background: linear-gradient(135deg, var(--el-color-primary), #8b5cf6);
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  &__act {
    width: 28px;
    height: 28px;
    font-size: 16px;
    border-radius: 4px;
    cursor: pointer;
    color: var(--el-text-color-secondary);
    transition: background 0.2s;

    &:hover {
      background: var(--el-fill-color-light);
      color: var(--el-text-color-primary);
    }
  }

  /* 左右分栏：会话栏 + 消息区。高度由 body 定死，两栏各自内部滚动 */
  &__body {
    height: min(58vh, 520px);
    display: flex;
    min-height: 0;
  }

  &__chat {
    flex: 1;
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  &__side {
    flex: none;
    width: 208px;
    display: flex;
    flex-direction: column;
    min-height: 0;
    border-right: 1px solid var(--wb-border);
    background: var(--wb-bg-card);
  }

  &__side-head {
    flex: none;
    padding: 8px;
    border-bottom: 1px solid var(--wb-border);
  }

  &__new {
    width: 100%;
  }

  &__sessions {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 6px;
  }

  &__group + &__group {
    margin-top: 6px;
  }

  &__group-head {
    display: flex;
    align-items: center;
    gap: 4px;
    height: 28px;
    padding: 0 6px;
    border-radius: 5px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
    cursor: pointer;
    user-select: none;

    &:hover {
      background: var(--el-fill-color-light);
    }

    /* 未分组标题只是分隔，不参与折叠 */
    &.is-plain {
      cursor: default;
      color: var(--el-text-color-placeholder);

      &:hover {
        background: transparent;
      }
    }
  }

  &__chevron {
    font-size: 12px;
    /* ArrowRight 默认朝右：展开时转 90° 朝下，收起时回正 */
    transform: rotate(90deg);
    transition: transform 0.2s;

    &.is-collapsed {
      transform: rotate(0deg);
    }
  }

  &__group-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-weight: 600;
  }

  &__group-count {
    font-size: 11px;
    color: var(--el-text-color-placeholder);
  }

  /* 操作入口平时藏起来，hover 才出现，避免列表里一排小点很吵 */
  &__more {
    flex: none;
    padding: 2px;
    font-size: 13px;
    border-radius: 3px;
    color: var(--el-text-color-placeholder);
    opacity: 0;
    transition:
      opacity 0.15s,
      color 0.15s;

    &:hover {
      color: var(--el-color-primary);
      background: var(--el-fill-color);
    }
  }

  &__session:hover &__more,
  &__group-head:hover &__more,
  &__more:focus-visible {
    opacity: 1;
  }

  &__session {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 6px 6px 8px;
    border-radius: 6px;
    cursor: pointer;
    color: var(--el-text-color-regular);

    &:hover {
      background: var(--el-fill-color-light);
    }

    &.is-active {
      background: var(--el-color-primary-light-9);
      color: var(--el-color-primary);
    }
  }

  &__session-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  &__session-title {
    font-size: 12.5px;
    line-height: 1.4;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  &__session-time {
    font-size: 10.5px;
    color: var(--el-text-color-placeholder);
  }

  &__group-empty {
    padding: 6px 8px;
    font-size: 11.5px;
    color: var(--el-text-color-placeholder);
  }

  &__side-foot {
    flex: none;
    padding: 6px 8px;
    border-top: 1px solid var(--wb-border);
  }

  &__scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 16px;
    background: var(--wb-bg-page);
  }

  &__empty {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    text-align: center;
    padding: 0 24px;
  }

  &__empty-logo {
    width: 48px;
    height: 48px;
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    color: #fff;
    background: linear-gradient(135deg, var(--el-color-primary), #8b5cf6);
    margin-bottom: 4px;
  }

  &__empty-title {
    font-size: 15px;
    font-weight: 600;
  }

  &__empty-desc {
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }

  &__chips {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
    margin-top: 12px;
  }

  &__chip {
    font-size: 12px;
    padding: 5px 10px;
    border-radius: 14px;
    border: 1px solid var(--wb-border);
    background: var(--wb-bg-card);
    color: var(--el-text-color-regular);
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      border-color: var(--el-color-primary);
      color: var(--el-color-primary);
    }
  }

  &__row {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;

    &.is-user {
      flex-direction: row-reverse;
    }
  }

  &__avatar {
    flex: none;
    width: 28px;
    height: 28px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    color: #fff;

    &.is-assistant {
      background: linear-gradient(135deg, var(--el-color-primary), #8b5cf6);
    }

    &.is-user {
      background: var(--el-color-success);
    }
  }

  &__main {
    min-width: 0;
    /* 助手回复铺满可用宽度（代码块才有地方展开）；用户消息由下方改成按内容收缩 */
    flex: 1;
    max-width: calc(100% - 48px);
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  &__row.is-user &__main {
    flex: 0 1 auto;
    align-items: flex-end;
  }

  &__bubble {
    padding: 10px 12px;
    border-radius: 10px;
    background: var(--wb-bg-card);
    border: 1px solid var(--wb-border);
    font-size: 13px;
    line-height: 1.7;
    overflow-wrap: anywhere;

    &.is-error {
      border-color: var(--el-color-danger-light-5);
    }
  }

  &__row.is-user &__bubble {
    background: var(--el-color-primary-light-9);
    border-color: var(--el-color-primary-light-7);
  }

  &__plain {
    white-space: pre-wrap;
  }

  /* md-editor-v3 的预览组件自带边框/背景/内边距，放进气泡里要抹平 */
  &__md {
    background: transparent !important;
    border: none !important;
    padding: 0 !important;
    font-size: 13px;

    :deep(.md-editor-preview-wrapper) {
      padding: 0;
    }

    :deep(.md-editor-preview) {
      font-size: 13px;
      line-height: 1.7;
    }

    :deep(pre) {
      margin: 8px 0;
    }

    :deep(p) {
      margin: 0 0 6px;
      &:last-child {
        margin-bottom: 0;
      }
    }

    /* mermaid 图随气泡宽度缩放；原始 SVG 带写死的宽高，不约束会横向撑破 */
    :deep(.md-editor-mermaid svg) {
      max-width: 100%;
      height: auto;
    }
  }

  &__files {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 8px;
  }

  &__file {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    max-width: 240px;
    padding: 2px 8px;
    border-radius: 4px;
    background: var(--el-fill-color-light);
    font-size: 12px;
    color: var(--el-text-color-regular);
  }

  &__file-name {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  &__file-size {
    color: var(--el-text-color-placeholder);
    flex: none;
  }

  &__typing {
    display: flex;
    align-items: center;
    gap: 4px;
    height: 18px;

    i {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--el-text-color-placeholder);
      animation: wb-ai-blink 1.2s infinite ease-in-out;

      &:nth-child(2) {
        animation-delay: 0.2s;
      }

      &:nth-child(3) {
        animation-delay: 0.4s;
      }
    }
  }

  &__caret {
    display: inline-block;
    width: 2px;
    height: 14px;
    margin-left: 2px;
    vertical-align: -2px;
    background: var(--el-color-primary);
    animation: wb-ai-caret 1s steps(2) infinite;
  }

  &__error {
    margin-top: 6px;
    font-size: 12px;
    color: var(--el-color-danger);
  }

  &__meta {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    color: var(--el-text-color-placeholder);
    padding: 0 2px;
  }

  &__meta-model {
    padding: 0 4px;
    border-radius: 3px;
    background: var(--el-fill-color-light);
  }

  &__copy {
    cursor: pointer;
    font-size: 12px;

    &:hover {
      color: var(--el-color-primary);
    }
  }

  &__composer {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  /*
   * 拖动条：贴在输入区顶部（往上吃掉 footer 的 padding-top）。
   * 平时只是一道淡淡的横线，hover / 拖动中才显色；touch-action: none
   * 保证触屏拖动是改高度而不是滚页面。
   */
  &__resizer {
    height: 12px;
    margin: -10px 0 0;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: row-resize;
    border-radius: 4px;
    outline: none;
    touch-action: none;

    &:hover,
    &:focus-visible,
    &.is-active {
      background: var(--el-fill-color-light);
    }
  }

  &__resizer-bar {
    width: 40px;
    height: 3px;
    border-radius: 2px;
    background: var(--el-border-color);
    transition: background 0.2s;
  }

  &__resizer:hover &__resizer-bar,
  &__resizer:focus-visible &__resizer-bar,
  &__resizer.is-active &__resizer-bar {
    background: var(--el-color-primary);
  }

  &__alert {
    padding: 4px 8px;
  }

  &__pending {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  &__pending-item {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    max-width: 220px;
    padding: 3px 6px 3px 8px;
    border-radius: 4px;
    border: 1px solid var(--wb-border);
    background: var(--el-fill-color-lighter);
    font-size: 12px;
  }

  &__pending-name {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  &__pending-size {
    color: var(--el-text-color-placeholder);
    flex: none;
  }

  &__pending-del {
    cursor: pointer;
    flex: none;
    color: var(--el-text-color-placeholder);

    &:hover {
      color: var(--el-color-danger);
    }
  }

  &__input :deep(.el-textarea__inner) {
    font-size: 13px;
    box-shadow: none;
    border: 1px solid var(--wb-border);
    padding: 8px 10px;
  }

  &__bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  &__bar-left,
  &__bar-right {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  &__upload {
    display: inline-flex;

    :deep(.el-upload) {
      display: inline-flex;
    }
  }

  &__hint {
    font-size: 11px;
    color: var(--el-text-color-placeholder);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__model {
    width: 168px;
  }

  &__model-opt {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  &__model-provider {
    font-size: 11px;
    color: var(--el-text-color-placeholder);
  }
}

/*
 * el-dialog 的根是 Teleport，`.wb-ai` 虽然落在 dialog 元素上，但拿不到本组件的
 * scoped 属性（data-v-xxx），所以凡是「dialog 自己」的规则（含 :deep 前缀的那种）
 * 在 scoped 里都是静默失效的 —— 必须写成 :global()。
 *
 * 全屏：el-dialog 是全屏高度的普通块，而对话区只有 58vh，footer 下面就会空出一大片。
 * 改成纵向 flex，让对话区吃掉剩余高度（内部 .wb-ai__scroll 自己滚）。
 */
:global(.wb-ai.is-fullscreen) {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

:global(.wb-ai.is-fullscreen .el-dialog__header),
:global(.wb-ai.is-fullscreen .el-dialog__footer) {
  flex: none;
}

:global(.wb-ai.is-fullscreen .el-dialog__body) {
  flex: 1;
  min-height: 0;
  display: flex;
}

:global(.wb-ai.is-fullscreen .wb-ai__body) {
  flex: 1;
  /* 覆盖窗口模式的固定高度，min-height:0 交给内部滚动区 */
  height: auto;
  min-height: 0;
}

/* 窄屏：会话栏改成浮层，默认收起；打开时盖在消息区上，不挤压正文宽度 */
@media (max-width: 900px) {
  .wb-ai {
    &__body {
      position: relative;
    }

    &__side {
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      z-index: 3;
      width: 220px;
      box-shadow: 4px 0 16px rgb(0 0 0 / 12%);
    }
  }
}

/* 小屏（手机）上把提示文字藏掉，只留按钮，否则左右两栏会挤成两行 */
@media (max-width: 640px) {
  .wb-ai {
    &__hint {
      display: none;
    }

    &__model {
      width: 120px;
    }
  }
}

@keyframes wb-ai-blink {
  0%,
  80%,
  100% {
    opacity: 0.3;
    transform: translateY(0);
  }

  40% {
    opacity: 1;
    transform: translateY(-2px);
  }
}

@keyframes wb-ai-caret {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0;
  }
}
</style>
