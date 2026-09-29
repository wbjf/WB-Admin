<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { FullScreen, Minus, ScaleToOriginal } from '@element-plus/icons-vue'
import { useDialogConfig } from '@/config/dialog'
import { useDialogStack } from '@/composables/useDialogStack'

defineOptions({ name: 'ProDialog' })

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    title?: string
    width?: string | number
    /** 全屏（受控；同时支持 `v-model:fullscreen`） */
    fullscreen?: boolean
    confirmText?: string
    cancelText?: string
    loading?: boolean
    showFooter?: boolean
    closeOnClickModal?: boolean
    appendToBody?: boolean
    destroyOnClose?: boolean
    /**
     * 标题栏能拖动。
     * 全屏 / 最大化 / 最小化时自动失效——那时整块弹窗已经没有可移动的余地。
     */
    draggable?: boolean
    /**
     * 拖动时允许弹窗超出视口。
     * 默认 `false`：位移被夹在「四条边都不出视口」的范围内，拖不丢。
     * 弹窗比视口还高时（比如长表单）纵向几乎没得拖，那种场景再打开它。
     */
    overflow?: boolean
    /** 显示「全屏 / 退出全屏」按钮 */
    fullscreenable?: boolean
    /** 显示「最大化 / 还原」按钮 */
    maximizable?: boolean
    /** 显示「最小化」按钮 */
    minimizable?: boolean
    /** 允许多个弹窗同时出现：层叠错位 + 点击置顶 + 已有其它弹窗时自动撤掉遮罩 */
    stackable?: boolean
    /** 标题栏右侧操作区的总开关 */
    headerActions?: boolean
    /** 打开时就最大化 */
    defaultMaximized?: boolean
    /** 打开时就最小化 */
    defaultMinimized?: boolean
    /** 正文最大高度；默认按状态自适应，全屏 / 最大化时交给 flex 撑满 */
    bodyMaxHeight?: string
    /** 遮罩。不传时按「是否还有别的弹窗开着」自动决定 */
    modal?: boolean
  }>(),
  {
    width: '640px',
    showFooter: true,
    closeOnClickModal: false,
    appendToBody: true,
    destroyOnClose: true,
    /**
     * ⚠️ 下面这些「不传就落到全局默认」的布尔 prop **必须显式写 `undefined`**。
     *
     * Vue 对布尔类型的 prop 有一条内建的「布尔转换」：`type: Boolean` 且**没有 default**
     * 时，没传就等于 `false` —— 和「没传」在运行时是分不出来的。
     * 于是 `props.draggable ?? cfg.draggable` 里的 `??` 永远不会走到右边，
     * 全局默认形同虚设（实测：`<ProDialog>` 不传任何能力 prop 时 props 全是 false，
     * 弹窗一个按钮都没有）。
     *
     * 写了 `default: undefined` 之后 `hasOwn(prop,'default')` 成立，Vue 跳过布尔转换，
     * 值保持 undefined，`??` 回退才会生效。这就是这里明明「没默认值」还要列一遍的原因。
     */
    fullscreen: undefined,
    loading: undefined,
    draggable: undefined,
    overflow: undefined,
    fullscreenable: undefined,
    maximizable: undefined,
    minimizable: undefined,
    stackable: undefined,
    headerActions: undefined,
    defaultMaximized: undefined,
    defaultMinimized: undefined,
    modal: undefined
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'update:fullscreen', v: boolean): void
  (e: 'confirm'): void
  (e: 'opened'): void
  (e: 'closed'): void
  (e: 'maximize'): void
  (e: 'restore'): void
  (e: 'minimize'): void
  (e: 'unminimize'): void
  (e: 'fullscreen-change', v: boolean): void
}>()

const { t } = useI18n()
const cfg = useDialogConfig()
const stack = useDialogStack()

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})

/** ---------- 各能力的最终取值：单个弹窗的 prop 优先，否则落到全局默认 ---------- */
const isStackable = computed(() => props.stackable ?? cfg.stackable)
const canDrag = computed(() => props.draggable ?? cfg.draggable)
const canFullscreen = computed(() => props.fullscreenable ?? cfg.fullscreenable)
const canMaximize = computed(() => props.maximizable ?? cfg.maximizable)
const canMinimize = computed(() => props.minimizable ?? cfg.minimizable)
const showActions = computed(() => props.headerActions ?? cfg.headerActions)
/** 只要有任意一个按钮要渲染，就走自定义表头（否则完全沿用 Element Plus 的默认表头） */
const hasActions = computed(
  () => showActions.value && (canFullscreen.value || canMaximize.value || canMinimize.value)
)

/** ---------- 窗口状态 ---------- */
const maximized = ref(false)
const minimized = ref(false)
const fullscreenActive = ref(!!props.fullscreen)
/** 最小化之前是什么状态，还原时回到那里 */
const restoreTarget = ref<'normal' | 'maximized' | 'fullscreen'>('normal')

watch(
  () => props.fullscreen,
  (v) => {
    if (!minimized.value && !maximized.value) fullscreenActive.value = !!v
  }
)

const dialogRef = ref<any>(null)

/** 拖动是直接改内联 transform 的，状态切换前先归零，免得从最大化还原时位置是歪的 */
function resetDrag(): void {
  dialogRef.value?.resetPosition?.()
}

function toggleFullscreen(): void {
  if (fullscreenActive.value) {
    fullscreenActive.value = false
    emit('fullscreen-change', false)
    return
  }
  maximized.value = false
  minimized.value = false
  resetDrag()
  fullscreenActive.value = true
  emit('fullscreen-change', true)
}

function toggleMaximize(): void {
  if (maximized.value) {
    maximized.value = false
    emit('restore')
    return
  }
  fullscreenActive.value = false
  minimized.value = false
  resetDrag()
  maximized.value = true
  emit('maximize')
}

function minimize(): void {
  restoreTarget.value = maximized.value
    ? 'maximized'
    : fullscreenActive.value
      ? 'fullscreen'
      : 'normal'
  maximized.value = false
  fullscreenActive.value = false
  resetDrag()
  minimized.value = true
  if (stackId.value) stack.setMinimized(stackId.value, true)
  emit('minimize')
}

function unminimize(): void {
  minimized.value = false
  if (stackId.value) stack.setMinimized(stackId.value, false)
  if (restoreTarget.value === 'maximized') maximized.value = true
  else if (restoreTarget.value === 'fullscreen') fullscreenActive.value = true
  restoreTarget.value = 'normal'
  emit('unminimize')
}

/** 最小化后整条横条都可点，点一下还原 */
function onHeaderClick(): void {
  if (minimized.value) unminimize()
}

/** ---------- 多弹窗：登记 / 注销 ---------- */
const stackId = ref<string | null>(null)
const layer = ref(0)
/** 除了自己之外还开着几个弹窗 */
const othersOpen = computed(() => stack.otherCount(stackId.value))

watch(
  () => props.modelValue,
  (v) => {
    if (v) {
      if (!stackId.value) {
        const entry = stack.open(cfg.maxCascade)
        stackId.value = entry.id
        layer.value = entry.layer
      }
      maximized.value = !!props.defaultMaximized
      minimized.value = !props.defaultMaximized && !!props.defaultMinimized
      fullscreenActive.value =
        !props.defaultMaximized && !props.defaultMinimized && !!props.fullscreen
      restoreTarget.value = 'normal'
      if (minimized.value && stackId.value) stack.setMinimized(stackId.value, true)
      return
    }
    if (stackId.value) {
      stack.setMinimized(stackId.value, false)
      stack.close(stackId.value)
      stackId.value = null
    }
    layer.value = 0
    maximized.value = false
    minimized.value = false
    fullscreenActive.value = !!props.fullscreen
    restoreTarget.value = 'normal'
  },
  { immediate: true }
)

/**
 * 兜底注销。
 *
 * 上面那个 watcher 只在 `modelValue` 变化时触发，而「弹窗开着时页面被切走 / 路由跳转」
 * 走的是组件卸载，`modelValue` 一直是 true —— 不补这一手，登记表里会留下永远不会被清掉的
 * 幽灵条目，后续弹窗的层号越排越靠后（偏移越漂越远）。
 */
onBeforeUnmount(() => {
  if (!stackId.value) return
  stack.setMinimized(stackId.value, false)
  stack.close(stackId.value)
  stackId.value = null
})

/** ---------- 尺寸 / 定位 ---------- */
const offsetEnabled = computed(
  () =>
    isStackable.value &&
    !maximized.value &&
    !fullscreenActive.value &&
    !minimized.value &&
    layer.value > 0
)
const offsetX = computed(() => (offsetEnabled.value ? layer.value * cfg.cascadeStep : 0))
const offsetY = computed(() => (offsetEnabled.value ? layer.value * cfg.cascadeStep : 0))
/** 最小化横条从下往上摞，用「在所有最小化弹窗里的序号」而不是层号 */
const minIndex = computed(() => Math.max(0, stack.minimizedIndex(stackId.value)))

/**
 * 正文最大高度。
 * 全屏 / 最大化时给 `none`：那两种状态下弹窗高度是确定的，
 * 由外层 flex 把正文撑满（见 styles/index.scss），比硬编码一串「视口减去头部尾部」稳。
 */
const bodyMaxHeight = computed(() => {
  if (props.bodyMaxHeight) return props.bodyMaxHeight
  if (maximized.value || fullscreenActive.value) return 'none'
  return 'calc(85vh - 140px)'
})

const dialogClass = computed(() => [
  'pro-dialog',
  {
    'is-maximized': maximized.value,
    'is-minimized': minimized.value,
    'is-cascaded': offsetEnabled.value
  }
])

const dialogStyle = computed(() => ({
  '--pro-dialog-layer': String(layer.value),
  '--pro-dialog-offset-x': `${offsetX.value}px`,
  '--pro-dialog-offset-y': `${offsetY.value}px`,
  '--pro-dialog-inset': `${cfg.maximizedInset}px`,
  '--pro-dialog-min-width': cfg.minimizedWidth,
  '--pro-dialog-min-index': String(minIndex.value)
}))

/**
 * 遮罩。
 * 只开一个弹窗时保持 Element Plus 的默认行为（有遮罩、锁住背景），
 * 页面上已经开着别的弹窗时自动撤掉——否则后开的那个会连着把先开的也一起盖住，
 * 两个都动不了，「同时出现多个弹窗」就只剩个形状。
 * 显式传 `:modal` 时以传入值为准。
 */
const resolvedModal = computed(() => {
  // 没打开的弹窗不参与这套计算：Element Plus 的遮罩层在关闭后仍留在 DOM 里（display: none），
  // 不排除掉的话所有关着的弹窗都会被算成「多弹窗共存」，DOM 上挂一堆没意义的类。
  if (!props.modelValue) return props.modal ?? cfg.modal
  // 最小化就是「先放一边」，再压着遮罩就等于把整个页面锁了
  if (minimized.value) return false
  if (props.modal !== undefined) return props.modal
  if (isStackable.value && othersOpen.value > 0) return false
  return cfg.modal
})

/**
 * 遮罩是否可穿透。
 *
 * Element Plus 内部：`penetrable = modalPenetrable && !modal && !fullscreen`，
 * 命中时会挂上 `.el-modal-dialog.is-penetrable`，而 EP 自带两条规则
 *   `.el-modal-dialog.is-penetrable { pointer-events: none }`
 *   `.el-modal-dialog.is-penetrable .el-dialog { pointer-events: auto }`
 * —— 遮罩层整体不接事件、弹窗本身照常接。于是「点页面上的别的弹窗」能落到它头上，
 * 触发 EP 自己的 `bringToFront()` 把它提到最前，这一整套都是原生能力，不用自己维护 z-index。
 *
 * 最小化时也要开着：`.el-overlay-dialog` 是铺满视口的定位层，不穿透的话
 * 一条收起来的横条会把整个页面挡死。
 */
const penetrable = computed(() => props.modelValue && (isStackable.value || minimized.value))

/** 拖动在三种铺满状态下都没有意义，关掉免得把弹窗拖出视口 */
const draggableActive = computed(
  () => canDrag.value && !maximized.value && !fullscreenActive.value && !minimized.value
)

/** 只透传；真正的夹取逻辑在 Element Plus 的 useDraggable 里 */
const dragOverflow = computed(() => props.overflow ?? cfg.dragOverflow)
</script>

<template>
  <el-dialog
    ref="dialogRef"
    v-model="visible"
    :class="dialogClass"
    :style="dialogStyle"
    :title="hasActions ? undefined : title"
    :header-class="hasActions ? 'pro-dialog__header-wrap' : undefined"
    :width="width"
    :fullscreen="fullscreenActive"
    :draggable="draggableActive"
    :overflow="dragOverflow"
    :modal="resolvedModal"
    :modal-penetrable="penetrable"
    :close-on-click-modal="closeOnClickModal"
    :append-to-body="appendToBody"
    :destroy-on-close="destroyOnClose"
    @open="resetDrag"
    @opened="emit('opened')"
    @closed="emit('closed')"
  >
    <!-- 自定义表头只在需要按钮时启用，其余情况沿用 Element Plus 默认表头（渲染结果不变） -->
    <template v-if="hasActions" #header="{ titleId, titleClass }">
      <div class="pro-dialog__header" @click="onHeaderClick">
        <span :id="titleId" :class="titleClass">{{ title }}</span>

        <span class="pro-dialog__acts">
          <el-tooltip
            v-if="canMinimize && !minimized"
            :content="t('dialog.minimize')"
            placement="bottom"
            :show-after="400"
          >
            <!-- mousedown 必须 stop：标题栏上的 mousedown 会触发 Element Plus 的拖动 -->
            <button
              type="button"
              class="pro-dialog__act"
              :aria-label="t('dialog.minimize')"
              @mousedown.stop
              @click.stop="minimize"
            >
              <el-icon><Minus /></el-icon>
            </button>
          </el-tooltip>

          <el-tooltip
            v-if="minimized"
            :content="t('dialog.restore')"
            placement="bottom"
            :show-after="400"
          >
            <button
              type="button"
              class="pro-dialog__act"
              :aria-label="t('dialog.restore')"
              @mousedown.stop
              @click.stop="unminimize"
            >
              <svg class="pro-dialog__svg" viewBox="0 0 1024 1024" aria-hidden="true">
                <path
                  d="M296 168h560v560H296z"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="72"
                />
                <path
                  d="M168 360h496v496H168z"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="72"
                />
              </svg>
            </button>
          </el-tooltip>

          <el-tooltip
            v-if="canMaximize && !minimized"
            :content="maximized ? t('dialog.restore') : t('dialog.maximize')"
            placement="bottom"
            :show-after="400"
          >
            <button
              type="button"
              class="pro-dialog__act"
              :aria-label="maximized ? t('dialog.restore') : t('dialog.maximize')"
              @mousedown.stop
              @click.stop="toggleMaximize"
            >
              <svg
                v-if="!maximized"
                class="pro-dialog__svg"
                viewBox="0 0 1024 1024"
                aria-hidden="true"
              >
                <path
                  d="M168 168h688v688H168z"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="72"
                />
                <path d="M168 336h688" fill="none" stroke="currentColor" stroke-width="72" />
              </svg>
              <svg v-else class="pro-dialog__svg" viewBox="0 0 1024 1024" aria-hidden="true">
                <path
                  d="M296 168h560v560H296z"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="72"
                />
                <path
                  d="M168 360h496v496H168z"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="72"
                />
              </svg>
            </button>
          </el-tooltip>

          <el-tooltip
            v-if="canFullscreen && !minimized"
            :content="fullscreenActive ? t('dialog.exitFullscreen') : t('dialog.fullscreen')"
            placement="bottom"
            :show-after="400"
          >
            <button
              type="button"
              class="pro-dialog__act"
              :aria-label="fullscreenActive ? t('dialog.exitFullscreen') : t('dialog.fullscreen')"
              @mousedown.stop
              @click.stop="toggleFullscreen"
            >
              <el-icon>
                <ScaleToOriginal v-if="fullscreenActive" />
                <FullScreen v-else />
              </el-icon>
            </button>
          </el-tooltip>
        </span>
      </div>
    </template>

    <el-scrollbar :max-height="bodyMaxHeight">
      <slot />
    </el-scrollbar>

    <template v-if="showFooter" #footer>
      <slot name="footer">
        <el-button @click="visible = false">{{ cancelText || t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="loading" @click="emit('confirm')">
          {{ confirmText || t('common.confirm') }}
        </el-button>
      </slot>
    </template>
  </el-dialog>
</template>
