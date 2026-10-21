import type { PaletteGroup, PaletteItem, PaletteOptions, ResolvedPalette } from './types'

/* ────────────────── 内置库 ────────────────── */

const P = (
  type: string,
  label: string,
  icon: string,
  color: string,
  extra: Partial<PaletteItem> = {}
): PaletteItem => ({ type, label, icon, color, ...extra })

/** 半导体库（24 项）：工序 11 / 设备 6 / 判定 3 / 物料与辅助 4 */
export const PALETTE_SEMICONDUCTOR: PaletteGroup[] = [
  {
    name: '工序',
    items: [
      P('clean', '晶圆清洗 Clean', 'clean', '#17a2b8', { keywords: ['rca', 'wash', '清洗'] }),
      P('coater', '涂胶 Coater', 'film', '#409eff', { keywords: ['coat', 'track', '涂胶'] }),
      P('litho', '光刻 Litho', 'litho', '#7c5cff', {
        keywords: ['photo', 'scanner', 'exposure', '光刻', '曝光']
      }),
      P('develop', '显影 Develop', 'film', '#409eff', { keywords: ['dev', '显影'] }),
      P('etch', '刻蚀 Etch', 'etch', '#e6a23c', { keywords: ['etcher', '刻蚀'] }),
      P('strip', '去胶 Strip', 'etch', '#e6a23c', { keywords: ['asher', '去胶'] }),
      P('deposition', '薄膜沉积 CVD', 'film', '#409eff', {
        keywords: ['cvd', 'pvd', 'dep', '沉积']
      }),
      P('implant', '离子注入 IMP', 'implanter', '#7c5cff', { keywords: ['imp', '注入'] }),
      P('cmp', 'CMP 抛光', 'cmp', '#909399', { keywords: ['polish', '抛光'] }),
      P('furnace', '扩散炉 Furnace', 'furnace', '#409eff', { keywords: ['diffusion', '扩散'] }),
      P('metro', '量测 Metrology', 'metro', '#67c23a', { keywords: ['cd', 'sem', '量测', '测量'] })
    ]
  },
  {
    name: '设备',
    items: [
      P('eq-scanner', '光刻机 Scanner', 'litho', '#7c5cff', { keywords: ['euv', 'duv', '光刻机'] }),
      P('eq-track', 'Track 涂胶显影', 'film', '#409eff', { keywords: ['track', '涂胶显影'] }),
      P('eq-etcher', '刻蚀机 Etcher', 'etch', '#e6a23c', { keywords: ['icp', '刻蚀机'] }),
      P('eq-cmp', 'CMP 抛光机', 'cmp', '#909399', { keywords: ['cmp', '抛光机'] }),
      P('eq-furnace', '扩散炉 Furnace', 'furnace', '#409eff', { keywords: ['furnace', '扩散炉'] }),
      P('eq-metro', '量测 CD-SEM', 'metro', '#67c23a', { keywords: ['cdsem', 'sem', '量测'] })
    ]
  },
  {
    name: '判定与分支',
    items: [
      P('decision', '判定', 'decision', '#e6a23c', {
        shape: 'diamond',
        size: { width: 120, height: 88 },
        keywords: ['if', '判断', '判定']
      }),
      P('rework', '返工 Rework', 'rework', '#e6a23c', { keywords: ['rework', '返工'] }),
      P('scrap', '报废 Scrap', 'scrap', '#f56c6c', { keywords: ['scrap', '报废'] })
    ]
  },
  {
    name: '物料与辅助',
    items: [
      P('start', '开始', 'term', '#606266', {
        shape: 'round',
        keywords: ['start', 'begin', '开始']
      }),
      P('end', '结束', 'term', '#606266', { shape: 'round', keywords: ['end', 'finish', '结束'] }),
      P('lot', 'Wafer Lot', 'mat', '#909399', { keywords: ['wafer', 'lot', '批次'] }),
      P('note', '便签', 'note', '#e6a23c', {
        shape: 'note',
        size: { width: 160, height: 80 },
        keywords: ['note', 'remark', '便签', '备注']
      })
    ]
  }
]

/** 基础库（mini 档）：工序前 6 种 + 物料与辅助 */
export const PALETTE_BASIC: PaletteGroup[] = [
  {
    name: '工序',
    items: PALETTE_SEMICONDUCTOR[0].items.slice(0, 6)
  },
  { name: '物料与辅助', items: PALETTE_SEMICONDUCTOR[3].items }
]

/** 通用流程库：与业务无关的画流程图形状 */
export const PALETTE_GENERIC: PaletteGroup[] = [
  {
    name: '通用流程',
    items: [
      P('start', '开始', 'term', '#606266', { shape: 'round', keywords: ['start', '开始'] }),
      P('task', '任务', 'film', '#409eff', { keywords: ['task', 'step', '任务', '步骤'] }),
      P('decision', '判定', 'decision', '#e6a23c', { shape: 'diamond', keywords: ['if', '判定'] }),
      P('end', '结束', 'term', '#606266', { shape: 'round', keywords: ['end', '结束'] }),
      P('note', '便签', 'note', '#e6a23c', { shape: 'note', keywords: ['note', '便签'] })
    ]
  }
]

export const BUILTIN_PALETTE: Record<string, PaletteGroup[]> = {
  semiconductor: PALETTE_SEMICONDUCTOR,
  basic: PALETTE_BASIC,
  generic: PALETTE_GENERIC
}

export const PALETTE_LABELS: Record<string, string> = {
  semiconductor: '半导体库（24）',
  basic: '基础库（10）',
  generic: '通用流程（5）'
}

/* ────────────────── 解析 ────────────────── */

/**
 * 解析元件库：
 * 1. `groups` 传了就整体替换，不走内置库；
 * 2. 否则取 `preset` 内置库 → `extend`（同 type 覆盖、新 type 追加）→ 剔除 `exclude`；
 * 3. 开关缺省为 true，`draggable` 会被 readonly 强制关闭（由上层传入）。
 */
export function resolvePalette(
  options: PaletteOptions = {},
  fallbackPreset: PaletteOptions['preset'] = 'semiconductor',
  readonly = false
): ResolvedPalette {
  let groups: PaletteGroup[]

  if (options.groups?.length) {
    groups = cloneGroups(options.groups)
  } else {
    const name = options.preset || fallbackPreset || 'semiconductor'
    groups = cloneGroups(BUILTIN_PALETTE[name] || PALETTE_SEMICONDUCTOR)
    applyExtend(groups, options.extend)
  }

  if (options.exclude?.length) {
    const blocked = new Set(options.exclude)
    groups = groups
      .map((g) => ({ ...g, items: g.items.filter((it) => !blocked.has(it.type)) }))
      .filter((g) => g.items.length > 0)
  }

  const index: Record<string, PaletteItem> = {}
  groups.forEach((g) => g.items.forEach((it) => (index[it.type] = it)))

  return {
    groups,
    searchable: options.searchable ?? true,
    collapsible: options.collapsible ?? true,
    draggable: readonly ? false : (options.draggable ?? true),
    quickAdd: readonly ? false : (options.quickAdd ?? false),
    index
  }
}

/** 按 label / keywords / type 搜索（中文可直接搜「光刻」，英文搜 litho） */
export function searchPalette(items: PaletteItem[], keyword: string): PaletteItem[] {
  const kw = keyword.trim().toLowerCase()
  if (!kw) return items
  return items.filter((it) => {
    if (it.label.toLowerCase().includes(kw)) return true
    if (it.type.toLowerCase().includes(kw)) return true
    return (it.keywords || []).some((k) => String(k).toLowerCase().includes(kw))
  })
}

function cloneGroups(groups: PaletteGroup[]): PaletteGroup[] {
  return groups.map((g) => ({ ...g, items: g.items.map((it) => ({ ...it })) }))
}

/** extend：同 type 覆盖（浅合并），新 type 追加到同名的分组，没有则放第一个分组 */
function applyExtend(groups: PaletteGroup[], extend?: PaletteItem[]): void {
  if (!extend?.length) return
  extend.forEach((item) => {
    for (const g of groups) {
      const i = g.items.findIndex((it) => it.type === item.type)
      if (i > -1) {
        g.items[i] = { ...g.items[i], ...item }
        return
      }
    }
    groups[0].items.push({ ...item })
  })
}
