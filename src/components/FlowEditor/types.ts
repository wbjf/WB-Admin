import type { Component } from 'vue'
import type { FlowGraph, FlowIssue, FlowNode } from '@/types'

/* ────────────────── 元件库（5.4） ────────────────── */

/** 元件库中的一个节点模板 */
export interface PaletteItem {
  /** 节点类型，落图后写入 node.type；同一库内唯一 */
  type: string
  /** 面板显示名 */
  label: string
  /** 搜索用的别名（英文、缩写、别名），不显示在界面上 */
  keywords?: string[]
  /** 图标 key（对应 icons.ts）/ svg 字符串 / Vue 组件 */
  icon?: string | Component
  /** 默认配色 */
  color?: string
  /** 落图后的默认尺寸 */
  size?: { width: number; height: number }
  /** 默认形状，缺省 rect */
  shape?: 'rect' | 'round' | 'diamond' | 'note' | string
  /** 落图时写入节点的默认业务属性 */
  defaults?: Record<string, unknown>
  /** 该节点允许连出的类型白名单，用于连线软校验 */
  next?: string[]
  /** 置灰不可拖（类型已下线但仍需兼容老图） */
  disabled?: boolean
}

/** 一个分组 */
export interface PaletteGroup {
  name: string
  items: PaletteItem[]
  /** 默认是否展开 */
  expanded?: boolean
}

export interface PaletteOptions {
  /** 直接给分组（最高优先级，传了就不走内置库） */
  groups?: PaletteGroup[]
  /** 引用内置库 */
  preset?: 'semiconductor' | 'basic' | 'generic'
  /** 在所选库基础上追加 / 覆盖若干节点 */
  extend?: PaletteItem[]
  /** 屏蔽某些类型（优先级高于 extend） */
  exclude?: string[]
  /** 搜索框，默认 true */
  searchable?: boolean
  /** 分组可折叠，默认 true */
  collapsible?: boolean
  /** 允许拖拽新建节点，默认 true */
  draggable?: boolean
  /** 允许双击画布空白处新建，默认 false */
  quickAdd?: boolean
}

/** 解析后的元件库（内部用） */
export interface ResolvedPalette {
  groups: PaletteGroup[]
  searchable: boolean
  collapsible: boolean
  draggable: boolean
  quickAdd: boolean
  /** type → item 的索引，供节点渲染与校验取默认值 */
  index: Record<string, PaletteItem>
}

/* ────────────────── 编辑器配置 ────────────────── */

export interface FlowEditorFeatures {
  minimap?: boolean
  autoLayout?: boolean
  validate?: boolean
  version?: boolean
  template?: boolean
  lane?: boolean
  lock?: boolean
  fullscreen?: boolean
  ai?: boolean
  collab?: boolean
  simulate?: boolean
  comment?: boolean
  /** 搜索与定位（E14） */
  search?: boolean
  /** 只读分享链接（E11） */
  share?: boolean
  /** 导入 Excel 工序表（E12） */
  importExcel?: boolean
  /** 图例（E20） */
  legend?: boolean
}

/** 属性面板字段（schema 驱动） */
export interface FieldSchema {
  key: string
  label: string
  type?: 'text' | 'textarea' | 'number' | 'select' | 'switch'
  options?: Array<{ label: string; value: string | number | boolean }>
  required?: boolean
  unit?: string
  placeholder?: string
}

export interface InspectorOptions {
  /** 额外字段（业务特有） */
  fields?: FieldSchema[]
  showParams?: boolean
  showDevice?: boolean
  showRemark?: boolean
  /** 显示基础字段（名称 / 编号 / 类型） */
  showBasic?: boolean
}

export interface ToolbarItem {
  key: string
  label: string
  icon?: string
  /** 点击回调，拿到受控 API */
  onClick?: (api: FlowApi) => void
  /** 也可用已有的内置动作 key 复用其行为 */
  action?: BuiltinAction
}

export type BuiltinAction =
  | 'undo'
  | 'redo'
  | 'validate'
  | 'layout'
  | 'export'
  | 'import'
  | 'save'
  | 'fullscreen'
  | 'version'
  | 'template'
  | 'ai'
  | 'collab'
  | 'simulate'
  | 'search'
  | 'share'

export interface PersistOptions {
  /** 本地草稿介质；false 则完全不落盘 */
  draft?: 'indexeddb' | 'local' | false
  autoSaveRemote?: boolean
  debounce?: number
  leaveGuard?: boolean
}

/** 可插拔校验规则 */
export interface ValidateRule {
  code: string
  /** 规则描述，出现在校验面板 */
  label: string
  level?: FlowIssue['level']
  /** 返回问题列表；没问题返回空数组 */
  run(graph: FlowGraph, ctx: { paletteIndex: Record<string, PaletteItem> }): FlowIssue[]
}

export interface FlowEditorOptions {
  /** 预设档位，缺省 standard */
  preset?: 'mini' | 'standard' | 'pro'
  features?: FlowEditorFeatures
  palette?: PaletteOptions
  toolbar?: {
    /** 内置项名称数组，或自定义项 */
    items?: Array<BuiltinAction | ToolbarItem>
  }
  exports?: Array<'png' | 'jpeg' | 'svg' | 'json' | 'excel' | 'print'>
  imports?: boolean
  inspector?: InspectorOptions
  persist?: PersistOptions
  validateRules?: ValidateRule[]
  readonly?: boolean
  /**
   * 是否允许缩放 / 平移（缺省 true）。
   * 只读分享、嵌入截图这类场景关掉它就是一张静态图。
   */
  interactive?: boolean
  /** 画布高度，缺省撑满容器 */
  height?: string
  /** 网格尺寸，缺省 20 */
  gridSize?: number
}

/** 合并后的生效配置（唯一真源） */
export interface ResolvedFlowConfig {
  preset: 'mini' | 'standard' | 'pro'
  /** 功能开关最终取值 */
  features: Required<FlowEditorFeatures>
  palette: ResolvedPalette
  toolbarItems: Array<BuiltinAction | ToolbarItem>
  exports: Array<'png' | 'jpeg' | 'svg' | 'json' | 'excel' | 'print'>
  imports: boolean
  inspector: Required<InspectorOptions>
  persist: Required<PersistOptions>
  validateRules: ValidateRule[]
  readonly: boolean
  interactive: boolean
  height: string
  gridSize: number
}

/** 对外暴露的受控 API（不直接给 LogicFlow 实例） */
export interface FlowApi {
  getGraph(): FlowGraph
  setGraph(graph: FlowGraph): void
  validate(): FlowIssue[]
  autoLayout(direction?: 'LR' | 'TB'): void
  export(type: 'png' | 'jpeg' | 'svg' | 'json' | 'excel' | 'print'): Promise<void>
  clear(): void
  undo(): void
  redo(): void
  /** 定位到某个节点（居中 + 高亮） */
  focusNode(nodeId: string): void
  addNode(item: PaletteItem, position?: { x: number; y: number }): string
  getSelected(): { nodes: FlowNode[]; edges: string[] }
}
