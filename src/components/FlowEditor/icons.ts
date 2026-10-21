/**
 * 内置图标：纯 SVG path（24×24 视口，stroke 渲染、fill 为 none）。
 *
 * 为什么不用图标库 / 不用 Vue 节点：节点要能被 Snapshot 导出成 PNG / SVG，
 * 走 foreignObject 会依赖页面 CSS（见 PRD「风险」一节），
 * 所以节点内部一律用 SVG path 画，导出零依赖。
 */
export const ICON_PATHS: Record<string, string[]> = {
  // 光刻机：机身 + 镜头 + 底座
  litho: ['M3 4h18v11H3z', 'M13 8.5a3.5 3.5 0 1 0 .1 0', 'M7 19h10'],
  // 刻蚀：梯形腔体 + 气流
  etch: ['M5 4h14l-3 6 3 6H5l3-6z', 'M12 9v11'],
  // 薄膜沉积：层叠
  film: ['M4 6h16v12H4z', 'M4 11h16'],
  // 量测：圆 + 十字
  metro: ['M12 3a9 9 0 1 0 .1 0', 'M12 12l5-5', 'M12 12v6'],
  // 清洗：水滴
  clean: ['M12 3s6 6.5 6 10a6 6 0 1 1-12 0c0-3.5 6-10 6-10z'],
  // CMP：同心椭圆
  cmp: ['M3.5 12a8.5 4.5 0 1 0 .1 0', 'M8 12a4 2 0 1 0 .1 0'],
  // 判定：菱形
  decision: ['M12 3l9 9-9 9-9-9z'],
  // 起止：圆角矩形
  term: ['M5 6h14a4 4 0 0 1 0 12H5a4 4 0 0 1 0-12z'],
  // 物料：矩形 + 线
  mat: ['M7 3h10v18H7z', 'M7 8h10', 'M7 12h10'],
  // 便签
  note: ['M4 4h16v16H4z', 'M7 9h10', 'M7 13h7'],
  // 扩散炉：圆柱
  furnace: ['M5 5h14v14H5z', 'M5 9h14', 'M5 15h14'],
  // 离子注入
  implanter: ['M12 3v12', 'M8 15l4 6 4-6', 'M5 6h14'],
  // 返工：循环箭头
  rework: ['M20 12a8 8 0 1 1-2.3-5.6', 'M20 4v5h-5'],
  // 报废：叉
  scrap: ['M6 6l12 12', 'M18 6L6 18'],
  // 默认
  default: ['M4 5h16v14H4z']
}

export const ICON_KEYS = Object.keys(ICON_PATHS)

/** 取图标，未知 key 回落到 default */
export function iconPaths(key?: string): string[] {
  return ICON_PATHS[key || 'default'] || ICON_PATHS.default
}

/** 左侧面板用的内联 svg（HTML 场景，如元件库卡片与图例） */
export function iconSvg(key?: string, color = 'currentColor', size = 18): string {
  const paths = iconPaths(key)
    .map(
      (d) =>
        `<path d="${d}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round"/>`
    )
    .join('')
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}">${paths}</svg>`
}
