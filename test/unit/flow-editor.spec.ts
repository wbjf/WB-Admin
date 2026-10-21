import { describe, expect, it } from 'vitest'
import { configureFlowEditor, flowDefaults, resetFlowConfigForTest } from '@/config/flow'
import { resolveConfig } from '@/components/FlowEditor/config'
import { BUILTIN_PALETTE, resolvePalette, searchPalette } from '@/components/FlowEditor/palette'
import {
  createEmptyGraph,
  fromLfData,
  migrateFlow,
  toLfData,
  LANE_TYPE
} from '@/components/FlowEditor/serialize'
import { detectCycle, runValidate } from '@/components/FlowEditor/validate'
import { autoLayout } from '@/components/FlowEditor/layout'
import { diffGraph, sortGraph } from '@/components/FlowEditor/diff'
import { simulate } from '@/components/FlowEditor/simulate'
import { applyTemplate, BUILTIN_TEMPLATES } from '@/components/FlowEditor/templates'
import { parseGraph, keywordFallback } from '@/components/FlowEditor/ai'
import type { FlowGraph } from '@/types'

function graphOf(): FlowGraph {
  return {
    schema: 1,
    meta: { id: 'F1', name: '测试流程', updatedAt: 1 },
    nodes: [
      {
        id: 'a',
        type: 'start',
        x: 0,
        y: 0,
        text: '开始',
        properties: { params: [], comments: [] }
      },
      {
        id: 'b',
        type: 'litho',
        x: 200,
        y: 0,
        text: '光刻',
        properties: { code: 'OP-0100', params: [], comments: [] }
      },
      {
        id: 'c',
        type: 'etch',
        x: 400,
        y: 0,
        text: '刻蚀',
        properties: { code: 'OP-0100', params: [], comments: [] }
      },
      { id: 'd', type: 'end', x: 600, y: 0, text: '结束', properties: { params: [], comments: [] } }
    ],
    edges: [
      {
        id: 'e1',
        type: 'polyline',
        sourceNodeId: 'a',
        targetNodeId: 'b',
        properties: { kind: 'main' }
      },
      {
        id: 'e2',
        type: 'polyline',
        sourceNodeId: 'b',
        targetNodeId: 'c',
        properties: { kind: 'main' }
      },
      {
        id: 'e3',
        type: 'polyline',
        sourceNodeId: 'c',
        targetNodeId: 'd',
        properties: { kind: 'main' }
      }
    ],
    groups: [{ id: 'g1', name: '区域一', x: 0, y: 0, w: 700, h: 200 }]
  }
}

/* ────────────── 配置合并 ────────────── */

describe('flow config', () => {
  it('mini 档默认关掉高级能力，元件库降为基础库', () => {
    resetFlowConfigForTest()
    const cfg = resolveConfig({ preset: 'mini' })
    expect(cfg.features.minimap).toBe(false)
    expect(cfg.features.validate).toBe(false)
    expect(cfg.features.version).toBe(false)
    expect(cfg.palette.groups.length).toBe(2)
    expect(cfg.toolbarItems).toContain('save')
    expect(cfg.toolbarItems).not.toContain('validate')
  })

  it('pro 档开满，但协同与仿真默认关（需要后端）', () => {
    const cfg = resolveConfig({ preset: 'pro' })
    expect(cfg.features.version).toBe(true)
    expect(cfg.features.ai).toBe(true)
    expect(cfg.features.collab).toBe(false)
    expect(cfg.features.simulate).toBe(false)
    expect(cfg.palette.groups.length).toBe(4)
  })

  it('只读模式强制关掉改数据的入口', () => {
    const cfg = resolveConfig({ preset: 'pro' }, true)
    expect(cfg.readonly).toBe(true)
    expect(cfg.features.ai).toBe(false)
    expect(cfg.features.template).toBe(false)
    expect(cfg.features.comment).toBe(false)
    expect(cfg.imports).toBe(false)
    expect(cfg.palette.draggable).toBe(false)
  })

  it('三层合并：档位 → 全局 → 单实例，细项只覆盖传进来的键', () => {
    resetFlowConfigForTest()
    configureFlowEditor({ features: { ai: true } })
    const cfg = resolveConfig({ preset: 'standard' })
    // 全局只改了 ai，档位的 minimap 仍然是 true
    expect(cfg.features.ai).toBe(true)
    expect(cfg.features.minimap).toBe(true)

    const cfg2 = resolveConfig({ preset: 'standard', features: { minimap: false } })
    expect(cfg2.features.minimap).toBe(false)
    resetFlowConfigForTest()
  })

  it('全局默认可被 configureFlowEditor 覆盖并可还原', () => {
    resetFlowConfigForTest()
    expect(flowDefaults.preset).toBe('standard')
    configureFlowEditor({ preset: 'mini', exports: ['png'] })
    expect(flowDefaults.preset).toBe('mini')
    resetFlowConfigForTest()
    expect(flowDefaults.preset).toBe('standard')
  })
})

/* ────────────── 元件库 ────────────── */

describe('flow palette', () => {
  it('内置库三套都在，半导体库 ≥ 20 项', () => {
    expect(BUILTIN_PALETTE.semiconductor).toBeTruthy()
    expect(BUILTIN_PALETTE.basic).toBeTruthy()
    expect(BUILTIN_PALETTE.generic).toBeTruthy()
    const count = BUILTIN_PALETTE.semiconductor.reduce((n, g) => n + g.items.length, 0)
    expect(count).toBeGreaterThanOrEqual(20)
  })

  it('groups 整体替换；extend 同 type 覆盖、新 type 追加', () => {
    const p = resolvePalette({
      preset: 'generic',
      extend: [{ type: 'task', label: '任务2', color: '#f00' }]
    })
    const task = p.index['task']
    expect(task.label).toBe('任务2')
    expect(task.color).toBe('#f00')
  })

  it('exclude 剔除类型后空分组也被移除', () => {
    const p = resolvePalette({ preset: 'generic', exclude: ['note'] })
    expect(p.index['note']).toBeUndefined()
  })

  it('readonly 强制 draggable = false', () => {
    expect(resolvePalette({ draggable: true }, 'semiconductor', true).draggable).toBe(false)
    expect(resolvePalette({}, 'semiconductor', false).draggable).toBe(true)
  })

  it('搜索命中中文名、英文别名与 type', () => {
    const all = BUILTIN_PALETTE.semiconductor.flatMap((g) => g.items)
    expect(searchPalette(all, '光刻').length).toBeGreaterThan(0)
    // euv 是「光刻机 Scanner」的英文别名，按关键词命中
    expect(searchPalette(all, 'euv').length).toBeGreaterThan(0)
    // litho 是 type 本身，按 type 命中
    expect(searchPalette(all, 'litho').length).toBeGreaterThan(0)
    expect(searchPalette(all, '不存在的东西').length).toBe(0)
  })
})

/* ────────────── 序列化 ────────────── */

describe('flow serialize', () => {
  it('FlowGraph ↔ LogicFlow 往返后节点与连线不丢', () => {
    const g = graphOf()
    const { data } = toLfData(g, resolvePalette({ preset: 'semiconductor' }).index)
    const back = fromLfData(data, g.meta)
    expect(back.nodes.length).toBe(g.nodes.length)
    expect(back.edges.length).toBe(g.edges.length)
    expect(back.groups?.length).toBe(1)
  })

  it('泳道左上角坐标与中心坐标互转一致', () => {
    const g = graphOf()
    const lane = g.groups![0]
    const { data } = toLfData(g, {})
    const laneNode = data.nodes.find((n) => n.type === LANE_TYPE)!
    expect(laneNode.x).toBe(lane.x + lane.w / 2)
    const back = fromLfData(data, g.meta)
    expect(back.groups![0].x).toBe(lane.x)
    expect(back.groups![0].name).toBe(lane.name)
  })

  it('库里没有的类型降级为 task，且不丢节点', () => {
    const g = graphOf()
    g.nodes[1].type = '不存在的类型'
    const { data, unknownTypes } = toLfData(g, resolvePalette({ preset: 'semiconductor' }).index)
    expect(unknownTypes).toContain('不存在的类型')
    expect(data.nodes.find((n) => n.id === 'b')!.type).toBe('task')
    // 回读时恢复原始 type（_rawType）
    const back = fromLfData(data, g.meta)
    expect(back.nodes.find((n) => n.id === 'b')!.type).toBe('不存在的类型')
  })

  it('内部标记 _rawType 不进导出数据', () => {
    const g = graphOf()
    const { data } = toLfData(g, {})
    const back = fromLfData(data, g.meta)
    expect(JSON.stringify(back)).not.toContain('_rawType')
  })

  it('migrateFlow 容错：字段缺失也能得到结构完整的图', () => {
    const g = migrateFlow({ nodes: [{ id: 'x', type: 'litho' }] })
    expect(g.schema).toBe(1)
    expect(g.nodes[0].x).toBe(0)
    expect(g.nodes[0].properties.params).toEqual([])
    expect(g.edges).toEqual([])
  })

  it('createEmptyGraph 结构可用', () => {
    const g = createEmptyGraph('F2', '新流程')
    expect(g.meta.name).toBe('新流程')
    expect(g.nodes).toEqual([])
  })
})

/* ────────────── 校验 ────────────── */

describe('flow validate', () => {
  it('孤立节点 / 编号重复能被报出', () => {
    const g = graphOf()
    g.nodes.push({
      id: 'z',
      type: 'litho',
      x: 0,
      y: 300,
      text: '孤立',
      properties: { params: [], comments: [] }
    })
    const issues = runValidate(g, [], {})
    expect(issues.some((i) => i.code === 'isolated')).toBe(true)
    expect(issues.some((i) => i.code === 'duplicate-code')).toBe(true)
  })

  it('无出口能被报出（最后一个节点没有下游）', () => {
    const g = graphOf()
    g.edges = g.edges.filter((e) => e.id !== 'e3')
    const issues = runValidate(g, [], {})
    expect(issues.some((i) => i.code === 'no-exit' && (i.nodeIds || []).includes('c'))).toBe(true)
  })

  it('环路检测：成环时能给出环上节点', () => {
    const g = graphOf()
    g.edges.push({
      id: 'e4',
      type: 'polyline',
      sourceNodeId: 'd',
      targetNodeId: 'b',
      properties: { kind: 'rework' }
    })
    expect(detectCycle(g).length).toBeGreaterThan(0)
    expect(runValidate(g, [], {}).some((i) => i.code === 'cycle')).toBe(true)
  })

  it('无环时 detectCycle 返回空', () => {
    expect(detectCycle(graphOf())).toEqual([])
  })

  it('自定义规则会一起跑；单条规则抛错不影响其它规则', () => {
    const issues = runValidate(
      graphOf(),
      [
        {
          code: 'custom',
          label: '自定义',
          level: 'error',
          run: () => [{ code: 'custom', level: 'error', message: '自定义问题' }]
        },
        {
          code: 'boom',
          label: '会抛错',
          run: () => {
            throw new Error('boom')
          }
        }
      ],
      {}
    )
    expect(issues.some((i) => i.code === 'custom')).toBe(true)
    expect(issues.every((i) => i.code !== 'boom')).toBe(true)
  })
})

/* ────────────── 自动布局 ────────────── */

describe('flow layout', () => {
  it('dagre 布局会改变坐标但保持节点与连线数量', () => {
    const g = graphOf()
    // 故意把节点堆在一处
    g.nodes.forEach((n) => {
      n.x = 10
      n.y = 10
    })
    const out = autoLayout(g, 'LR')
    expect(out.nodes.length).toBe(g.nodes.length)
    expect(out.edges.length).toBe(g.edges.length)
    const spread = new Set(out.nodes.map((n) => `${n.x},${n.y}`)).size
    expect(spread).toBeGreaterThan(1)
  })

  it('有环时不崩（dagre 内部断环）', () => {
    const g = graphOf()
    g.edges.push({
      id: 'e4',
      type: 'polyline',
      sourceNodeId: 'd',
      targetNodeId: 'b',
      properties: {}
    })
    const out = autoLayout(g)
    expect(out.nodes.length).toBe(4)
  })

  it('空图直接返回原图', () => {
    const g = createEmptyGraph()
    expect(autoLayout(g)).toBe(g)
  })
})

/* ────────────── diff ────────────── */

describe('flow diff', () => {
  it('新增 / 删除 / 修改 / 移动 各自归类', () => {
    const a = graphOf()
    const b = JSON.parse(JSON.stringify(a)) as FlowGraph
    b.nodes[1].text = '光刻（改）'
    b.nodes[2].x += 100
    b.nodes.push({
      id: 'new',
      type: 'metro',
      x: 0,
      y: 400,
      text: '量测',
      properties: { params: [], comments: [] }
    })
    const d = diffGraph(a, b)
    expect(d.changed).toContain('b')
    expect(d.moved).toContain('c')
    expect(d.added).toContain('new')
    expect(d.removed).toEqual([])
  })

  it('相同内容 diff 为空（sortGraph 保证顺序稳定）', () => {
    const a = sortGraph(graphOf())
    const b = sortGraph(graphOf())
    const d = diffGraph(a, b)
    expect(d.added.length + d.removed.length + d.changed.length + d.moved.length).toBe(0)
  })
})

/* ────────────── 仿真 ────────────── */

describe('flow simulate', () => {
  it('算关键路径总节拍与良率', () => {
    const g = graphOf()
    g.nodes[1].properties!.cycleTime = 40
    g.nodes[2].properties!.cycleTime = 30
    g.nodes[1].properties!.yield = 0.9
    g.nodes[2].properties!.yield = 0.8
    const r = simulate(g)
    expect(r.hasCycle).toBe(false)
    expect(r.totalCycleTime).toBe(70)
    expect(r.criticalPath.length).toBeGreaterThan(0)
    expect(r.yield).toBeCloseTo(0.72, 2)
    expect(r.bottlenecks).toContain('b')
    expect(r.worstYieldNodes).toContain('c')
  })

  it('有环时不做关键路径计算', () => {
    const g = graphOf()
    g.edges.push({
      id: 'e4',
      type: 'polyline',
      sourceNodeId: 'd',
      targetNodeId: 'b',
      properties: {}
    })
    const r = simulate(g)
    expect(r.hasCycle).toBe(true)
    expect(r.criticalPath).toEqual([])
  })
})

/* ────────────── 模板与 AI ────────────── */

describe('flow templates & ai', () => {
  it('模板可套用且 id 全部换新', () => {
    const tpl = BUILTIN_TEMPLATES[0]
    const a = applyTemplate(tpl)
    const b = applyTemplate(tpl)
    const idsA = a.nodes.map((n) => n.id)
    const idsB = b.nodes.map((n) => n.id)
    expect(idsA.some((id) => idsB.includes(id))).toBe(false)
    expect(a.edges.every((e) => a.nodes.some((n) => n.id === e.sourceNodeId))).toBe(true)
  })

  it('parseGraph 能从带围栏与解释文字的回复里抠出 JSON', () => {
    const g = parseGraph(
      '好的，这是流程图：\n```json\n' + JSON.stringify(graphOf()) + '\n```\n希望有帮助'
    )
    expect(g).not.toBeNull()
    expect(g!.nodes.length).toBe(4)
  })

  it('解析失败时关键词兜底仍能产出可编辑骨架', () => {
    const g = keywordFallback('帮我画一条从清洗到光刻到刻蚀再到量测的流程')
    expect(g.nodes.length).toBeGreaterThan(2)
    expect(g.edges.length).toBe(g.nodes.length - 1)
  })
})
