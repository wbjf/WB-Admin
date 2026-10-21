import type { FlowGraph } from '@/types'
import { newId } from './serialize'

/**
 * 内置模板库（E3）。
 * 模板就是普通的 FlowGraph，套用时深拷贝一份并换掉 id ——
 * 不做「模板节点」这种特殊类型，避免数据结构分叉。
 */

function node(
  type: string,
  x: number,
  y: number,
  text: string,
  code = '',
  extra: Record<string, unknown> = {}
) {
  return {
    id: newId('n'),
    type,
    x,
    y,
    width: 140,
    height: 54,
    text,
    properties: { code, params: [], comments: [], ...extra }
  }
}

function chain(nodes: ReturnType<typeof node>[]): FlowGraph['edges'] {
  return nodes.slice(1).map((n, i) => ({
    id: newId('e'),
    type: 'polyline' as const,
    sourceNodeId: nodes[i].id,
    targetNodeId: n.id,
    properties: { kind: 'main' as const }
  }))
}

function build(
  name: string,
  steps: Array<[string, string, string]>,
  category: FlowGraph['meta']['category'] = 'process'
): FlowGraph {
  const nodes = [
    node('start', 100, 200, '开始'),
    ...steps.map((s, i) => node(s[0], 100 + (i + 1) * 190, 200, s[1], s[2])),
    node('end', 100 + (steps.length + 1) * 190, 200, '结束')
  ]
  return {
    schema: 1,
    meta: { id: '', name, category, updatedAt: Date.now() },
    nodes,
    edges: chain(nodes),
    groups: []
  }
}

export const BUILTIN_TEMPLATES: FlowGraph[] = [
  build('CMOS FEOL 标准流', [
    ['clean', 'RCA 清洗', 'OP-0100'],
    ['furnace', '热氧化', 'OP-0200'],
    ['coater', '涂胶', 'OP-0300'],
    ['litho', '光刻曝光', 'OP-0400'],
    ['develop', '显影', 'OP-0500'],
    ['etch', '刻蚀', 'OP-0600'],
    ['strip', '去胶', 'OP-0700'],
    ['metro', 'CD 量测', 'OP-0800']
  ]),
  build('BEOL 金属互连流', [
    ['deposition', '介质沉积', 'OP-1100'],
    ['litho', '通孔光刻', 'OP-1200'],
    ['etch', '通孔刻蚀', 'OP-1300'],
    ['deposition', 'Cu 电镀', 'OP-1400'],
    ['cmp', 'Cu CMP', 'OP-1500']
  ]),
  build('封装测试流', [
    ['cmp', '晶圆减薄', 'OP-2100'],
    ['etch', '划片', 'OP-2200'],
    ['deposition', '贴片键合', 'OP-2300'],
    ['metro', '成品测试', 'OP-2400']
  ]),
  build(
    '设备布局图',
    [
      ['eq-scanner', '光刻区', ''],
      ['eq-etcher', '刻蚀区', ''],
      ['eq-furnace', '薄膜区', ''],
      ['eq-metro', '量测区', '']
    ],
    'layout'
  )
]

/** 套用模板：换 id、保留模板里的相对坐标 */
export function applyTemplate(tpl: FlowGraph, targetName?: string): FlowGraph {
  const copy = JSON.parse(JSON.stringify(tpl)) as FlowGraph
  const map = new Map<string, string>()
  copy.nodes = copy.nodes.map((n) => {
    const id = newId('n')
    map.set(n.id, id)
    return { ...n, id }
  })
  copy.edges = copy.edges.map((e) => ({
    ...e,
    id: newId('e'),
    sourceNodeId: map.get(e.sourceNodeId) || e.sourceNodeId,
    targetNodeId: map.get(e.targetNodeId) || e.targetNodeId
  }))
  copy.meta = { ...copy.meta, id: '', name: targetName || copy.meta.name, updatedAt: Date.now() }
  return copy
}
