import { http } from '@/utils/request'
import { toArray } from '@/utils'
import type { DeviceArea, DeviceItem } from '@/types'

/**
 * 区域 → 设备 两级树。
 *
 * 注意这里刻意返回 `DeviceArea[]`（带 children 的嵌套结构）而不是扁平列表：
 * 树形数据在 api 层就应该定好型，别把「要不要 buildTree」的选择丢给每个调用方。
 */
export const deviceApi = {
  /** 区域树（含每个区域的设备列表） */
  areaTree: (): Promise<DeviceArea[]> => http.get<DeviceArea[]>('/device/area/tree'),
  /**
   * 安全版：后端可能返回 `{rows:[]}` 而不是纯数组。
   * toArray 归一一层，防止详情页这种不分页的接口在换后端后整页崩。
   */
  areaTreeSafe: async (): Promise<DeviceArea[]> =>
    toArray<DeviceArea>(await http.get<unknown>('/device/area/tree')),
  /** 单个设备（刷新状态用） */
  detail: (deviceId: string): Promise<DeviceItem> => http.get<DeviceItem>(`/device/${deviceId}`)
}
