import { reactive } from 'vue'

/**
 * ProDialog 的全局默认配置。
 *
 * 每个能力都有三层开关，优先级从低到高：
 *   1. 本文件的全局默认值（`configureDialog()` 可在 main.ts 或某个页面前统一改）
 *   2. 单个 `<ProDialog>` 上的同名 prop
 *   3. 运行时的用户操作（点了最大化按钮就最大化）
 *
 * 也就是说：**全局默认关掉、单个弹窗显式传 true 仍然生效**；反之亦然。
 *
 * 注意不要在这里放「只有个别页面才需要」的东西，全局默认应当是对全站都安全的取值。
 */
export interface DialogDefaults {
  /** 标题栏按住可拖动（内部用的是 Element Plus 的 draggable，全屏时不生效） */
  draggable: boolean
  /**
   * 拖动时允许弹窗超出视口。
   * 默认 `false`：位移被夹在「四条边都不出视口」的范围内，怎么拖都拖不丢。
   * 代价是弹窗比视口还高时纵向几乎没得拖（能走的距离 = 视口高 − 弹窗高），
   * 那种场景（长表单）再把这一项打开。
   */
  dragOverflow: boolean
  /** 显示「全屏 / 退出全屏」按钮：铺满整个浏览器视口，无外边距无圆角 */
  fullscreenable: boolean
  /** 显示「最大化 / 还原」按钮：铺满视口但保留四周留白与圆角 */
  maximizable: boolean
  /** 显示「最小化」按钮：收成标题栏钉在右下角，遮罩一并撤掉，不挡住下面的页面 */
  minimizable: boolean
  /**
   * 多个弹窗可以同时出现。
   *
   * 开启后该弹窗会参与「层叠错位」（第 2 个起向右下偏移，避免完全重叠看不出开了两个）
   * 并支持**点击置顶**；同时当页面上已经有别的弹窗时，它会自动取消遮罩，
   * 这样两个弹窗都能继续操作（只开一个弹窗时遮罩照旧，行为与改造前一致）。
   */
  stackable: boolean
  /** 标题栏右侧操作区的总开关。关掉后下面四个按钮都不渲染 */
  headerActions: boolean
  /** 遮罩。显式传入时以传入值为准，不再套用「多弹窗自动取消遮罩」的规则 */
  modal: boolean
  /** 层叠错位每层的像素偏移 */
  cascadeStep: number
  /** 层叠错位的最大层数（超过后不再偏移，避免弹窗被推出视口） */
  maxCascade: number
  /** 最小化后的宽度 */
  minimizedWidth: string
  /** 最大化时四周留白（px） */
  maximizedInset: number
}

/**
 * 全局默认值。
 *
 * 前四项默认开启：它们只是往标题栏加按钮 / 让标题栏能拖，属于纯增量，
 * 不改动弹窗原有的布局与显隐语义。
 *
 * `stackable` 默认开启但**只对「页面上已经有其它弹窗」的情况生效**：
 * 单个弹窗照旧带遮罩、照旧锁住背景，所以既有的 13 个业务弹窗行为不变。
 */
export const dialogDefaults = reactive<DialogDefaults>({
  draggable: true,
  dragOverflow: false,
  fullscreenable: true,
  maximizable: true,
  minimizable: true,
  stackable: true,
  headerActions: true,
  modal: true,
  cascadeStep: 24,
  maxCascade: 4,
  minimizedWidth: '280px',
  maximizedInset: 16
})

/**
 * 覆盖全局默认值，只需传要改的项。
 *
 * ```ts
 * // main.ts
 * configureDialog({ draggable: true, minimizable: false, cascadeStep: 32 })
 * ```
 */
export function configureDialog(partial: Partial<DialogDefaults>): void {
  Object.assign(dialogDefaults, partial)
}

/** 读取当前全局默认值（响应式，改完立即对已挂载的弹窗生效） */
export function useDialogConfig(): DialogDefaults {
  return dialogDefaults
}
