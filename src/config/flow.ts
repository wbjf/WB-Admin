import { reactive } from 'vue'
import type { FlowEditorOptions } from '@/components/FlowEditor/types'

/**
 * 流程图编辑器的全局默认配置。
 *
 * 与 `src/config/dialog.ts`（ProDialog）同一套路：
 * 模块级 reactive 单例 + `configureXxx()` 覆盖 + `useXxxConfig()` 读取，
 * 组件内部一律 `props.x ?? cfg.x`，因此**布尔 prop 必须写 `default: undefined`**，
 * 否则 Vue 的布尔转换会让没传的 prop 变成 false，全局默认形同虚设。
 */
export const flowDefaults = reactive<FlowEditorOptions>({
  preset: 'standard',
  /**
   * 留空 = 全部继承 `preset` 档位。
   * `configureFlowEditor({ features: { ai: true } })` 只覆盖传进来的那几个键，
   * 没传的仍然跟着档位走 —— 这样「档位兜底 + 细项微调」才成立。
   */
  features: {},
  exports: ['png', 'svg', 'json'],
  imports: true,
  persist: {
    draft: 'indexeddb',
    autoSaveRemote: false,
    debounce: 500,
    leaveGuard: true
  },
  height: '',
  gridSize: 20
})

/**
 * 覆盖全局默认值，只需传要改的项。
 * `features` 会做一层浅合并（只覆盖传进来的开关），其余字段整体替换。
 */
export function configureFlowEditor(partial: Partial<FlowEditorOptions>): void {
  const { features, ...rest } = partial
  if (features) {
    flowDefaults.features = { ...(flowDefaults.features || {}), ...features }
  }
  Object.assign(flowDefaults, rest)
}

/** 读取当前全局默认值（响应式，改完立即对已挂载的实例生效） */
export function useFlowConfig(): FlowEditorOptions {
  return flowDefaults
}

/** 测试用：恢复出厂默认值 */
export function resetFlowConfigForTest(): void {
  Object.assign(flowDefaults, {
    preset: 'standard',
    features: {},
    exports: ['png', 'svg', 'json'],
    imports: true,
    persist: { draft: 'indexeddb', autoSaveRemote: false, debounce: 500, leaveGuard: true },
    height: '',
    gridSize: 20
  })
}
