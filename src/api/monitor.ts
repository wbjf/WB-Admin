import { http } from '@/utils/request'
import type { OnlineUser } from '@/types'
import type { PageQuery, PageResult } from '@/types'

export const onlineApi = {
  list: (params: PageQuery) => http.get<PageResult<OnlineUser>>('/monitor/online/list', params),
  kick: (tokenId: string) => http.del<void>(`/monitor/online/${tokenId}`)
}

export const operlogApi = {
  list: (params: PageQuery) => http.get<PageResult<any>>('/monitor/operlog/list', params),
  detail: (operId: string) => http.get<any>(`/monitor/operlog/${operId}`),
  remove: (ids: string | string[]) =>
    http.del<void>('/monitor/operlog', { ids: Array.isArray(ids) ? ids.join(',') : ids }),
  clean: () => http.del<void>('/monitor/operlog/clean')
}

export const loginlogApi = {
  list: (params: PageQuery) => http.get<PageResult<any>>('/monitor/logininfor/list', params),
  remove: (ids: string | string[]) =>
    http.del<void>('/monitor/logininfor', { ids: Array.isArray(ids) ? ids.join(',') : ids }),
  clean: () => http.del<void>('/monitor/logininfor/clean'),
  unlock: (userName: string) => http.get<void>('/monitor/logininfor/unlock', { userName })
}

export interface ServerInfo {
  cpu: { used: number; sys: number; user: number; wait: number; free: number }
  mem: { total: number; used: number; free: number; usage: number }
  disks: { path: string; total: string; free: string; used: string; usage: number }[]
  jvm: { name: string; version: string; home: string; startTime: string; runTime: string; used: number; usage: number }
  sys: { computerName: string; osName: string; computerIp: string; osArch: string; userDir: string }
}

export const serverApi = {
  monitor: () => http.get<ServerInfo>('/monitor/server'),
  cache: () => http.get<{ commandStats: { name: string; value: string }[]; info: Record<string, any>; dbSize: number }>('/monitor/cache')
}
