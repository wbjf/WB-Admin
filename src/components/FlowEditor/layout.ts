import dagre from 'dagre'
import type { FlowGraph } from '@/types'
import { LANE_TYPE } from './serialize'

export type LayoutDirection = 'LR' | 'TB'

const NODE_SEP = 40
const RANK_SEP = 70
const EDGE_SEP = 20

/**
 * DAG 分层布局（dagre）。
 * 只动节点坐标，不动连线（连线跟随节点自动重算），泳道不参与布局。
 * 有环时 dagre 内部会断开环边，不会死循环，但结果不保证美观 —— 交给校验面板提示。
 */
export function autoLayout(graph: FlowGraph, direction: LayoutDirection = 'LR'): FlowGraph {
  const g = new dagre.graphlib.Graph()
  g.setGraph({
    rankdir: direction,
    nodesep: NODE_SEP,
    ranksep: RANK_SEP,
    edgesep: EDGE_SEP,
    marginx: 40,
    marginy: 40
  })
  g.setDefaultEdgeLabel(() => ({}))

  const nodes = graph.nodes.filter((n) => n.type !== LANE_TYPE)
  nodes.forEach((n) => {
    g.setNode(n.id, { width: n.width || 140, height: n.height || 54 })
  })
  graph.edges.forEach((e) => {
    // dagre 遇到不存在的节点会抛错，先挡住
    if (nodes.some((n) => n.id === e.sourceNodeId) && nodes.some((n) => n.id === e.targetNodeId)) {
      g.setEdge(e.sourceNodeId, e.targetNodeId)
    }
  })

  dagre.layout(g)

  const positions = new Map<string, { x: number; y: number }>()
  nodes.forEach((n) => {
    const laid = g.node(n.id)
    if (laid && Number.isFinite(laid.x) && Number.isFinite(laid.y)) {
      positions.set(n.id, { x: Math.round(laid.x), y: Math.round(laid.y) })
    }
  })

  if (!positions.size) return graph

  // dagre 给的是左上角原点坐标系，整体平移到原始图的左上角附近，避免图「跳走」
  const origX = Math.min(...nodes.map((n) => n.x))
  const origY = Math.min(...nodes.map((n) => n.y))
  const newX = Math.min(...[...positions.values()].map((p) => p.x))
  const newY = Math.min(...[...positions.values()].map((p) => p.y))
  const dx = origX - newX
  const dy = origY - newY

  return {
    ...graph,
    nodes: graph.nodes.map((n) => {
      const p = positions.get(n.id)
      return p ? { ...n, x: p.x + dx, y: p.y + dy } : n
    })
  }
}

/** 简易网格对齐（没有 dagre 时的兜底，也用于「整理选中」） */
export function snapToGrid(graph: FlowGraph, size = 20): FlowGraph {
  return {
    ...graph,
    nodes: graph.nodes.map((n) => ({
      ...n,
      x: Math.round(n.x / size) * size,
      y: Math.round(n.y / size) * size
    }))
  }
}
