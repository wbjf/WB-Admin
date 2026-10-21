import { flowDefaults } from '@/config/flow'
import { resolvePalette } from './palette'
import type {
  BuiltinAction,
  FlowEditorFeatures,
  FlowEditorOptions,
  InspectorOptions,
  PaletteOptions,
  ResolvedFlowConfig,
  ToolbarItem,
  ValidateRule
} from './types'

type PresetName = NonNullable<FlowEditorOptions['preset']>

/** 档位 → 功能开关 */
export const PRESET_FEATURES: Record<PresetName, Required<FlowEditorFeatures>> = {
  mini: {
    minimap: false,
    autoLayout: false,
    validate: false,
    version: false,
    template: false,
    lane: false,
    lock: false,
    fullscreen: false,
    ai: false,
    collab: false,
    simulate: false,
    comment: false,
    search: false,
    share: false,
    importExcel: false,
    legend: false
  },
  standard: {
    minimap: true,
    autoLayout: true,
    validate: true,
    version: false,
    template: false,
    lane: true,
    lock: true,
    fullscreen: true,
    ai: false,
    collab: false,
    simulate: false,
    comment: false,
    search: true,
    share: false,
    importExcel: false,
    legend: false
  },
  pro: {
    minimap: true,
    autoLayout: true,
    validate: true,
    version: true,
    template: true,
    lane: true,
    lock: true,
    fullscreen: true,
    ai: true,
    // 协同 / 仿真即便在 pro 档也默认关：需要后端，开了要显式声明
    collab: false,
    simulate: false,
    comment: true,
    search: true,
    share: false,
    importExcel: true,
    legend: true
  }
}

/** 档位 → 导出项 */
export const PRESET_EXPORTS: Record<PresetName, ResolvedFlowConfig['exports']> = {
  mini: ['png', 'json'],
  standard: ['png', 'jpeg', 'svg', 'json', 'print'],
  pro: ['png', 'jpeg', 'svg', 'json', 'excel', 'print']
}

/** 档位 → 默认内置元件库 */
export const PRESET_PALETTE: Record<PresetName, NonNullable<PaletteOptions['preset']>> = {
  mini: 'basic',
  standard: 'semiconductor',
  pro: 'semiconductor'
}

/** 档位 → 默认工具条 */
export const PRESET_TOOLBAR: Record<PresetName, BuiltinAction[]> = {
  mini: ['undo', 'redo', 'export', 'save'],
  standard: [
    'undo',
    'redo',
    'validate',
    'layout',
    'import',
    'export',
    'search',
    'fullscreen',
    'save'
  ],
  pro: [
    'undo',
    'redo',
    'validate',
    'layout',
    'template',
    'ai',
    'simulate',
    'version',
    'import',
    'export',
    'search',
    'share',
    'fullscreen',
    'save'
  ]
}

/** 档位 → 属性面板 */
export const PRESET_INSPECTOR: Record<PresetName, Required<InspectorOptions>> = {
  mini: { fields: [], showParams: false, showDevice: false, showRemark: true, showBasic: true },
  standard: { fields: [], showParams: false, showDevice: false, showRemark: true, showBasic: true },
  pro: { fields: [], showParams: true, showDevice: true, showRemark: true, showBasic: true }
}

/**
 * 配置解析（唯一真源）：preset 档位 → 全局默认 → 单实例 prop，后者覆盖前者。
 * 组件内部一律只认这份结果，不再到处 `props.x ?? cfg.x`。
 */
export function resolveConfig(
  propConfig: FlowEditorOptions = {},
  readonly = false
): ResolvedFlowConfig {
  const global = flowDefaults
  const preset: PresetName = propConfig.preset ?? global.preset ?? 'standard'

  // features：档位兜底 → 全局 → 单实例
  const features: Required<FlowEditorFeatures> = {
    ...PRESET_FEATURES[preset],
    ...(global.features || {}),
    ...(propConfig.features || {})
  }
  // 只读模式强制关掉一切「改数据」的入口
  if (readonly) {
    features.template = false
    features.ai = false
    features.collab = false
    features.comment = false
    features.importExcel = false
    features.autoLayout = false
    features.version = false
  }

  const palette = resolvePalette(
    mergePalette(global.palette, propConfig.palette, PRESET_PALETTE[preset]),
    PRESET_PALETTE[preset],
    readonly
  )

  const inspectorBase = PRESET_INSPECTOR[preset]
  const inspector: Required<InspectorOptions> = {
    ...inspectorBase,
    ...(global.inspector || {}),
    ...(propConfig.inspector || {}),
    fields: [...(global.inspector?.fields || []), ...(propConfig.inspector?.fields || [])]
  }

  const persistBase = {
    draft: 'indexeddb',
    autoSaveRemote: false,
    debounce: 500,
    leaveGuard: true
  } as const
  const persist = {
    ...persistBase,
    ...(global.persist || {}),
    ...(propConfig.persist || {})
  }

  return {
    preset,
    features,
    palette,
    toolbarItems: propConfig.toolbar?.items ?? global.toolbar?.items ?? PRESET_TOOLBAR[preset],
    exports: propConfig.exports ?? global.exports ?? PRESET_EXPORTS[preset],
    imports: (propConfig.imports ?? global.imports ?? preset !== 'mini') && !readonly,
    inspector,
    persist,
    validateRules: [...(global.validateRules || []), ...(propConfig.validateRules || [])],
    readonly,
    interactive: propConfig.interactive ?? global.interactive ?? true,
    height: propConfig.height ?? global.height ?? '',
    gridSize: propConfig.gridSize ?? global.gridSize ?? 20
  }
}

/** 工具条项：把内部动作 key 与自定义项统一成可渲染的列表 */
export function normalizeToolbar(
  items: ResolvedFlowConfig['toolbarItems']
): Array<{ kind: 'builtin'; action: BuiltinAction } | { kind: 'custom'; item: ToolbarItem }> {
  return items.map((it) =>
    typeof it === 'string' ? { kind: 'builtin', action: it } : { kind: 'custom', item: it }
  )
}

function mergePalette(
  globalPal: PaletteOptions = {},
  propPal: PaletteOptions = {},
  presetName: NonNullable<PaletteOptions['preset']>
): PaletteOptions {
  return {
    // 自定义分组：单实例优先，其次全局
    groups: propPal.groups ?? globalPal.groups,
    preset: propPal.preset ?? globalPal.preset ?? presetName,
    extend: [...(globalPal.extend || []), ...(propPal.extend || [])],
    exclude: [...(globalPal.exclude || []), ...(propPal.exclude || [])],
    searchable: propPal.searchable ?? globalPal.searchable,
    collapsible: propPal.collapsible ?? globalPal.collapsible,
    draggable: propPal.draggable ?? globalPal.draggable,
    quickAdd: propPal.quickAdd ?? globalPal.quickAdd
  }
}

/** 供外部复用：判断某能力是否开启（组件外也能用同一份逻辑） */
export function isFeatureOn(cfg: ResolvedFlowConfig, key: keyof FlowEditorFeatures): boolean {
  return !!cfg.features[key]
}

export type { ValidateRule }
