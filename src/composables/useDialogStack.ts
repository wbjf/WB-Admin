import { computed, ref } from 'vue'

/**
 * 已打开的弹窗登记表（模块级单例）。
 *
 * 为什么需要它：
 * Element Plus 本身允许同时存在多个 `el-dialog`，但每个弹窗的 `z-index` 是在
 * **打开那一刻**取的全局自增值，之后不再变化，也不会有任何「层叠错位」——
 * 于是两个宽高相同的弹窗会**完全重叠**，用户看到的还是一层，很容易误判成「没打开第二个」。
 *
 * 这里只做两件 Element Plus 不提供的事：
 *   1. **层号**：打开时按当前已打开数量分配，用于 CSS 变量做错位偏移。
 *   2. **在开着谁 / 谁被最小化了**：前者决定「要不要撤掉遮罩」，后者决定
 *      最小化后的横条从下往上排到第几格（天然形成任务栏）。
 *
 * z-index 的置顶交给 Element Plus：`el-dialog` 内部有 `bringToFront()`，
 * 在 `modalPenetrable && !modal && !fullscreen` 时，点击弹窗会把它的 z-index 提到最前。
 * 自己再维护一套 z-index 反而会和 MessageBox / Select 的下拉层打架。
 */
export interface DialogStackEntry {
  id: string
  /** 打开时的层号（0 起），用于错位偏移 */
  layer: number
  /** 是否处于最小化 */
  minimized: boolean
}

const entries = ref<DialogStackEntry[]>([])
let seq = 0

export function useDialogStack() {
  /**
   * 登记一个刚打开的弹窗，返回它的层号。
   * 层号取「当前已打开数量」，并受 `maxLayer` 上限约束，避免把弹窗推出视口。
   */
  function open(maxLayer: number): DialogStackEntry {
    const entry: DialogStackEntry = {
      id: `pro-dialog-${++seq}`,
      layer: Math.min(entries.value.length, Math.max(0, maxLayer - 1)),
      minimized: false
    }
    entries.value = [...entries.value, entry]
    return entry
  }

  /** 注销已关闭的弹窗 */
  function close(id: string): void {
    entries.value = entries.value.filter((e) => e.id !== id)
  }

  /** 标记某个弹窗是否已最小化（最小化的横条要排队往上摞） */
  function setMinimized(id: string, minimized: boolean): void {
    entries.value = entries.value.map((e) => (e.id === id ? { ...e, minimized } : e))
  }

  /** 该弹窗在所有「已最小化」弹窗里排第几个（0 起）；未最小化返回 -1 */
  function minimizedIndex(id: string | null): number {
    if (!id) return -1
    return entries.value.filter((e) => e.minimized).findIndex((e) => e.id === id)
  }

  /** 当前打开的弹窗数量 */
  const count = computed(() => entries.value.length)

  /**
   * 「除了自己之外还有几个弹窗开着」。
   * 传 null（自身尚未登记）时退化为当前总数——用于渲染早于登记的极短窗口期。
   */
  function otherCount(id: string | null): number {
    if (!id) return entries.value.length
    return Math.max(0, entries.value.length - (entries.value.some((e) => e.id === id) ? 1 : 0))
  }

  return { entries, open, close, setMinimized, minimizedIndex, count, otherCount }
}
