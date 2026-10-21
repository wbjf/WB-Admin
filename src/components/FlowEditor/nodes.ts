import {
  h,
  RectNode,
  RectNodeModel,
  DiamondNode,
  DiamondNodeModel,
  PolylineEdge,
  PolylineEdgeModel
} from '@logicflow/core'
import type LogicFlow from '@logicflow/core'
import { iconPaths } from './icons'
import { LANE_TYPE } from './serialize'
import type { PaletteItem } from './types'

/**
 * 自定义节点。
 *
 * 两条硬约束：
 * 1. **纯 SVG**（不用 HtmlNode / foreignObject）——导出 PNG / SVG 时不依赖页面 CSS；
 * 2. **一个通用节点 + 数据驱动**（颜色 / 图标 / 尺寸来自 properties），
 *    不为每种工序建一个类 —— 否则几十种工序维护成本爆炸（见 PRD 风险一节）。
 */

type Props = { color?: string; icon?: string; size?: { width: number; height: number } }

const NODE_DEFAULT_COLOR = '#409eff'

function styleOf(model: RectNodeModel): Record<string, unknown> {
  return (model.getNodeStyle?.() || {}) as Record<string, unknown>
}

/** 工序 / 设备节点：左侧色条 + 图标 + 名称 + 编号 + 设备状态点 */
class ProcessNodeView extends RectNode {
  getShape() {
    const { model } = this.props
    const { x, y, width, height, properties } = model
    const color = (properties?.color as string) || NODE_DEFAULT_COLOR
    const left = x - width / 2
    const top = y - height / 2
    const code = properties?.code as string | undefined
    const hasDevice = !!properties?.deviceId
    const iconSize = 18
    const scale = iconSize / 24
    const paths = iconPaths((properties?.icon as string) || 'default')

    return h('g', { class: 'wb-flow-node' }, [
      h('rect', {
        x: left,
        y: top,
        width,
        height,
        rx: 6,
        ry: 6,
        ...styleOf(model)
      }),
      // 左侧色条（不参与边框描边，只做类型识别）
      h('rect', { x: left, y: top + 6, width: 4, height: height - 12, rx: 2, fill: color }),
      // 图标（24×24 视口缩放到 18）
      h(
        'g',
        {
          transform: `translate(${left + 12} ${top + height / 2 - iconSize / 2}) scale(${scale})`
        },
        paths.map((d: string) =>
          h('path', {
            d,
            fill: 'none',
            stroke: color,
            strokeWidth: 1.8,
            strokeLinecap: 'round',
            strokeLinejoin: 'round'
          })
        )
      ),
      // 工序编号：底部靠右小字（文本主体已上移让位）
      code
        ? h(
            'text',
            {
              x: left + width - 8,
              y: top + height - 7,
              textAnchor: 'end',
              fontSize: 10,
              fill: '#a8abb2'
            },
            code
          )
        : null,
      // 绑定了设备：右下角状态点
      hasDevice
        ? h('circle', { cx: left + width - 8, cy: top + 8, r: 3.5, fill: '#67c23a' })
        : null,
      // 锁定标记
      properties?.locked
        ? h(
            'text',
            {
              x: left + width - 8,
              y: top + height - 7,
              textAnchor: 'end',
              fontSize: 10,
              fill: '#e6a23c'
            },
            '🔒'
          )
        : null
    ])
  }
}

/**
 * 用闭包把 palette 的默认值带进 model。
 *
 * 之前把默认值挂在 `properties.__defs` 上再在构造函数里读，踩了两个坑：
 * ① 父类构造期间就会调用 `setAttributes()`，此时子类字段还没赋值（读到 undefined）；
 * ② `__defs` 会留在 properties 里被导出，污染数据。
 * 闭包传值两个问题一起解决。
 */
function createProcessModel(defs: Props = {}) {
  return class extends RectNodeModel {
    setAttributes(): void {
      this.radius = 6
      // 宽高只有 getter，默认尺寸来自节点数据（addNode 时按 palette.size 填）
      if (this.properties) {
        if (!this.properties.color && defs.color) this.properties.color = defs.color
        if (!this.properties.icon && defs.icon) this.properties.icon = defs.icon
      }
      // 文本右移让出图标位；有编号时再上移一点
      const offsetX = 14
      const offsetY = this.properties?.code ? -6 : 0
      if (this.text) {
        this.text.x = this.x + offsetX
        this.text.y = this.y + offsetY
      }
      // 锁定后不可拖动（draggable 是普通属性，可直接赋值）
      this.draggable = !this.properties?.locked
    }
    getNodeStyle() {
      const style = super.getNodeStyle()
      const color = (this.properties?.color as string) || defs.color || NODE_DEFAULT_COLOR
      return {
        ...style,
        fill: '#ffffff',
        stroke: this.isSelected ? color : '#dcdfe6',
        strokeWidth: this.isSelected ? 2 : 1
      }
    }
  }
}

/** 未走闭包时的默认 model（降级兜底用） */
const ProcessNodeModel = createProcessModel()

/** 判定节点：菱形 */
class DecisionNodeView extends DiamondNode {
  getShape() {
    const { model } = this.props
    const { x, y, width, height } = model
    const color = (model.properties?.color as string) || '#e6a23c'
    return h('g', {}, [
      h('path', {
        d: `M${x} ${y - height / 2} L${x + width / 2} ${y} L${x} ${y + height / 2} L${x - width / 2} ${y} Z`,
        ...styleOf(model as unknown as RectNodeModel),
        fill: '#fffaf0',
        stroke: model.isSelected ? color : '#e6c79a',
        strokeWidth: model.isSelected ? 2 : 1.2
      })
    ])
  }
}

class DecisionNodeModel extends DiamondNodeModel {
  setAttributes(): void {
    // 宽高只读（只有 getter），默认尺寸由 palette.size 或节点数据里的 width/height 决定
    this.radius = 4
  }
}

/** 泳道 / 区域框：虚线大框 + 左上标题，不参与连线 */
class LaneNodeView extends RectNode {
  getShape() {
    const { model } = this.props
    const { x, y, width, height, properties } = model
    const left = x - width / 2
    const top = y - height / 2
    const color = (properties?.color as string) || '#c0c4cc'
    const name = (properties?.name as string) || ''
    return h('g', {}, [
      h('rect', {
        x: left,
        y: top,
        width,
        height,
        rx: 8,
        ry: 8,
        fill: 'rgba(64,158,255,0.04)',
        stroke: model.isSelected ? color : '#e4e7ed',
        strokeWidth: 1,
        strokeDasharray: '6 4'
      }),
      h('text', { x: left + 12, y: top + 22, fontSize: 12, fill: '#909399', fontWeight: 500 }, name)
    ])
  }
  /** 标题自己画，不渲染内置文本，避免重复 */
  getText() {
    return null
  }
}

class LaneNodeModel extends RectNodeModel {
  setAttributes(): void {
    this.radius = 8
    this.zIndex = 0
    this.draggable = true
  }
  getNodeStyle() {
    return { fill: 'transparent', stroke: '#e4e7ed', strokeWidth: 1 }
  }
  /** 泳道不提供连线锚点 */
  getDefaultAnchor() {
    return []
  }
}

/** 连线：按 kind 上色（返工虚线橙、报废红、物料灰） */
export const FLOW_EDGE_TYPE = 'flow-edge'

const EDGE_KIND_COLOR: Record<string, { stroke: string; dash?: string }> = {
  main: { stroke: '#909399' },
  rework: { stroke: '#e6a23c', dash: '6 4' },
  scrap: { stroke: '#f56c6c', dash: '6 4' },
  material: { stroke: '#409eff', dash: '2 3' }
}

class FlowEdgeModel extends PolylineEdgeModel {
  getEdgeStyle() {
    const style = super.getEdgeStyle()
    const kind = (this.properties?.kind as string) || 'main'
    const preset = EDGE_KIND_COLOR[kind] || EDGE_KIND_COLOR.main
    return {
      ...style,
      stroke: this.isSelected ? 'var(--el-color-primary, #409eff)' : preset.stroke,
      strokeWidth: this.isSelected ? 2.5 : 1.6,
      strokeDasharray: preset.dash
    }
  }
  getTextStyle() {
    const style = super.getTextStyle()
    return { ...style, fontSize: 12, fill: '#606266' }
  }
}

/**
 * 按解析后的元件库注册节点。
 * 关键：只在 palette 里的 type 才注册（5.4.4-1），不在库里的类型交给 serialize 降级。
 */
export function registerNodes(lf: LogicFlow, index: Record<string, PaletteItem>): void {
  Object.values(index).forEach((item) => {
    if (item.shape === 'diamond') {
      lf.register({ type: item.type, view: DecisionNodeView, model: DecisionNodeModel })
      return
    }
    const defs: Props = {
      color: item.color,
      icon: typeof item.icon === 'string' ? item.icon : 'default',
      size: item.size
    }
    // 同一套 view，model 由闭包带上该 type 的默认值
    lf.register({ type: item.type, view: ProcessNodeView, model: createProcessModel(defs) })
  })

  // 降级用的默认矩形（导入未知类型时兜底）
  if (!index['task']) {
    lf.register({ type: 'task', view: ProcessNodeView, model: ProcessNodeModel })
  }

  // 泳道
  lf.register({ type: LANE_TYPE, view: LaneNodeView, model: LaneNodeModel })

  // 连线
  lf.register({ type: FLOW_EDGE_TYPE, view: PolylineEdge, model: FlowEdgeModel })
}

export {
  ProcessNodeView,
  ProcessNodeModel,
  DecisionNodeView,
  DecisionNodeModel,
  LaneNodeView,
  LaneNodeModel
}
