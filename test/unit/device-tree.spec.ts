import { describe, expect, it } from 'vitest'
import { computed, ref } from 'vue'
import { useDeviceTree, type DeviceTreeNode } from '@/components/DeviceTree/useDeviceTree'
import { isPinyinSupported } from '@/utils/pinyin'
import type { DeviceArea, DeviceFavoriteRecord } from '@/types'

/**
 * 排序口径（需求）：偏好 → 数字开头 → 字母开头 → 其它；父节点按首字母 A-Z。
 * 这批用例全部用「字母+数字」的设备名，跟真实数据形态一致；
 * 中文名只保留一条，用来验证「其它」档垫底。
 *
 * 注意：父节点本身也是排过序的，所以断言一律「按区域名查找」，
 * 不要写死 treeData[0] —— 那样父节点排序规则一变，用例就会莫名其妙地红。
 */
function makeAreas(): DeviceArea[] {
  return [
    {
      id: 'A1',
      name: '一号车间',
      children: [
        { id: 'd1', areaId: 'A1', name: 'A9', status: 'available' },
        { id: 'd2', areaId: 'A1', name: 'A1', status: 'unavailable' },
        { id: 'd3', areaId: 'A1', name: 'A10', status: 'offline' },
        { id: 'd4', areaId: 'A1', name: '2号线', status: 'available' },
        { id: 'd5', areaId: 'A1', name: '10号机', status: 'offline' },
        { id: 'd6', areaId: 'A1', name: '1号行车', status: 'available' }
      ]
    },
    {
      id: 'A2',
      name: '二号车间',
      children: [
        { id: 'e1', areaId: 'A2', name: 'B2', status: 'available' },
        { id: 'e2', areaId: 'A2', name: 'B10', status: 'offline' },
        { id: 'e3', areaId: 'A2', name: '中央空调机组', status: 'available' }
      ]
    }
  ]
}

function build(overrides: Partial<Parameters<typeof useDeviceTree>[0]> = {}) {
  return useDeviceTree({
    areas: makeAreas(),
    favoriteIds: computed(() => new Set<string>()),
    favoriteRecords: computed<DeviceFavoriteRecord[]>(() => []),
    ...overrides
  })
}

/** 父节点名称顺序 */
function areaNames(nodes: DeviceTreeNode[]): string[] {
  return nodes.map((n) => n.name)
}

/** 指定区域下的设备名（按树里的顺序） */
function childrenOf(nodes: DeviceTreeNode[], areaName: string): string[] {
  const area = nodes.find((n) => n.name === areaName)
  expect(area, `没找到区域「${areaName}」`).toBeTruthy()
  return (area?.children ?? []).map((c) => c.name)
}

describe('useDeviceTree 父节点排序', () => {
  it('按名称首字母 A-Z 排列（中文取拼音首字母）', () => {
    if (!isPinyinSupported()) return
    // 一号车间(Y) / 二号车间(E)，按首字母应 E 在前
    expect(areaNames(build().treeData.value)).toEqual(['二号车间', '一号车间'])
  })

  it('字母开头的区域排在中文区域之前', () => {
    if (!isPinyinSupported()) return
    const areas: DeviceArea[] = [
      { id: 'X1', name: '装配区', children: [] },
      { id: 'X2', name: 'A区', children: [] },
      { id: 'X3', name: '包装区', children: [] }
    ]
    expect(areaNames(build({ areas: () => areas }).treeData.value)).toEqual([
      'A区',
      '包装区',
      '装配区'
    ])
  })

  it('sortable=false 时父节点保持后端原序', () => {
    const { treeData } = build({ sortable: () => false })
    expect(areaNames(treeData.value)).toEqual(['一号车间', '二号车间'])
  })

  it('不会就地修改传入的区域数组', () => {
    const areas = makeAreas()
    const before = areas.map((a) => a.name)
    build({ areas: () => areas })
    expect(areas.map((a) => a.name)).toEqual(before)
  })
})

describe('useDeviceTree 子节点排序', () => {
  it('数字开头在前并按数值排，字母开头在后（A9 在 A10 之前）', () => {
    expect(childrenOf(build().treeData.value, '一号车间')).toEqual([
      '1号行车',
      '2号线',
      '10号机',
      'A1',
      'A9',
      'A10'
    ])
  })

  it('每个区域各自排序，中文设备垫底', () => {
    expect(childrenOf(build().treeData.value, '二号车间')).toEqual(['B2', 'B10', '中央空调机组'])
  })

  it('不会就地修改传入的设备数组', () => {
    const areas = makeAreas()
    const before = areas[0].children!.map((d) => d.name)
    build({ areas: () => areas })
    expect(areas[0].children!.map((d) => d.name)).toEqual(before)
  })

  it('sortable=false 时子节点保持后端原序', () => {
    expect(childrenOf(build({ sortable: () => false }).treeData.value, '一号车间')).toEqual([
      'A9',
      'A1',
      'A10',
      '2号线',
      '10号机',
      '1号行车'
    ])
  })
})

describe('useDeviceTree 收藏置顶', () => {
  const favoriteIds = computed(() => new Set(['d3', 'e2']))

  it('收藏的设备被顶到所在区域最前面，且不再生成「我的偏好」节点', () => {
    const { treeData } = build({
      favoriteIds,
      favoriteRecords: computed<DeviceFavoriteRecord[]>(() => [
        { id: 'd3', name: 'A10' },
        { id: 'e2', name: 'B10' }
      ])
    })

    // 树里只有区域节点，没有任何 favorite-root
    expect(treeData.value.every((n) => n.type === 'area')).toBe(true)
    expect(childrenOf(treeData.value, '一号车间')).toEqual([
      'A10', // 收藏置顶
      '1号行车',
      '2号线',
      '10号机',
      'A1',
      'A9'
    ])
    expect(childrenOf(treeData.value, '二号车间')).toEqual(['B10', 'B2', '中央空调机组'])
  })

  it('多个收藏按名称规则相对排序，互不影响其它设备', () => {
    const { treeData } = build({ favoriteIds: computed(() => new Set(['d1', 'd5'])) })
    expect(childrenOf(treeData.value, '一号车间')).toEqual([
      '10号机', // 收藏，数字档
      'A9', // 收藏，字母档
      '1号行车',
      '2号线',
      'A1',
      'A10'
    ])
  })

  it('收藏了但设备已不存在时不再进树，但计入 missingCount', () => {
    const { treeData, missingCount, favoriteCount } = build({
      favoriteIds: computed(() => new Set(['d1', 'ghost'])),
      favoriteRecords: computed<DeviceFavoriteRecord[]>(() => [
        { id: 'd1' },
        { id: 'ghost', name: '幽灵设备' }
      ])
    })
    // 失效项没有归属区域，树里不该凭空多出一行
    expect(childrenOf(treeData.value, '一号车间').includes('幽灵设备')).toBe(false)
    expect(favoriteCount.value).toBe(1)
    expect(missingCount.value).toBe(1)
  })

  it('onlyFavorite 时区域只保留收藏设备', () => {
    const { treeData } = build({
      favoriteIds,
      favoriteRecords: computed<DeviceFavoriteRecord[]>(() => [{ id: 'd3' }, { id: 'e2' }]),
      onlyFavorite: () => true
    })
    // 父节点也排过序：二号车间(E) 在一号车间(Y) 之前
    expect(treeData.value.flatMap((a) => (a.children ?? []).map((c) => c.name))).toEqual([
      'B10',
      'A10'
    ])
  })
})

describe('useDeviceTree 首字符分组（默认关闭，仅保留能力）', () => {
  it('分组按 0-9 → A-Z → 其它，组内保持排序', () => {
    const { treeData } = build({ groupByInitial: () => true })
    const groups = treeData.value.find((n) => n.name === '一号车间')?.children ?? []
    expect(groups.map((g) => g.initial)).toEqual(['1', '2', 'A'])
    expect(groups[2].children?.map((c) => c.name)).toEqual(['A1', 'A9', 'A10'])
  })
})

describe('useDeviceTree 索引与统计', () => {
  it('deviceCount 统计全部叶子设备', () => {
    const { deviceCount, deviceIndex } = build()
    expect(deviceCount.value).toBe(9)
    expect(deviceIndex.value.get('d3')?.name).toBe('A10')
  })

  it('areas 变化时 reactive 更新', () => {
    const areas = ref<DeviceArea[]>(makeAreas())
    const { deviceCount } = build({ areas })
    expect(deviceCount.value).toBe(9)
    areas.value = [areas.value[0]]
    expect(deviceCount.value).toBe(6)
  })
})
