/** 通用响应包装 */
export interface R<T = any> {
  code: number
  msg: string
  data: T
}

/** 分页结果 */
export interface PageResult<T = any> {
  list: T[]
  total: number
  pageNum: number
  pageSize: number
}

/** 分页查询参数 */
export interface PageQuery {
  pageNum?: number
  pageSize?: number
  orderByColumn?: string
  isAsc?: 'asc' | 'desc'
  [key: string]: any
}

/** 登录用户 */
export interface UserInfo {
  userId: string
  userName: string
  nickName: string
  avatar?: string
  email?: string
  phonenumber?: string
  sex?: '0' | '1' | '2'
  status?: '0' | '1'
  deptId?: string
  deptName?: string
  createTime?: string
  roles: RoleInfo[]
  permissions: string[]
  tenantId?: string
  isSuperAdmin?: boolean
}

/** 角色 */
export interface RoleInfo {
  roleId: string
  roleName: string
  roleKey: string
  roleSort?: number
  dataScope?: DataScopeType
  status?: '0' | '1'
  menuIds?: string[]
  deptIds?: string[]
  remark?: string
  createTime?: string
}

/** 数据权限范围 */
export type DataScopeType = '1' | '2' | '3' | '4' | '5'

/** 菜单 */
export interface MenuInfo {
  id: string
  parentId: string
  name: string
  path?: string
  component?: string
  redirect?: string
  title: string
  icon?: string
  sort?: number
  type: 'M' | 'C' | 'F' | 'L'
  visible?: '0' | '1'
  status?: '0' | '1'
  isCache?: '0' | '1'
  isFrame?: '0' | '1'
  perms?: string
  query?: string
  keepAlive?: boolean
  children?: MenuInfo[]
}

/** 部门 */
export interface DeptInfo {
  deptId: string
  parentId: string
  deptName: string
  orderNum: number
  leader?: string
  phone?: string
  email?: string
  status?: '0' | '1'
  children?: DeptInfo[]
}

/** 岗位 */
export interface PostInfo {
  postId: string
  postCode: string
  postName: string
  postSort: number
  status?: '0' | '1'
  remark?: string
  createTime?: string
}

/** 字典类型 */
export interface DictType {
  dictId: string
  dictName: string
  dictType: string
  status?: '0' | '1'
  remark?: string
  createTime?: string
}

/** 字典数据 */
export interface DictData {
  dictCode: string
  dictSort: number
  dictLabel: string
  dictValue: string
  dictType: string
  listClass?: string
  isDefault?: 'Y' | 'N'
  status?: '0' | '1'
  remark?: string
}

/** 租户 */
export interface TenantInfo {
  tenantId: string
  tenantName: string
  tenantCode: string
  contactUser?: string
  contactPhone?: string
  status?: '0' | '1'
  expireTime?: string
  createTime?: string
}

/** 在线用户 */
export interface OnlineUser {
  tokenId: string
  userName: string
  ipaddr: string
  loginLocation?: string
  browser?: string
  os?: string
  loginTime?: string
}

/** 操作日志 / 登录日志 */
export interface OperLog {
  operId: string
  title: string
  businessType: number
  operName: string
  operIp: string
  operTime: string
  status: '0' | '1'
  costTime?: number
  requestMethod?: string
  operUrl?: string
  operParam?: string
  errorMsg?: string
}

export interface LoginLog {
  infoId: string
  userName: string
  ipaddr: string
  status: '0' | '1'
  msg: string
  accessTime: string
  browser?: string
  os?: string
}

/** 通知公告 */
export interface Notice {
  noticeId: string
  noticeTitle: string
  noticeType: '1' | '2'
  noticeContent?: string
  status?: '0' | '1'
  createBy?: string
  createTime?: string
}

/** 定时任务 */
export interface SysJob {
  jobId: string
  jobName: string
  jobGroup: string
  invokeTarget: string
  cronExpression: string
  misfirePolicy?: string
  concurrent?: '0' | '1'
  status?: '0' | '1'
  nextValidTime?: string
  createTime?: string
}

/** 文件记录 */
export interface SysFile {
  fileId: string
  fileName: string
  fileUrl: string
  fileSize: number
  fileType: string
  createTime?: string
}

/** 上传结果 */
export interface UploadResult {
  url: string
  name: string
  fileName?: string
  size?: number
}

/** 路由元信息 */
export interface RouteMeta {
  title: string
  icon?: string
  hidden?: boolean
  keepAlive?: boolean
  affix?: boolean
  activeMenu?: string
  breadcrumb?: boolean
  permission?: string[]
  roles?: string[]
  tenantRequired?: boolean
}

/** 下拉选项 */
export interface Option<V = string> {
  label: string
  value: V
  disabled?: boolean
  children?: Option<V>[]
  [key: string]: any
}
