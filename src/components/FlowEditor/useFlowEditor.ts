import { computed, ref, shallowRef, type Ref } from 'vue'
import LogicFlow from '@logicflow/core'
import { MiniMap, SelectionSelect, Snapshot } from '@logicflow/extension'
import type { FlowEdge, FlowGraph, FlowIssue, FlowNode } from '@/types'
import { registerNodes, FLOW_EDGE_TYPE } from './nodes'
import { LANE_TYPE, cloneGraph, fromLfData, newId, toLfData } from './serialize'
import { autoLayout, type LayoutDirection } from './layout'
import { runValidate } from './validate'
import type { PaletteItem, ResolvedFlowConfig } from './types'

export interface Selection {
  kind: 'node' | 'edge' | 'graph' | 'none'
  id: string
}

export interface UseFlowEditorOptions {
  container: Ref<HTMLElement | undefined>
  cfg: Ref<ResolvedFlowConfig>
  initial: FlowGraph
  onChange?: (graph: FlowGraph) => void
  onSelect?: (sel: Selection) => void
}

/**
 * 编辑器核心：一个 composable 管住 LogicFlow 实例的生老病死。
 * 对外**不暴露 lf 实例**，只给命令与状态（PRD 5.7）。
 */
export function useFlowEditor(opts: UseFlowEditorOptions) {
  const { container, cfg } = opts
  const lf = shallowRef<LogicFlow | null>(null)
  const graph = ref<FlowGraph>(cloneGraph(opts.initial)) as Ref<FlowGraph>
  const selected = ref<Selection>({ kind: 'none', id: '' })
  const issues = ref<FlowIssue[]>([])
  const dirty = ref(false)
  const zoomText = ref('100%')
  const unknownTypes = ref<string[]>([])
  /** 剪贴板（复制粘贴） */
  let clipboard: FlowGraph | null = null

  const stats = computed(() => ({
    nodes: graph.value.nodes.length,
    edges: graph.value.edges.length,
    lanes: graph.value.groups?.length ?? 0
  }))

  const paletteIndex = computed(() => cfg.value.palette.index)

  /* ────────────────── 生命周期 ────────────────── */

  function build(): void {
    const el = container.value
    if (!el || lf.value) return
    const c = cfg.value
    const readonly = c.readonly

    const plugins: unknown[] = [Snapshot]
    if (c.features.minimap && !readonly) plugins.push(MiniMap)
    if (!readonly) plugins.push(SelectionSelect)

    const instance = new LogicFlow({
      container: el,
      grid: { size: c.gridSize, visible: true },
      isSilentMode: readonly,
      textEdit: !readonly,
      nodeTextEdit: !readonly,
      edgeTextEdit: !readonly,
      snapline: !readonly,
      history: !readonly,
      keyboard: { enabled: !readonly },
      // 只读默认仍允许缩放与平移（PRD 验收标准 10）；interactive=false 才锁死
      stopZoomGraph: !c.interactive,
      stopScrollGraph: !c.interactive,
      stopMoveGraph: !c.interactive,
      plugins: plugins as never[],
      pluginsOptions: {
        miniMap: {
          width: 200,
          height: 130,
          showEdge: true,
          isShowHeader: false,
          rightPosition: 12,
          bottomPosition: 12
        }
      },
      style: {
        rect: { fill: '#fff', stroke: '#dcdfe6', strokeWidth: 1, radius: 6 },
        polyline: { stroke: '#909399', strokeWidth: 1.6 },
        nodeText: { fontSize: 13, color: '#303133' },
        edgeText: {
          fontSize: 12,
          color: '#606266',
          textWidth: 120,
          background: { fill: '#ffffff' }
        }
      }
    })

    registerNodes(instance, paletteIndex.value)
    lf.value = instance
    bindEvents(instance)
    render(graph.value)
    bindShortcuts(instance, readonly)
  }

  function destroy(): void {
    if (!lf.value) return
    try {
      lf.value.destroy?.()
    } catch {
      // 销毁失败不影响页面卸载
    }
    lf.value = null
  }

  function render(next: FlowGraph): void {
    const instance = lf.value
    if (!instance) return
    const { data, unknownTypes: unknown } = toLfData(next, paletteIndex.value)
    unknownTypes.value = unknown
    // 连线统一走自定义边（内置 polyline 不支持按 kind 上色）
    data.edges = data.edges.map((e) => ({
      ...e,
      type: e.type === 'polyline' ? FLOW_EDGE_TYPE : e.type
    }))
    instance.render(data as never)
    graph.value = fromLfData(instance.getGraphData() as never, next.meta)
    refreshZoom()
  }

  /* ────────────────── 事件 ────────────────── */

  function bindEvents(instance: LogicFlow): void {
    const sync = () => {
      graph.value = fromLfData(instance.getGraphData() as never, graph.value.meta)
      dirty.value = true
      opts.onChange?.(graph.value)
    }
    instance.on('history:change', sync)
    // 文本更新不进 history，单独同步一次
    instance.on('text:update', sync)
    instance.on('node:click', ({ data }: { data: { id: string } }) => setSelection('node', data.id))
    instance.on('edge:click', ({ data }: { data: { id: string } }) => setSelection('edge', data.id))
    instance.on('blank:click', () => setSelection('graph', ''))
    instance.on('graph:transform', () => refreshZoom())
    instance.on('node:delete', sync)
    instance.on('edge:delete', sync)
  }

  function bindShortcuts(instance: LogicFlow, readonly: boolean): void {
    if (readonly) return
    // LogicFlow 内置已带 undo/redo？没有则自己挂，重复绑定无害（键盘插件按 keys 覆盖）
    const kb = (
      instance as unknown as { keyboard?: { on?: (k: string[], cb: () => void) => void } }
    ).keyboard
    kb?.on?.(['ctrl+z', 'meta+z'], () => instance.undo())
    kb?.on?.(['ctrl+shift+z', 'meta+shift+z'], () => instance.redo())
    kb?.on?.(['ctrl+c', 'meta+c'], () => copySelection())
    kb?.on?.(['ctrl+v', 'meta+v'], () => paste(20, 20))
    kb?.on?.(['backspace', 'del'], () => deleteSelection())
  }

  /** 当前选中（多选也算）：供外部「拿选中的节点做批量操作」 */
  function getSelected(): { nodes: FlowNode[]; edges: string[] } {
    const instance = lf.value
    if (!instance) return { nodes: [], edges: [] }
    const sel = instance.getSelectElements(true) as unknown as {
      nodes?: FlowNode[]
      edges?: FlowEdge[]
    }
    const nodes = (sel.nodes || []).map((n) => graph.value.nodes.find((x) => x.id === n.id) || n)
    return { nodes, edges: (sel.edges || []).map((e) => e.id) }
  }

  function refreshZoom(): void {
    const instance = lf.value
    if (!instance) return
    const scale = (instance as unknown as { graphModel?: { transformModel?: { SCALE?: number } } })
      .graphModel?.transformModel?.SCALE
    if (scale) zoomText.value = `${Math.round(scale * 100)}%`
  }

  function setSelection(kind: Selection['kind'], id: string): void {
    selected.value = { kind, id }
    opts.onSelect?.(selected.value)
  }

  /* ────────────────── 命令 ────────────────── */

  function addNode(item: PaletteItem, position?: { x: number; y: number }): string {
    const instance = lf.value
    if (!instance) return ''
    const point = position || centerOfView()
    const id = newId('n')
    instance.addNode({
      id,
      type: item.type,
      x: point.x,
      y: point.y,
      text: item.label,
      properties: {
        ...(item.defaults || {}),
        color: item.color,
        icon: typeof item.icon === 'string' ? item.icon : 'default'
      }
    } as never)
    setSelection('node', id)
    return id
  }

  function addLane(): string {
    const instance = lf.value
    if (!instance) return ''
    const point = centerOfView()
    const id = newId('g')
    instance.addNode({
      id,
      type: LANE_TYPE,
      x: point.x,
      y: point.y,
      text: '区域',
      width: 520,
      height: 200,
      properties: { _lane: true, name: '区域' }
    } as never)
    return id
  }

  function updateNode(id: string, props: Record<string, unknown>): void {
    lf.value?.setProperties(id, props)
  }

  function updateNodeText(id: string, text: string): void {
    lf.value?.updateText(id, text)
  }

  function updateEdge(id: string, props: Record<string, unknown>): void {
    lf.value?.setProperties(id, props)
  }

  function deleteSelection(): void {
    const instance = lf.value
    if (!instance) return
    const sel = instance.getSelectElements(true) as unknown as {
      nodes: { id: string }[]
      edges: { id: string }[]
    }
    sel.edges?.forEach((e) => instance.deleteEdge(e.id))
    sel.nodes?.forEach((n) => instance.deleteNode(n.id))
    setSelection('graph', '')
  }

  function copySelection(): void {
    const instance = lf.value
    if (!instance) return
    const sel = instance.getSelectElements(true) as unknown as {
      nodes: FlowNode[]
      edges: FlowEdge[]
    }
    if (!sel.nodes?.length) return
    const ids = new Set(sel.nodes.map((n) => n.id))
    clipboard = {
      schema: 1,
      meta: graph.value.meta,
      nodes: sel.nodes.map((n) => ({ ...n, properties: { ...(n.properties || {}) } })),
      edges: (sel.edges || []).filter((e) => ids.has(e.sourceNodeId) && ids.has(e.targetNodeId)),
      groups: []
    }
  }

  function paste(dx = 20, dy = 20): void {
    const instance = lf.value
    if (!instance || !clipboard) return
    const idMap = new Map<string, string>()
    clipboard.nodes.forEach((n) => {
      const newIdValue = newId('n')
      idMap.set(n.id, newIdValue)
      instance.addNode({
        ...n,
        id: newIdValue,
        x: n.x + dx,
        y: n.y + dy,
        properties: { ...(n.properties || {}), code: undefined }
      } as never)
    })
    clipboard.edges.forEach((e) => {
      const s = idMap.get(e.sourceNodeId)
      const t = idMap.get(e.targetNodeId)
      if (!s || !t) return
      instance.addEdge({
        type: FLOW_EDGE_TYPE,
        sourceNodeId: s,
        targetNodeId: t,
        properties: e.properties
      } as never)
    })
  }

  function undo(): void {
    lf.value?.undo()
  }
  function redo(): void {
    lf.value?.redo()
  }

  function zoomBy(delta: number): void {
    lf.value?.zoom(delta > 0 ? 1.1 : 0.9)
    refreshZoom()
  }
  function fitView(): void {
    lf.value?.fitView()
    refreshZoom()
  }
  function translateCenter(): void {
    lf.value?.translateCenter()
  }

  /** 定位到节点：居中 + 选中（搜索定位 / 校验定位都用它） */
  function focusNode(id: string): void {
    const instance = lf.value
    if (!instance) return
    instance.focusOn({ id })
    instance.selectElementById(id)
    setSelection('node', id)
  }

  function applyLayout(direction: LayoutDirection = 'LR'): void {
    if (!lf.value) return
    const next = autoLayout(graph.value, direction)
    render(next)
    dirty.value = true
    opts.onChange?.(graph.value)
  }

  function validate(): FlowIssue[] {
    issues.value = runValidate(graph.value, cfg.value.validateRules, paletteIndex.value)
    return issues.value
  }

  function setGraph(next: FlowGraph): void {
    graph.value = cloneGraph(next)
    render(graph.value)
  }

  function getGraph(): FlowGraph {
    return graph.value
  }

  function clear(): void {
    graph.value = { ...graph.value, nodes: [], edges: [], groups: [] }
    render(graph.value)
  }

  function centerOfView(): { x: number; y: number } {
    const instance = lf.value
    const el = container.value
    if (!instance || !el) return { x: 200, y: 200 }
    const rect = el.getBoundingClientRect()
    const p = instance.getPointByClient(rect.left + rect.width / 2, rect.top + rect.height / 2)
    return {
      x: Math.round(p.canvasOverlayPosition?.x ?? 200),
      y: Math.round(p.canvasOverlayPosition?.y ?? 200)
    }
  }

  /** 屏幕坐标 → 画布坐标（拖拽落点用） */
  function clientToCanvas(clientX: number, clientY: number): { x: number; y: number } {
    const instance = lf.value
    if (!instance) return { x: 0, y: 0 }
    const p = instance.getPointByClient(clientX, clientY)
    return {
      x: Math.round(p.canvasOverlayPosition?.x ?? 0),
      y: Math.round(p.canvasOverlayPosition?.y ?? 0)
    }
  }

  return {
    lf,
    graph,
    selected,
    issues,
    dirty,
    zoomText,
    stats,
    unknownTypes,
    build,
    destroy,
    render,
    addNode,
    addLane,
    updateNode,
    updateNodeText,
    updateEdge,
    deleteSelection,
    copySelection,
    paste,
    undo,
    redo,
    zoomBy,
    fitView,
    translateCenter,
    focusNode,
    applyLayout,
    validate,
    setGraph,
    getGraph,
    clear,
    clientToCanvas,
    centerOfView,
    setSelection,
    getSelected
  }
}

export type FlowEditorStore = ReturnType<typeof useFlowEditor>
