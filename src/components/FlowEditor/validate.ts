import type { FlowGraph, FlowIssue } from '@/types'
import type { PaletteItem, ValidateRule } from './types'

/** 这些类型不参与「孤立 / 无入口 / 无出口」检查 */
const IGNORE_FLOW_TYPES = new Set(['note', 'start', 'end', 'lot'])

export interface ValidateContext {
  paletteIndex: Record<string, PaletteItem>
}

/** 内置规则：每条只做一件事，方便单独关掉 */
export const RULES: Record<string, ValidateRule> = {
  isolated: {
    code: 'isolated',
    label: '孤立节点',
    level: 'warn',
    run(graph: FlowGraph) {
      const linked = new Set<string>()
      graph.edges.forEach((e) => {
        linked.add(e.sourceNodeId)
        linked.add(e.targetNodeId)
      })
      return graph.nodes
        .filter((n) => !IGNORE_FLOW_TYPES.has(n.type) && !linked.has(n.id))
        .map((n) => ({
          code: 'isolated',
          level: 'warn' as const,
          message: `「${n.text || n.id}」没有任何连线`,
          nodeIds: [n.id]
        }))
    }
  },
  noEntry: {
    code: 'no-entry',
    label: '无入口',
    level: 'error',
    run(graph: FlowGraph) {
      const targets = new Set(graph.edges.map((e) => e.targetNodeId))
      return graph.nodes
        .filter((n) => !IGNORE_FLOW_TYPES.has(n.type) && n.type !== 'start' && !targets.has(n.id))
        .map((n) => ({
          code: 'no-entry',
          level: 'error' as const,
          message: `「${n.text || n.id}」没有上游连线`,
          nodeIds: [n.id]
        }))
    }
  },
  noExit: {
    code: 'no-exit',
    label: '无出口',
    level: 'error',
    run(graph: FlowGraph) {
      const sources = new Set(graph.edges.map((e) => e.sourceNodeId))
      return graph.nodes
        .filter((n) => !IGNORE_FLOW_TYPES.has(n.type) && n.type !== 'end' && !sources.has(n.id))
        .map((n) => ({
          code: 'no-exit',
          level: 'error' as const,
          message: `「${n.text || n.id}」没有下游连线`,
          nodeIds: [n.id]
        }))
    }
  },
  cycle: {
    code: 'cycle',
    label: '存在环路',
    level: 'warn',
    run(graph: FlowGraph) {
      const ids = detectCycle(graph)
      if (!ids.length) return []
      return [
        {
          code: 'cycle',
          level: 'warn' as const,
          message: `检测到环路：${ids
            .map((id) => graph.nodes.find((n) => n.id === id)?.text || id)
            .join(' → ')}`,
          nodeIds: ids
        }
      ]
    }
  },
  duplicateCode: {
    code: 'duplicate-code',
    label: '编号重复',
    level: 'error',
    run(graph: FlowGraph) {
      const seen = new Map<string, string[]>()
      graph.nodes.forEach((n) => {
        const code = n.properties?.code
        if (!code) return
        const arr = seen.get(String(code)) || []
        arr.push(n.id)
        seen.set(String(code), arr)
      })
      const issues: FlowIssue[] = []
      seen.forEach((ids, code) => {
        if (ids.length > 1) {
          issues.push({
            code: 'duplicate-code',
            level: 'error',
            message: `工序编号 ${code} 被 ${ids.length} 个节点重复使用`,
            nodeIds: ids
          })
        }
      })
      return issues
    }
  },
  missingName: {
    code: 'missing-name',
    label: '未命名节点',
    level: 'warn',
    run(graph: FlowGraph) {
      return graph.nodes
        .filter((n) => !n.text?.trim())
        .map((n) => ({
          code: 'missing-name',
          level: 'warn' as const,
          message: `存在未命名节点（${n.id}）`,
          nodeIds: [n.id]
        }))
    }
  },
  /** 连线白名单（PaletteItem.next）：软校验，只提示不阻断 */
  nextWhitelist: {
    code: 'next-whitelist',
    label: '连线不符合推荐关系',
    level: 'info',
    run(graph: FlowGraph, ctx: ValidateContext) {
      const byId = new Map(graph.nodes.map((n) => [n.id, n]))
      const issues: FlowIssue[] = []
      graph.edges.forEach((e) => {
        const src = byId.get(e.sourceNodeId)
        const dst = byId.get(e.targetNodeId)
        if (!src || !dst) return
        const allow = ctx.paletteIndex[src.type]?.next
        if (!allow?.length) return
        if (allow.includes(dst.type)) return
        issues.push({
          code: 'next-whitelist',
          level: 'info',
          message: `「${src.text || src.id}」→「${dst.text || dst.id}」不是推荐连线（推荐：${allow.join(' / ')}）`,
          edgeIds: [e.id],
          nodeIds: [src.id, dst.id]
        })
      })
      return issues
    }
  }
}

export const BUILTIN_RULE_LIST: ValidateRule[] = [
  RULES.noEntry,
  RULES.noExit,
  RULES.isolated,
  RULES.cycle,
  RULES.duplicateCode,
  RULES.missingName,
  RULES.nextWhitelist
]

/** 跑一遍校验：内置规则 + 使用方注入的规则 */
export function runValidate(
  graph: FlowGraph,
  extraRules: ValidateRule[] = [],
  paletteIndex: Record<string, PaletteItem> = {}
): FlowIssue[] {
  const ctx: ValidateContext = { paletteIndex }
  const run = (rule: ValidateRule): FlowIssue[] => {
    try {
      const issues = rule.run(graph, ctx) || []
      return issues.map((i) => ({ ...i, level: rule.level || i.level }))
    } catch {
      // 单条规则出错不能让整个校验挂掉
      return []
    }
  }
  return [...BUILTIN_RULE_LIST, ...extraRules].flatMap(run)
}

/** DFS 找一条环（返回环上的节点 id），无环返回空数组 */
export function detectCycle(graph: FlowGraph): string[] {
  const next = new Map<string, string[]>()
  graph.edges.forEach((e) => {
    const arr = next.get(e.sourceNodeId) || []
    arr.push(e.targetNodeId)
    next.set(e.sourceNodeId, arr)
  })
  const state = new Map<string, 0 | 1 | 2>() // 0 未访问 1 在栈上 2 已完成
  const stack: string[] = []
  let found: string[] = []

  const dfs = (id: string): boolean => {
    state.set(id, 1)
    stack.push(id)
    for (const n of next.get(id) || []) {
      const s = state.get(n) || 0
      if (s === 1) {
        const at = stack.indexOf(n)
        found = stack.slice(at >= 0 ? at : 0)
        return true
      }
      if (s === 0 && dfs(n)) return true
    }
    stack.pop()
    state.set(id, 2)
    return false
  }

  for (const n of graph.nodes) {
    if ((state.get(n.id) || 0) === 0 && dfs(n.id)) break
  }
  return found
}
