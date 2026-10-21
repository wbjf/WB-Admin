import type { FlowEdge, FlowGraph, FlowGroupBox, FlowMeta, FlowNode } from '@/types'
import type { PaletteItem } from './types'

/** LogicFlow 的图数据结构（只用得到字段做最小声明，避免依赖其复杂泛型） */
export interface LfNodeData {
  id: string
  type: string
  x: number
  y: number
  text?: string
  width?: number
  height?: number
  properties?: Record<string, unknown>
}
export interface LfEdgeData {
  id: string
  type: string
  sourceNodeId: string
  targetNodeId: string
  text?: string
  pointsList?: Array<{ x: number; y: number }>
  properties?: Record<string, unknown>
}
export interface LfGraphData {
  nodes: LfNodeData[]
  edges: LfEdgeData[]
}

/** 泳道在 LogicFlow 里也是一个节点，用这个类型区分（不可连线） */
export const LANE_TYPE = 'lane'

export function createEmptyGraph(id = '', name = '未命名流程'): FlowGraph {
  return {
    schema: 1,
    meta: { id, name, updatedAt: Date.now() },
    nodes: [],
    edges: [],
    groups: []
  }
}

/** 深拷贝一张图（撤销快照、模板套用都用得上） */
export function cloneGraph(graph: FlowGraph): FlowGraph {
  return JSON.parse(JSON.stringify(graph)) as FlowGraph
}

/**
 * 导入时的结构版本迁移。
 * 与 AI 会话的 v1→v2 迁移同一思路：读未知结构一律假定字段可能缺失。
 */
export function migrateFlow(raw: unknown): FlowGraph {
  const g = (raw || {}) as Partial<FlowGraph> & { version?: number }
  const meta = (g.meta || {}) as Partial<FlowMeta>
  const nodes = Array.isArray(g.nodes) ? g.nodes : []
  const edges = Array.isArray(g.edges) ? g.edges : []
  const groups = Array.isArray(g.groups) ? g.groups : []
  return {
    schema: 1,
    meta: {
      id: String(meta.id ?? ''),
      name: String(meta.name ?? '未命名流程'),
      category: meta.category,
      description: meta.description,
      thumbnail: meta.thumbnail,
      createdBy: meta.createdBy,
      updatedAt: Number(meta.updatedAt ?? Date.now()),
      version: meta.version
    },
    nodes: nodes.map(normalizeNode),
    edges: edges.map(normalizeEdge),
    groups: groups.map(normalizeGroup)
  }
}

/** FlowGraph → LogicFlow 数据；返回未知类型数量，供上层提示降级 */
export function toLfData(
  graph: FlowGraph,
  paletteIndex: Record<string, PaletteItem>
): { data: LfGraphData; unknownTypes: string[] } {
  const unknown = new Set<string>()
  const nodes: LfNodeData[] = graph.nodes.map((n) => {
    const item = paletteIndex[n.type]
    // 5.4.4-2：库里没有的类型降级为 task（默认矩形），不让图渲染崩掉
    if (!item && n.type !== LANE_TYPE) unknown.add(n.type)
    const type = item ? n.type : 'task'
    return {
      id: n.id,
      type,
      x: n.x,
      y: n.y,
      text: n.text ?? '',
      width: n.width ?? item?.size?.width ?? 140,
      height: n.height ?? item?.size?.height ?? 54,
      properties: { ...(n.properties || {}), _rawType: n.type }
    }
  })

  // 泳道：左上角 → 中心点（LogicFlow 节点坐标是中心）
  ;(graph.groups || []).forEach((g) => {
    nodes.unshift({
      id: g.id,
      type: LANE_TYPE,
      x: g.x + g.w / 2,
      y: g.y + g.h / 2,
      text: g.name,
      width: g.w,
      height: g.h,
      // 标题同时写进 text 与 properties.name：节点自己画标题（不走内置文本），properties 是回读来源
      properties: { _lane: true, name: g.name, color: g.color }
    })
  })

  const edges: LfEdgeData[] = graph.edges.map((e) => ({
    id: e.id,
    type: e.type || 'polyline',
    sourceNodeId: e.sourceNodeId,
    targetNodeId: e.targetNodeId,
    text: e.text,
    pointsList: e.pointsList,
    properties: {
      kind: (e.properties?.kind ?? 'main') as string,
      dashed: !!e.properties?.dashed,
      ...(e.properties || {})
    }
  }))

  return { data: { nodes, edges }, unknownTypes: [...unknown] }
}

/** LogicFlow 数据 → FlowGraph */
export function fromLfData(data: LfGraphData, meta: FlowMeta): FlowGraph {
  const groups: FlowGroupBox[] = []
  const nodes: FlowNode[] = []

  for (const n of data.nodes || []) {
    const props = { ...(n.properties || {}) }
    if (n.type === LANE_TYPE || props._lane) {
      const w = n.width ?? 400
      const h = n.height ?? 200
      const laneName = (props.name as string) || (typeof n.text === 'string' ? n.text : '')
      groups.push({
        id: n.id,
        name: laneName,
        x: (n.x ?? 0) - w / 2,
        y: (n.y ?? 0) - h / 2,
        w,
        h,
        color: (props.color as string) || undefined
      })
      continue
    }
    delete props._lane
    const rawType = props._rawType as string | undefined
    // 内部标记不进导出数据
    delete props._rawType
    nodes.push({
      id: n.id,
      type: rawType || n.type,
      x: n.x,
      y: n.y,
      text: typeof n.text === 'string' ? n.text : '',
      width: n.width,
      height: n.height,
      properties: props
    })
  }

  const edges: FlowEdge[] = (data.edges || []).map((e) => ({
    id: e.id,
    type: (e.type as FlowEdge['type']) || 'polyline',
    sourceNodeId: e.sourceNodeId,
    targetNodeId: e.targetNodeId,
    text: typeof e.text === 'string' ? e.text : undefined,
    pointsList: e.pointsList,
    properties: { ...(e.properties || {}) }
  }))

  return { schema: 1, meta: { ...meta, updatedAt: Date.now() }, nodes, edges, groups }
}

/** 统计（状态栏用） */
export function graphStats(graph: FlowGraph): { nodes: number; edges: number; lanes: number } {
  return {
    nodes: graph.nodes?.length ?? 0,
    edges: graph.edges?.length ?? 0,
    lanes: graph.groups?.length ?? 0
  }
}

export function newId(prefix = 'n'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

/* ────────────────── 归一化（容错：字段可能缺失/类型不对） ────────────────── */

function normalizeNode(raw: Partial<FlowNode>): FlowNode {
  const props = (raw.properties || {}) as FlowNode['properties']
  return {
    id: String(raw.id ?? newId()),
    type: String(raw.type ?? 'task'),
    x: Number(raw.x ?? 0),
    y: Number(raw.y ?? 0),
    text: raw.text == null ? '' : String(raw.text),
    width: Number(raw.width ?? 140),
    height: Number(raw.height ?? 54),
    properties: {
      ...props,
      params: Array.isArray(props.params) ? props.params : [],
      comments: Array.isArray(props.comments) ? props.comments : []
    }
  }
}

function normalizeEdge(raw: Partial<FlowEdge>): FlowEdge {
  return {
    id: String(raw.id ?? newId('e')),
    type: raw.type || 'polyline',
    sourceNodeId: String(raw.sourceNodeId ?? ''),
    targetNodeId: String(raw.targetNodeId ?? ''),
    text: raw.text == null ? undefined : String(raw.text),
    pointsList: raw.pointsList,
    properties: { ...(raw.properties || {}) }
  }
}

function normalizeGroup(raw: Partial<FlowGroupBox>): FlowGroupBox {
  return {
    id: String(raw.id ?? newId('g')),
    name: String(raw.name ?? '区域'),
    x: Number(raw.x ?? 0),
    y: Number(raw.y ?? 0),
    w: Number(raw.w ?? 400),
    h: Number(raw.h ?? 200),
    color: raw.color
  }
}
