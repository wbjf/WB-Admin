<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { onBeforeRouteLeave } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import screenfull from 'screenfull'
import '@logicflow/core/es/index.css'
import '@logicflow/extension/es/index.css'
import type { FlowGraph, FlowIssue, FlowNode } from '@/types'
import { resolveConfig, normalizeToolbar } from './config'
import { useFlowEditor } from './useFlowEditor'
import { useFlowDraft } from './useFlowDraft'
import { useFlowExport, readFlowFile } from './useFlowExport'
import { cloneGraph, createEmptyGraph, migrateFlow } from './serialize'
import { diffGraph } from './diff'
import type { SimResult } from './simulate'
import type { BuiltinAction, FlowApi, FlowEditorOptions, PaletteItem } from './types'
import FlowToolbar from './FlowToolbar.vue'
import FlowPalette from './FlowPalette.vue'
import FlowInspector from './FlowInspector.vue'
import FlowIssuePanel from './FlowIssuePanel.vue'
import FlowAdvancedDialogs from './FlowAdvancedDialogs.vue'

const props = withDefaults(
  defineProps<{
    config?: FlowEditorOptions
    /** 初始图；不传则尝试加载草稿，再没有就是空白图 */
    graph?: FlowGraph
    flowId?: string
    /** 不传则走 config.readonly / 全局默认 */
    readonly?: boolean
    height?: string
  }>(),
  { config: undefined, graph: undefined, flowId: '', readonly: undefined, height: undefined }
)

const emit = defineEmits<{
  (e: 'ready', api: FlowApi): void
  (e: 'change', graph: FlowGraph): void
  (e: 'save', graph: FlowGraph): void
  (e: 'validate', issues: FlowIssue[]): void
  (e: 'node-click', node: FlowNode): void
  (e: 'update:name', name: string): void
}>()

const { t } = useI18n()

const rootEl = ref<HTMLElement>()
const container = ref<HTMLElement>()
const fullscreen = ref(false)

/** 配置解析（唯一真源）：preset → 全局默认 → 单实例 prop */
const cfg = computed(() => resolveConfig(props.config || {}, props.readonly ?? false))

const initial = ref<FlowGraph>(
  props.graph ? cloneGraph(props.graph) : createEmptyGraph(props.flowId, t('flow.untitled'))
)

const store = useFlowEditor({
  container,
  cfg,
  initial: initial.value,
  onChange: (g) => {
    emit('change', g)
    draft.save(g)
    if (cfg.value.persist.autoSaveRemote) scheduleRemoteSave()
  },
  onSelect: (sel) => {
    if (sel.kind === 'node') {
      const node = store.graph.value.nodes.find((n) => n.id === sel.id)
      if (node) emit('node-click', node)
    }
  }
})

const draft = useFlowDraft({
  flowId: props.flowId || 'new',
  medium: cfg.value.persist.draft,
  debounce: cfg.value.persist.debounce,
  onSaved: () => {}
})

const exporter = useFlowExport(
  () => store.lf.value,
  () => store.graph.value
)

/* ────────────────── 面板 / 弹窗 ────────────────── */
const issuePanel = ref(false)
const simResult = ref<SimResult | null>(null)
const simPanel = ref(false)
const dialogAction = ref<'version' | 'template' | 'ai' | 'excel' | 'share' | 'search' | null>(null)
const collabPeers = ref<Array<{ id: string; name: string; editing: boolean }>>([])
let collabHandle: {
  destroy: () => void
  acquire: () => boolean
  release: () => void
  publish: (g: FlowGraph) => void
} | null = null

const toolbarItems = computed(() => normalizeToolbar(cfg.value.toolbarItems))
const name = computed(() => store.graph.value.meta?.name || '')

/* ────────────────── 初始化 ────────────────── */

onMounted(async () => {
  await nextTick()
  store.build()
  draft.bindFlushOnce()

  // 本地草稿恢复（PRD F11）：不管有没有传服务端图，都先跟草稿比一比。
  // 只有「传了图就不看草稿」的话，编辑已有流程时切走再回来会静默丢改动。
  const saved = await draft.load()
  if (saved && (saved.nodes.length || saved.edges.length)) {
    const d = diffGraph(store.graph.value, saved)
    // diffGraph 只比节点/连线；图名、泳道、备注不在它的口径里，得单独比
    const metaChanged =
      (store.graph.value.meta?.name || '') !== (saved.meta?.name || '') ||
      JSON.stringify(store.graph.value.groups || []) !== JSON.stringify(saved.groups || [])
    const dirty =
      metaChanged ||
      d.added.length +
        d.removed.length +
        d.changed.length +
        d.moved.length +
        d.edgeAdded.length +
        d.edgeRemoved.length >
        0
    if (dirty) {
      try {
        await ElMessageBox.confirm(t('flow.restoreDraftTip'), t('flow.restoreDraftTitle'), {
          type: 'warning',
          confirmButtonText: t('flow.restore'),
          cancelButtonText: t('flow.discard')
        })
        store.setGraph(saved)
        ElMessage.success(t('flow.draftRestored'))
      } catch {
        await draft.remove()
      }
    } else {
      // 跟服务端一致，草稿没意义，清掉免得下次再弹
      await draft.remove()
    }
  }

  store.validate()
  emit('ready', buildApi())

  if (cfg.value.features.collab) void setupCollab()
  if (screenfull.isEnabled) screenfull.on('change', onFullscreenChange)
  window.addEventListener('resize', onResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  if (screenfull.isEnabled) screenfull.off('change', onFullscreenChange)
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('beforeunload', onBeforeUnload)
  collabHandle?.destroy()
  collabHandle = null
  draft.flush()
  draft.destroy()
  store.destroy()
})

function onResize(): void {
  // 容器尺寸变化后让画布重新测量（LogicFlow 内部会在 window resize 时处理，这里兜底）
  try {
    ;(store.lf.value as unknown as { resize?: () => void })?.resize?.()
  } catch {
    /* ignore */
  }
}

/* ────────────────── 快捷键 ────────────────── */
onMounted(() => window.addEventListener('keydown', onKeydown))
function onKeydown(e: KeyboardEvent): void {
  const ctrl = e.ctrlKey || e.metaKey
  if (ctrl && e.key.toLowerCase() === 's') {
    e.preventDefault()
    doSave()
  }
}

/* ────────────────── 离开保护（PRD F13） ────────────────── */
function onBeforeUnload(e: BeforeUnloadEvent): void {
  if (!cfg.value.persist.leaveGuard || !store.dirty.value) return
  e.preventDefault()
  e.returnValue = ''
}
onMounted(() => window.addEventListener('beforeunload', onBeforeUnload))

onBeforeRouteLeave(async () => {
  if (!cfg.value.persist.leaveGuard || !store.dirty.value || cfg.value.readonly) return true
  try {
    await ElMessageBox.confirm(t('flow.leaveTip'), t('flow.leaveTitle'), {
      type: 'warning',
      confirmButtonText: t('flow.saveAndLeave'),
      cancelButtonText: t('flow.leaveDirectly')
    })
    doSave()
    return true
  } catch {
    // 选择「直接离开」：丢掉草稿，回到服务端版本
    await draft.remove()
    return true
  }
})

/* ────────────────── 自动保存远端 ────────────────── */
let remoteTimer: ReturnType<typeof setTimeout> | null = null
function scheduleRemoteSave(): void {
  if (remoteTimer) clearTimeout(remoteTimer)
  remoteTimer = setTimeout(() => emit('save', store.graph.value), 5000)
}

/* ────────────────── 命令 ────────────────── */

function onDrop(payload: { item: PaletteItem; clientX: number; clientY: number }): void {
  const p = store.clientToCanvas(payload.clientX, payload.clientY)
  store.addNode(payload.item, p)
}

function onPick(item: PaletteItem): void {
  store.addNode(item)
}

function doSave(): void {
  const g = store.getGraph()
  emit('save', g)
  draft.remove()
  store.dirty.value = false
}

function doValidate(): void {
  const issues = store.validate()
  issuePanel.value = true
  emit('validate', issues)
}

async function doExport(type: 'png' | 'jpeg' | 'svg' | 'json' | 'excel' | 'print'): Promise<void> {
  await exporter.exportAs(type)
}

async function doImport(): Promise<void> {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json,.flow.json,application/json'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) return
    try {
      const graph = await readFlowFile(file)
      store.setGraph(graph)
      ElMessage.success(t('flow.importOk'))
    } catch {
      ElMessage.error(t('flow.importFailed'))
    }
  }
  input.click()
}

/**
 * 全屏：请求的是 documentElement 而不是编辑器容器。
 *
 * 原生全屏只渲染「全屏元素」这棵子树，而 Element Plus 的弹窗 / 抽屉 / 消息 /
 * 下拉全部 teleport 到 body —— 容器全屏时它们都在子树之外，表现就是
 * 「点了版本弹窗，什么都没出来」。把全屏目标抬到 html，浮层依旧在树内；
 * 再用 .is-fullscreen 把编辑器 fixed 铺满视口，视觉上还是「编辑器独占屏幕」。
 */
function onFullscreenChange(): void {
  fullscreen.value = screenfull.isFullscreen
}

async function toggleFullscreen(): Promise<void> {
  if (!cfg.value.features.fullscreen) return
  if (screenfull.isEnabled) {
    await screenfull.toggle(document.documentElement)
    fullscreen.value = screenfull.isFullscreen
  } else {
    // 浏览器不支持（或被 iframe 策略禁用）：退化成 CSS 伪全屏，至少铺满视口
    fullscreen.value = !fullscreen.value
  }
}

async function runSimulate(): Promise<void> {
  // 动态 import：features.simulate 关闭时这段不进包
  const mod = await import('./simulate')
  simResult.value = mod.simulate(store.graph.value)
  simPanel.value = true
}

async function openAi(): Promise<void> {
  dialogAction.value = 'ai'
}

async function setupCollab(): Promise<void> {
  const mod = await import('./collab')
  collabHandle = mod.createCollab({
    flowId: props.flowId || 'new',
    userName: t('flow.me'),
    onPeers: (peers) => (collabPeers.value = peers),
    onRemoteChange: (g) => store.setGraph(g)
  })
  collabHandle.acquire()
}

function onAction(a: BuiltinAction): void {
  switch (a) {
    case 'undo':
      return store.undo()
    case 'redo':
      return store.redo()
    case 'validate':
      return doValidate()
    case 'layout':
      return store.applyLayout('LR')
    case 'import':
      return void doImport()
    case 'save':
      return doSave()
    case 'fullscreen':
      return void toggleFullscreen()
    case 'version':
      dialogAction.value = 'version'
      return
    case 'template':
      dialogAction.value = 'template'
      return
    case 'ai':
      return void openAi()
    case 'simulate':
      return void runSimulate()
    case 'search':
      dialogAction.value = 'search'
      return
    case 'share':
      dialogAction.value = 'share'
      return
    case 'collab':
      return void setupCollab()
    default:
      return
  }
}

function onRename(v: string): void {
  const g = store.graph.value
  g.meta = { ...g.meta, name: v }
  emit('update:name', v)
  emit('change', g)
  draft.save(g)
}

function onIssueLocate(ids: string[]): void {
  const id = ids?.[0]
  if (id) store.focusNode(id)
}

function onApplyGraph(g: FlowGraph): void {
  store.setGraph(migrateFlow(g))
  dialogAction.value = null
}

/* ────────────────── 对外 API ────────────────── */
function buildApi(): FlowApi {
  return {
    getGraph: () => store.getGraph(),
    setGraph: (g: FlowGraph) => store.setGraph(g),
    validate: () => store.validate(),
    autoLayout: (d) => store.applyLayout(d || 'LR'),
    export: (type) => exporter.exportAs(type),
    clear: () => store.clear(),
    undo: () => store.undo(),
    redo: () => store.redo(),
    focusNode: (id: string) => store.focusNode(id),
    addNode: (item: PaletteItem, position?: { x: number; y: number }) =>
      store.addNode(item, position),
    getSelected: () => store.getSelected()
  }
}

defineExpose(buildApi())

watch(
  () => props.graph,
  (g) => {
    if (g) store.setGraph(g)
  },
  { deep: false }
)
</script>

<template>
  <div
    ref="rootEl"
    class="wb-flow"
    :class="{ 'is-fullscreen': fullscreen, 'is-readonly': cfg.readonly }"
    :style="fullscreen ? undefined : { height: props.height || cfg.height || '100%' }"
    :data-test="'flow-editor'"
    :data-preset="cfg.preset"
  >
    <FlowToolbar
      :cfg="cfg"
      :items="toolbarItems"
      :name="name"
      :dirty="store.dirty.value"
      :save-text="t('flow.unsaved')"
      :fullscreen="fullscreen"
      @action="onAction"
      @export-as="doExport"
      @update:name="onRename"
    >
      <template #left>
        <slot name="toolbar-left" />
      </template>
      <template #right>
        <slot name="toolbar-right" />
      </template>
    </FlowToolbar>

    <div class="wb-flow-body">
      <FlowPalette
        v-if="!cfg.readonly"
        :palette="cfg.palette"
        :readonly="cfg.readonly"
        @drop="onDrop"
        @pick="onPick"
      >
        <template #extra>
          <slot name="palette-extra" />
        </template>
      </FlowPalette>

      <main class="wb-flow-stage">
        <div ref="container" class="wb-flow-canvas" data-test="flow-canvas" />
        <div v-if="!store.graph.value.nodes.length" class="canvas-empty">
          <slot name="empty">{{ t('flow.emptyTip') }}</slot>
        </div>

        <!-- 缩放控件：只读也可用 -->
        <div class="zoom-bar">
          <div :title="t('flow.zoomIn')" data-test="zoom-in" @click="store.zoomBy(1)">＋</div>
          <div :title="t('flow.zoomOut')" data-test="zoom-out" @click="store.zoomBy(-1)">－</div>
          <div :title="t('flow.fitView')" data-test="zoom-fit" @click="store.fitView()">⤢</div>
        </div>

        <!-- 图例（E20） -->
        <div v-if="cfg.features.legend" class="legend">
          <span v-for="g in cfg.palette.groups" :key="g.name">
            <b>{{ g.name }}</b>
          </span>
        </div>

        <!-- 协同在线提示 -->
        <div v-if="cfg.features.collab && collabPeers.length > 1" class="collab-tip">
          {{ t('flow.collabPeers', { n: collabPeers.length }) }}
        </div>
      </main>

      <FlowInspector
        :graph="store.graph.value"
        :selection="store.selected.value"
        :inspector="cfg.inspector"
        :palette-index="cfg.palette.index"
        :readonly="cfg.readonly"
        :show-device="cfg.inspector.showDevice"
        :show-comment="cfg.features.comment"
        :show-simulate-fields="cfg.features.simulate"
        @update-node="({ id, props: p }) => store.updateNode(id, p)"
        @update-text="({ id, text }) => store.updateNodeText(id, text)"
        @update-edge="({ id, props: p }) => store.updateEdge(id, p)"
        @remove-node="store.deleteSelection()"
      >
        <template #extra="{ node }">
          <slot name="inspector-extra" :node="node" />
        </template>
      </FlowInspector>
    </div>

    <div class="wb-flow-status">
      <span>
        {{ t('flow.zoom') }}
        <b>{{ store.zoomText.value }}</b>
      </span>
      <span>
        {{ t('flow.nodes') }}
        <b data-test="stat-nodes">{{ store.stats.value.nodes }}</b>
      </span>
      <span>
        {{ t('flow.edges') }}
        <b data-test="stat-edges">{{ store.stats.value.edges }}</b>
      </span>
      <span v-if="store.unknownTypes.value.length" class="warn">
        {{ t('flow.unknownTypes', { n: store.unknownTypes.value.length }) }}
      </span>
      <div class="spacer" />
      <span v-if="store.dirty.value" class="warn" data-test="stat-dirty">
        {{ t('flow.unsaved') }}
      </span>
      <span v-else-if="draft.lastSavedAt.value" class="ok">{{ t('flow.draftSaved') }}</span>
      <span v-if="cfg.features.validate" class="badge" data-test="stat-issue" @click="doValidate">
        {{ store.issues.value.length }} {{ t('flow.issues') }}
      </span>
    </div>

    <FlowIssuePanel
      v-model="issuePanel"
      :issues="store.issues.value"
      :sim-result="simResult"
      v-model:sim-open="simPanel"
      @locate="onIssueLocate"
    />

    <FlowAdvancedDialogs
      v-model="dialogAction"
      :graph="store.graph.value"
      :flow-id="props.flowId"
      @apply="onApplyGraph"
      @locate="(id: string) => store.focusNode(id)"
    />
  </div>
</template>

<style scoped>
.wb-flow {
  display: flex;
  flex-direction: column;
  min-height: 320px;
  /* 与 .wb-card 同一套底色/边框/圆角，嵌在任何页面里都是一张普通卡片 */
  background: var(--wb-bg-card);
  border: 1px solid var(--wb-border);
  border-radius: 8px;
  overflow: hidden;
}
.wb-flow.is-fullscreen {
  /* 全屏目标虽是 html，视觉上要让编辑器独占视口：fixed 铺满并压过布局层 */
  position: fixed;
  inset: 0;
  z-index: 1200;
  /* 弹窗 / 下拉 / 消息的 z-index 从 2000 起，仍会盖在编辑器之上 */
  height: auto !important;
  margin: 0;
  border-radius: 0;
  border: none;
}
.wb-flow-body {
  flex: 1;
  display: flex;
  min-height: 0;
}
.wb-flow-stage {
  position: relative;
  flex: 1;
  min-width: 0;
  overflow: hidden;
}
.wb-flow-canvas {
  width: 100%;
  height: 100%;
}
.canvas-empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  font-size: 13px;
  color: var(--el-text-color-placeholder);
}
.zoom-bar {
  position: absolute;
  right: 12px;
  bottom: 152px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  z-index: 5;
}
.zoom-bar > div {
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  border: 1px solid var(--el-border-color-light);
  border-radius: 4px;
  background: var(--el-bg-color);
  cursor: pointer;
  font-size: 13px;
  user-select: none;
}
.zoom-bar > div:hover {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
}
.legend {
  position: absolute;
  left: 12px;
  bottom: 12px;
  display: flex;
  gap: 10px;
  padding: 6px 10px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid var(--el-border-color-lighter);
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.collab-tip {
  position: absolute;
  left: 12px;
  top: 12px;
  padding: 4px 10px;
  border-radius: 12px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-size: 12px;
}
.wb-flow-status {
  flex: none;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 6px 12px;
  border-top: 1px solid var(--el-border-color-light);
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.wb-flow-status .spacer {
  flex: 1;
}
.wb-flow-status .warn {
  color: var(--el-color-warning);
}
.wb-flow-status .ok {
  color: var(--el-color-success);
}
.wb-flow-status .badge {
  cursor: pointer;
  padding: 1px 8px;
  border-radius: 10px;
  background: var(--el-fill-color-light);
}
</style>
