import { http } from '@/utils/request'
import type { PageQuery, PageResult } from '@/types'

export interface PostVO {
  postId: string
  postCode: string
  postName: string
  postSort: number
  status?: '0' | '1'
  remark?: string
  createTime?: string
}

export interface PostQuery extends PageQuery {
  postCode?: string
  postName?: string
  status?: string
}

export const postApi = {
  list: (params: PostQuery) => http.get<PageResult<PostVO>>('/system/post/list', params),
  detail: (postId: string) => http.get<PostVO>(`/system/post/${postId}`),
  add: (data: Partial<PostVO>) => http.post<void>('/system/post', data),
  update: (data: Partial<PostVO>) => http.put<void>('/system/post', data),
  remove: (ids: string | string[]) =>
    http.del<void>('/system/post', { ids: Array.isArray(ids) ? ids.join(',') : ids })
}

export default postApi
