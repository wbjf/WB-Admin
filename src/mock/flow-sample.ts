import type { FlowGraph } from '@/types'

/** 供 mock 使用的示例图：28nm 逻辑工艺 FEOL（与 UI 原型一致） */
export function sampleFeolGraph(id = 'F1', name = '28nm 逻辑工艺流程（FEOL）'): FlowGraph {
  const n = (
    id: string,
    type: string,
    x: number,
    y: number,
    text: string,
    code: string,
    extra: Record<string, unknown> = {}
  ) => ({
    id,
    type,
    x,
    y,
    width: 140,
    height: 54,
    text,
    properties: {
      code,
      params: [] as Array<{ key: string; value: string; unit?: string }>,
      comments: [],
      ...extra
    }
  })

  return {
    schema: 1,
    meta: { id, name, category: 'process', updatedAt: Date.now(), version: 1 },
    nodes: [
      n('n0', 'start', 80, 140, '开始', ''),
      n('n1', 'clean', 260, 140, 'RCA 清洗', 'OP-0100', { remark: 'SC-1 / SC-2' }),
      n('n2', 'furnace', 440, 140, '热氧化', 'OP-0200', { remark: 'Furnace 900℃' }),
      n('n3', 'coater', 620, 140, '涂胶', 'OP-0300', { remark: 'Track 1.2μm' }),
      n('n4', 'litho', 800, 140, '光刻曝光', 'OP-0400', { remark: 'Scanner · EUV', cycleTime: 45 }),
      n('n5', 'develop', 260, 320, '显影', 'OP-0500', { remark: 'TMAH 2.38%' }),
      n('n6', 'etch', 440, 320, '刻蚀', 'OP-0600', { remark: 'ICP · CF4/O2', cycleTime: 30 }),
      n('n7', 'strip', 620, 320, '去胶', 'OP-0700', { remark: 'Asher · O2' }),
      n('n8', 'cmp', 800, 320, 'CMP 抛光', 'OP-0800', { cycleTime: 25 }),
      n('n9', 'metro', 980, 320, 'CD 量测', 'OP-0900', { cycleTime: 20 }),
      n('n10', 'deposition', 260, 500, '下一工序段', 'OP-1000', { remark: 'BEOL 金属互连' })
    ],
    edges: [
      {
        id: 'e1',
        type: 'polyline',
        sourceNodeId: 'n0',
        targetNodeId: 'n1',
        properties: { kind: 'main' }
      },
      {
        id: 'e2',
        type: 'polyline',
        sourceNodeId: 'n1',
        targetNodeId: 'n2',
        properties: { kind: 'main' }
      },
      {
        id: 'e3',
        type: 'polyline',
        sourceNodeId: 'n2',
        targetNodeId: 'n3',
        properties: { kind: 'main' }
      },
      {
        id: 'e4',
        type: 'polyline',
        sourceNodeId: 'n3',
        targetNodeId: 'n4',
        properties: { kind: 'main' }
      },
      {
        id: 'e5',
        type: 'polyline',
        sourceNodeId: 'n4',
        targetNodeId: 'n5',
        properties: { kind: 'main' }
      },
      {
        id: 'e6',
        type: 'polyline',
        sourceNodeId: 'n5',
        targetNodeId: 'n6',
        properties: { kind: 'main' }
      },
      {
        id: 'e7',
        type: 'polyline',
        sourceNodeId: 'n6',
        targetNodeId: 'n7',
        properties: { kind: 'main' }
      },
      {
        id: 'e8',
        type: 'polyline',
        sourceNodeId: 'n7',
        targetNodeId: 'n8',
        properties: { kind: 'main' }
      },
      {
        id: 'e9',
        type: 'polyline',
        sourceNodeId: 'n8',
        targetNodeId: 'n9',
        properties: { kind: 'main' }
      },
      {
        id: 'e10',
        type: 'polyline',
        sourceNodeId: 'n9',
        targetNodeId: 'n10',
        text: 'OK',
        properties: { kind: 'main' }
      },
      {
        id: 'e11',
        type: 'polyline',
        sourceNodeId: 'n9',
        targetNodeId: 'n6',
        text: 'NG · 返工',
        properties: { kind: 'rework', dashed: true }
      }
    ],
    groups: [
      { id: 'g1', name: 'FEOL · 薄膜与光刻', x: 20, y: 80, w: 940, h: 140 },
      { id: 'g2', name: 'FEOL · 图形化与量测', x: 20, y: 260, w: 940, h: 140 },
      { id: 'g3', name: '后续工序', x: 20, y: 440, w: 940, h: 140 }
    ]
  }
}

/** 模板库（E3）用的几条工艺流 */
export function sampleTemplates(): FlowGraph[] {
  const feol = sampleFeolGraph('', 'CMOS FEOL 标准流')

  const beol: FlowGraph = {
    schema: 1,
    meta: { id: '', name: 'BEOL 金属互连流', category: 'process', updatedAt: Date.now() },
    nodes: [
      {
        id: 'b0',
        type: 'start',
        x: 100,
        y: 200,
        width: 140,
        height: 54,
        text: '开始',
        properties: { params: [], comments: [] }
      },
      {
        id: 'b1',
        type: 'deposition',
        x: 300,
        y: 200,
        width: 140,
        height: 54,
        text: '介质沉积',
        properties: { code: 'OP-1100', params: [], comments: [] }
      },
      {
        id: 'b2',
        type: 'litho',
        x: 500,
        y: 200,
        width: 140,
        height: 54,
        text: '通孔光刻',
        properties: { code: 'OP-1200', params: [], comments: [] }
      },
      {
        id: 'b3',
        type: 'etch',
        x: 700,
        y: 200,
        width: 140,
        height: 54,
        text: '通孔刻蚀',
        properties: { code: 'OP-1300', params: [], comments: [] }
      },
      {
        id: 'b4',
        type: 'deposition',
        x: 900,
        y: 200,
        width: 140,
        height: 54,
        text: 'Cu 电镀',
        properties: { code: 'OP-1400', params: [], comments: [] }
      },
      {
        id: 'b5',
        type: 'cmp',
        x: 1100,
        y: 200,
        width: 140,
        height: 54,
        text: 'Cu CMP',
        properties: { code: 'OP-1500', params: [], comments: [] }
      },
      {
        id: 'b6',
        type: 'end',
        x: 1300,
        y: 200,
        width: 140,
        height: 54,
        text: '结束',
        properties: { params: [], comments: [] }
      }
    ],
    edges: ['b1', 'b2', 'b3', 'b4', 'b5', 'b6'].map((t, i) => ({
      id: `be${i}`,
      type: 'polyline' as const,
      sourceNodeId: i === 0 ? 'b0' : `b${i}`,
      targetNodeId: t,
      properties: { kind: 'main' as const }
    })),
    groups: []
  }

  const pkg: FlowGraph = {
    schema: 1,
    meta: { id: '', name: '封装测试流', category: 'process', updatedAt: Date.now() },
    nodes: [
      {
        id: 'p0',
        type: 'start',
        x: 100,
        y: 200,
        width: 140,
        height: 54,
        text: '晶圆来料',
        properties: { params: [], comments: [] }
      },
      {
        id: 'p1',
        type: 'cmp',
        x: 300,
        y: 200,
        width: 140,
        height: 54,
        text: '减薄',
        properties: { code: 'OP-2100', params: [], comments: [] }
      },
      {
        id: 'p2',
        type: 'etch',
        x: 500,
        y: 200,
        width: 140,
        height: 54,
        text: '划片',
        properties: { code: 'OP-2200', params: [], comments: [] }
      },
      {
        id: 'p3',
        type: 'deposition',
        x: 700,
        y: 200,
        width: 140,
        height: 54,
        text: '贴片键合',
        properties: { code: 'OP-2300', params: [], comments: [] }
      },
      {
        id: 'p4',
        type: 'metro',
        x: 900,
        y: 200,
        width: 140,
        height: 54,
        text: '成品测试',
        properties: { code: 'OP-2400', params: [], comments: [] }
      },
      {
        id: 'p5',
        type: 'end',
        x: 1100,
        y: 200,
        width: 140,
        height: 54,
        text: '出货',
        properties: { params: [], comments: [] }
      }
    ],
    edges: ['p1', 'p2', 'p3', 'p4', 'p5'].map((t, i) => ({
      id: `pe${i}`,
      type: 'polyline' as const,
      sourceNodeId: `p${i}`,
      targetNodeId: t,
      properties: { kind: 'main' as const }
    })),
    groups: []
  }

  return [feol, beol, pkg]
}
