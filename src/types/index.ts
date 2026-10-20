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

/**
 * 设备在线状态。
 * 用字面量联合而不是 0/1/2 —— 渲染层直接用它拼 CSS class，
 * 数字状态码在模板里必须再翻译一遍，容易漏改。
 */
export type DeviceStatus = 'available' | 'unavailable' | 'offline'

/** 区域：设备树的父节点 */
export interface DeviceArea {
  id: string
  name: string
  code?: string
  children?: DeviceItem[]
  [key: string]: any
}

/** 设备：设备树的叶子节点 */
export interface DeviceItem {
  id: string
  /** 所属区域 id */
  areaId: string
  name: string
  status: DeviceStatus
  /** 设备类型，如「空调」「摄像头」 */
  category?: string
  updateTime?: string
  [key: string]: any
}

/**
 * 一条偏好（收藏）记录。
 *
 * 除了主键还留一份 `name` 快照——设备被删掉 / 换权限看不到时，
 * 收藏项不能凭空消失（用户会以为是 bug），要能显示成「已失效」并允许手动移除。
 */
export interface DeviceFavoriteRecord {
  id: string
  name?: string
  areaId?: string
  addedAt?: number
}

/* -------------------------------------------------------------------------- */
/*                                AI 会话                                      */
/* -------------------------------------------------------------------------- */

export type ChatRole = 'user' | 'assistant'

/** 可切换的语言模型 */
export interface AiModel {
  id: string
  name: string
  /** 厂商 / 提供方，用于在下拉里分组展示 */
  provider?: string
  /** 上下文窗口（token） */
  context?: number
  desc?: string
  disabled?: boolean
}

/** 随消息一起发送的附件 */
export interface ChatAttachment {
  /** 前端本地唯一 id，用于列表 key 与移除 */
  uid: string
  name: string
  size: number
  /** MIME 类型，图标展示用 */
  type: string
  /** 原始文件对象。只在内存中存在，不参与持久化 */
  file?: File
  /** 已上传后的地址（走真实后端时回填） */
  url?: string
}

/** 一条对话消息 */
export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  /** 助手消息所用的模型 id */
  model?: string
  attachments?: ChatAttachment[]
  /** 时间戳（ms） */
  time: number
  /** 流式输出中 */
  pending?: boolean
  /** 本条生成失败 */
  error?: boolean
}

/** 会话分组（类似「项目 / 文件夹」）。未分组不是一条记录，用 groupId: '' 表示 */
export interface ChatGroup {
  id: string
  name: string
  /** 收起状态也持久化，否者每次打开面板都重新展开 */
  collapsed?: boolean
  createdAt: number
}

/** 一个独立会话：各自持有消息、模型与归属分组 */
export interface ChatSession {
  id: string
  /** 标题，由首条用户消息截断生成，也可手动重命名；空串表示「新对话」 */
  title: string
  /** '' = 未分组 */
  groupId: string
  messages: ChatMessage[]
  /** 该会话上次使用的模型 */
  model?: string
  createdAt: number
  /** 最近一次发送时间，列表按它倒序 */
  updatedAt: number
}

export interface AiChatRequest {
  model: string
  /** 只传纯文本历史，附件单独走 files —— 避免把 File 塞进 JSON */
  messages: { role: ChatRole; content: string }[]
  files?: ChatAttachment[]
  /** 界面语言，供 mock / 后端决定回复语种 */
  locale?: string
  signal?: AbortSignal
}

export interface AiChatHandlers {
  /** 流式增量 */
  onDelta(chunk: string): void
  onError?(err: unknown): void
}

/**
 * 传输层：把「怎么拿到模型列表 / 怎么拿到回答」跟界面彻底解耦。
 * 默认实现是纯前端模拟（不依赖任何后端，静态部署也能演示），
 * 接真实服务时 `configureAiTransport(createHttpTransport())` 换掉即可。
 */
export interface AiChatTransport {
  listModels(): Promise<AiModel[]>
  /** 完成后 resolve；被 abort 时应当直接结束（不 reject） */
  chat(req: AiChatRequest, handlers: AiChatHandlers): Promise<void>
}
