import { computed, toValue, type MaybeRefOrGetter, type Ref } from 'vue'
import { compareDeviceName, deviceGroupKey, groupWeight } from '@/utils/device-sort'
import type { DeviceArea, DeviceFavoriteRecord, DeviceItem, DeviceStatus } from '@/types'

/**
 * 设备状态元信息。
 * 圆点颜色、文案口径集中一处定义：绿 = 可用 / 黄 = 不可用 / 灰 = 未连接。
 * 各页面不要自己再写一遍色值，否则改主题时必然漏改某一处。
 */
export const DEVICE_STATUS_META: Record<DeviceStatus, { i18nKey: string; cssVar: string }> = {
  available: { i18nKey: 'device.statusAvailable', cssVar: 'var(--el-color-success)' },
  unavailable: { i18nKey: 'device.statusUnavailable', cssVar: 'var(--el-color-warning)' },
  offline: { i18nKey: 'device.statusOffline', cssVar: 'var(--el-color-info)' }
}

export type DeviceTreeNodeType = 'area' | 'initial-group' | 'device'

export interface DeviceTreeNode {
  /** 树节点唯一键 */
  key: string
  type: DeviceTreeNodeType
  name: string
  children?: DeviceTreeNode[]
  /** 仅叶子节点有值 */
  device?: DeviceItem
  areaId?: string
  /** 分组标记，仅 initial-group / device 有值 */
  initial?: string
  status?: DeviceStatus
  /** 该节点下的设备总数 */
  total?: number
  /** 收藏了但原树里已经找不到的设备 */
  missing?: boolean
}

export interface UseDeviceTreeOptions {
  /** 后端来的区域树 */
  areas: MaybeRefOrGetter<DeviceArea[]>
  /** 是否由组件接管排序（关闭则用后端顺序） */
  sortable?: MaybeRefOrGetter<boolean>
  /** 区域内是否再按首字符插入一层分组节点 */
  groupByInitial?: MaybeRefOrGetter<boolean>
  /** 偏好（收藏）id 集合：收藏项要置顶 */
  favoriteIds?: MaybeRefOrGetter<Set<string>>
  /** 偏好记录：只用来算「已失效」数量，不再生成独立节点 */
  favoriteRecords?: MaybeRefOrGetter<DeviceFavoriteRecord[]>
  /** 是否过滤掉非收藏设备 */
  onlyFavorite?: MaybeRefOrGetter<boolean>
}

/**
 * 排序：收藏 → 数字开头 → 字母开头 → 其它。
 *
 * 一定要先复制再 sort：直接 sort 原数组会就地修改后端数据，
 * 下一次重算时「已经排过序」的事实会掩盖掉排序本身失效的 bug。
 */
function sortDevices(list: DeviceItem[], favoriteIds: Set<string>): DeviceItem[] {
  const arr = [...list]
  arr.sort((a, b) => {
    const fa = favoriteIds.has(String(a?.id)) ? 0 : 1
    const fb = favoriteIds.has(String(b?.id)) ? 0 : 1
    if (fa !== fb) return fa - fb
    return compareDeviceName(a?.name, b?.name)
  })
  return arr
}

function toDeviceNode(device: DeviceItem): DeviceTreeNode {
  return {
    key: String(device.id),
    type: 'device',
    name: device.name ?? '',
    device,
    areaId: device.areaId,
    status: device.status,
    initial: deviceGroupKey(device.name)
  }
}

/**
 * 把一组已排好序的设备切成「分组 → 设备」的二级结构。
 * 分组之间按 0-9 → A-Z → 其它，组内保持传入顺序（收藏项因此仍在本组最前）。
 */
function groupByLetter(devices: DeviceItem[], areaKey: string): DeviceTreeNode[] {
  const buckets = new Map<string, DeviceItem[]>()
  devices.forEach((d) => {
    const key = deviceGroupKey(d.name)
    const list = buckets.get(key)
    if (list) list.push(d)
    else buckets.set(key, [d])
  })
  return Array.from(buckets.entries())
    .sort((a, b) => (groupWeight(a[0]) < groupWeight(b[0]) ? -1 : 1))
    .map(([key, list]) => ({
      key: `${areaKey}::${key}`,
      type: 'initial-group' as const,
      name: key,
      initial: key,
      areaId: areaKey,
      total: list.length,
      children: list.map(toDeviceNode)
    }))
}

export interface DeviceTreeResult {
  /** 直接喂给 el-tree 的数据 */
  treeData: Ref<DeviceTreeNode[]>
  /** id → 设备的索引，失效判断要靠它 */
  deviceIndex: Ref<Map<string, DeviceItem>>
  /** 设备总数（不含分组 / 区域节点） */
  deviceCount: Ref<number>
  /** 收藏且在树里真实存在的数量 */
  favoriteCount: Ref<number>
  /** 失效收藏数量 */
  missingCount: Ref<number>
}

/**
 * 区域 / 设备两级树的编排层：排序、分组、收藏置顶都在这一步完成，
 * 组件只负责渲染，不再掺数据逻辑。
 */
export function useDeviceTree(options: UseDeviceTreeOptions): DeviceTreeResult {
  const sortable = computed(() => toValue(options.sortable) !== false)
  const groupInitial = computed(() => toValue(options.groupByInitial) === true)
  const favoriteIds = computed<Set<string>>(() => toValue(options.favoriteIds) ?? new Set())
  const favoriteRecords = computed<DeviceFavoriteRecord[]>(
    () => toValue(options.favoriteRecords) ?? []
  )
  const onlyFavorite = computed(() => toValue(options.onlyFavorite) === true)

  /** 扁平索引：失效判断要靠它 */
  const deviceIndex = computed(() => {
    const map = new Map<string, DeviceItem>()
    const areas = toValue(options.areas) ?? []
    areas.forEach((area) => {
      ;(area?.children ?? []).forEach((device) => {
        if (device?.id) map.set(String(device.id), device)
      })
    })
    return map
  })

  const deviceCount = computed(() => deviceIndex.value.size)

  /**
   * 父节点（区域）同样要排：按名称首字母 A-Z。
   * 复用设备的比较器——中文区域名取拼音首字母，正好就是 A-Z；
   * 数字开头的区域会排在字母之前，与设备侧口径保持一致。
   */
  const sortedAreas = computed(() => {
    const areas = toValue(options.areas) ?? []
    return sortable.value
      ? [...areas].sort((a, b) => compareDeviceName(a?.name, b?.name))
      : [...areas]
  })

  const treeData = computed<DeviceTreeNode[]>(() => {
    const areas = sortedAreas.value
    const useGroup = groupInitial.value

    return areas.map((area) => {
      const raw = area?.children ?? []
      const devices = sortable.value ? sortDevices(raw, favoriteIds.value) : [...raw]
      // 只看收藏时，连空区域都能早一点剔除，避免展示一堆空的父节点
      const visible = onlyFavorite.value
        ? devices.filter((d) => favoriteIds.value.has(String(d.id)))
        : devices

      return {
        key: String(area.id),
        type: 'area' as const,
        name: area.name ?? '',
        areaId: String(area.id),
        total: visible.length,
        children: useGroup ? groupByLetter(visible, String(area.id)) : visible.map(toDeviceNode)
      }
    })
  })

  const favoriteCount = computed(() => {
    let n = 0
    favoriteIds.value.forEach((id) => {
      if (deviceIndex.value.has(id)) n += 1
    })
    return n
  })

  const missingCount = computed(
    () => favoriteRecords.value.filter((r) => !deviceIndex.value.has(r.id)).length
  )

  return {
    treeData,
    deviceIndex,
    deviceCount,
    favoriteCount,
    missingCount
  }
}
