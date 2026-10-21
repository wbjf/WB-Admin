import type { FlowEdge, FlowGraph, FlowNode } from '@/types'

export interface GraphDiff {
  added: string[]
  removed: string[]
  /** 属性或文本变了 */
  changed: string[]
  /** 只挪了位置 */
  moved: string[]
  edgeAdded: string[]
  edgeRemoved: string[]
}

/** 两版对比：新增绿 / 删除红 / 修改黄 / 移动蓝 */
export function diffGraph(base: FlowGraph, target: FlowGraph): GraphDiff {
  const b = new Map(base.nodes.map((n) => [n.id, n]))
  const t = new Map(target.nodes.map((n) => [n.id, n]))

  const added: string[] = []
  const removed: string[] = []
  const changed: string[] = []
  const moved: string[] = []

  t.forEach((n, id) => {
    const old = b.get(id)
    if (!old) {
      added.push(id)
      return
    }
    const posChanged = Math.abs(old.x - n.x) > 1 || Math.abs(old.y - n.y) > 1
    const textChanged = (old.text || '') !== (n.text || '')
    const propsChanged = JSON.stringify(old.properties || {}) !== JSON.stringify(n.properties || {})
    if (textChanged || propsChanged) changed.push(id)
    else if (posChanged) moved.push(id)
  })
  b.forEach((_n, id) => {
    if (!t.has(id)) removed.push(id)
  })

  const be = new Map(base.edges.map((e) => [e.id, e]))
  const te = new Map(target.edges.map((e) => [e.id, e]))
  const edgeAdded = [...te.keys()].filter((id) => !be.has(id))
  const edgeRemoved = [...be.keys()].filter((id) => !te.has(id))

  return { added, removed, changed, moved, edgeAdded, edgeRemoved }
}

/** 给节点标注 diff 状态，画布高亮用 */
export function diffMarks(
  diff: GraphDiff
): Record<string, 'added' | 'removed' | 'changed' | 'moved'> {
  const marks: Record<string, 'added' | 'removed' | 'changed' | 'moved'> = {}
  diff.added.forEach((id) => (marks[id] = 'added'))
  diff.removed.forEach((id) => (marks[id] = 'removed'))
  diff.changed.forEach((id) => (marks[id] = 'changed'))
  diff.moved.forEach((id) => (marks[id] = 'moved'))
  return marks
}

export const DIFF_COLOR: Record<string, string> = {
  added: '#67c23a',
  removed: '#f56c6c',
  changed: '#e6a23c',
  moved: '#409eff'
}

/** 对比结果转成可读文本（版本对比面板 / 导出用） */
export function diffSummary(
  base: FlowGraph,
  target: FlowGraph,
  dict: { [k: string]: string }
): string[] {
  const d = diffGraph(base, target)
  const nameOf = (id: string) =>
    target.nodes.find((n) => n.id === id)?.text || base.nodes.find((n) => n.id === id)?.text || id
  const lines: string[] = []
  if (d.added.length) lines.push(`${dict.added ?? '新增'}：${d.added.map(nameOf).join('、')}`)
  if (d.removed.length) lines.push(`${dict.removed ?? '删除'}：${d.removed.map(nameOf).join('、')}`)
  if (d.changed.length) lines.push(`${dict.changed ?? '修改'}：${d.changed.map(nameOf).join('、')}`)
  if (d.moved.length) lines.push(`${dict.moved ?? '移动'}：${d.moved.map(nameOf).join('、')}`)
  if (d.edgeAdded.length) lines.push(`${dict.edgeAdded ?? '新增连线'}：${d.edgeAdded.length} 条`)
  if (d.edgeRemoved.length)
    lines.push(`${dict.edgeRemoved ?? '删除连线'}：${d.edgeRemoved.length} 条`)
  return lines.length ? lines : [dict.same ?? '两版内容一致']
}

/** 把节点/边按 id 排序，保证导出稳定（diff 不会因为顺序抖动误报） */
export function sortGraph(graph: FlowGraph): FlowGraph {
  const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  return {
    ...graph,
    nodes: [...graph.nodes].sort(byId) as FlowNode[],
    edges: [...graph.edges].sort(byId) as FlowEdge[]
  }
}
