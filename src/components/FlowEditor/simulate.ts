import type { FlowGraph } from '@/types'
import { detectCycle } from './validate'

export interface SimResult {
  /** 关键路径总节拍（分钟） */
  totalCycleTime: number
  /** 关键路径上的节点 id（从入口到出口） */
  criticalPath: string[]
  /** 瓶颈工序：节拍最长的节点 */
  bottlenecks: string[]
  /** 关键路径上的理论良率（0~1） */
  yield: number
  /** 良率损失最大的工序 */
  worstYieldNodes: string[]
  /** 没填节拍的节点 */
  missingCycleTime: string[]
  /** 有环时无法算关键路径 */
  hasCycle: boolean
}

/**
 * 节拍与良率仿真（E9 / E10）。
 * 纯函数、不依赖画布：节点上有 cycleTime（分钟）与 yield（0~1）就参与计算。
 */
export function simulate(graph: FlowGraph): SimResult {
  const nodes = graph.nodes
  const timeOf = new Map<string, number>()
  const yieldOf = new Map<string, number>()
  nodes.forEach((n) => {
    const t = Number(n.properties?.cycleTime ?? 0)
    if (Number.isFinite(t) && t > 0) timeOf.set(n.id, t)
    const y = Number(n.properties?.yield ?? 1)
    yieldOf.set(n.id, Number.isFinite(y) && y > 0 && y <= 1 ? y : 1)
  })

  const missingCycleTime = nodes.filter((n) => !timeOf.has(n.id)).map((n) => n.id)
  const hasCycle = detectCycle(graph).length > 0

  if (hasCycle) {
    return {
      totalCycleTime: 0,
      criticalPath: [],
      bottlenecks: topBy(timeOf),
      yield: 1,
      worstYieldNodes: worstBy(yieldOf),
      missingCycleTime,
      hasCycle: true
    }
  }

  // 拓扑排序 + 最长路 DP
  const next = new Map<string, string[]>()
  const indeg = new Map<string, number>()
  nodes.forEach((n) => indeg.set(n.id, 0))
  graph.edges.forEach((e) => {
    if (!indeg.has(e.sourceNodeId) || !indeg.has(e.targetNodeId)) return
    const arr = next.get(e.sourceNodeId) || []
    arr.push(e.targetNodeId)
    next.set(e.sourceNodeId, arr)
    indeg.set(e.targetNodeId, (indeg.get(e.targetNodeId) || 0) + 1)
  })

  const dist = new Map<string, number>()
  const from = new Map<string, string>()
  const queue = nodes.filter((n) => (indeg.get(n.id) || 0) === 0).map((n) => n.id)
  nodes.forEach((n) => dist.set(n.id, timeOf.get(n.id) || 0))

  let processed = 0
  while (queue.length) {
    const id = queue.shift() as string
    processed++
    for (const to of next.get(id) || []) {
      const candidate = (dist.get(id) || 0) + (timeOf.get(to) || 0)
      if (candidate > (dist.get(to) || 0)) {
        dist.set(to, candidate)
        from.set(to, id)
      }
      indeg.set(to, (indeg.get(to) || 0) - 1)
      if ((indeg.get(to) || 0) === 0) queue.push(to)
    }
  }
  // 有环但 detectCycle 没抓到（理论上不会）时退化为不计算路径
  if (processed !== nodes.length) {
    return {
      totalCycleTime: 0,
      criticalPath: [],
      bottlenecks: topBy(timeOf),
      yield: 1,
      worstYieldNodes: worstBy(yieldOf),
      missingCycleTime,
      hasCycle: true
    }
  }

  let endId = ''
  let maxDist = -1
  dist.forEach((v, k) => {
    if (v > maxDist) {
      maxDist = v
      endId = k
    }
  })

  const path: string[] = []
  let cur: string | undefined = endId
  const guard = new Set<string>()
  while (cur && !guard.has(cur)) {
    guard.add(cur)
    path.unshift(cur)
    cur = from.get(cur)
  }

  const y = path.reduce((acc, id) => acc * (yieldOf.get(id) ?? 1), 1)

  return {
    totalCycleTime: Math.round((maxDist < 0 ? 0 : maxDist) * 10) / 10,
    criticalPath: path,
    bottlenecks: topBy(timeOf),
    yield: Math.round(y * 10000) / 10000,
    worstYieldNodes: worstBy(yieldOf),
    missingCycleTime,
    hasCycle: false
  }
}

function topBy(map: Map<string, number>): string[] {
  if (!map.size) return []
  const max = Math.max(...map.values())
  return [...map.entries()].filter(([, v]) => v === max).map(([k]) => k)
}

function worstBy(map: Map<string, number>): string[] {
  if (!map.size) return []
  const min = Math.min(...map.values())
  if (min >= 1) return []
  return [...map.entries()].filter(([, v]) => v === min).map(([k]) => k)
}
