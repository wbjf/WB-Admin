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

/* ────────────────── 流程图（FlowEditor） ────────────────── */

/** 流程图元信息 */
export interface FlowMeta {
  id: string
  name: string
  /** 业务类型：工艺路线 / 设备布局 / 通用流程 */
  category?: 'process' | 'layout' | 'generic'
  description?: string
  /** 缩略图（dataURL），列表页用 */
  thumbnail?: string
  createdBy?: string
  updatedAt: number
  /** 服务端版本号，草稿与已发布分离 */
  version?: number
}

/** 工艺参数（recipe 名、温度、时间、气体流量…） */
export interface FlowParam {
  key: string
  value: string
  unit?: string
}

/** 节点（LogicFlow 原生字段 + 业务属性） */
export interface FlowNode {
  id: string
  /** 节点类型：'litho' | 'etch' | 'cmp' | 'decision' | 自定义 */
  type: string
  x: number
  y: number
  /** 节点显示文本 */
  text?: string
  width?: number
  height?: number
  properties: {
    /** 工序编号，如 OP-0120 */
    code?: string
    /** 备注 */
    remark?: string
    /** 绑定的设备 id（来自设备树） */
    deviceId?: string
    deviceName?: string
    /** 所属区域 / 泳道 */
    bay?: string
    /** 阶段：FEOL / BEOL / 封装 */
    stage?: string
    /** 标准节拍（分钟） */
    cycleTime?: number
    /** 良率（0~1），仿真用 */
    yield?: number
    /** 工艺参数，动态键值对 */
    params?: FlowParam[]
    /** 自定义配色 / 图标 */
    color?: string
    icon?: string
    locked?: boolean
    /** 评论数（P2 评论） */
    comments?: FlowComment[]
    [key: string]: unknown
  }
}

/** 连线 */
export interface FlowEdge {
  id: string
  type?: 'polyline' | 'line' | 'bezier'
  sourceNodeId: string
  targetNodeId: string
  /** 连线标签：OK / NG / 条件表达式 */
  text?: string
  /** 折线拐点（LogicFlow polyline） */
  pointsList?: Array<{ x: number; y: number }>
  properties: {
    /** main 主流程 / rework 返工 / scrap 报废 / material 物料流 */
    kind?: 'main' | 'rework' | 'scrap' | 'material'
    dashed?: boolean
    remark?: string
    [key: string]: unknown
  }
}

/** 泳道 / 区域框 */
export interface FlowGroupBox {
  id: string
  name: string
  x: number
  y: number
  w: number
  h: number
  color?: string
}

/** 一张完整的图（导出 / 导入的单位） */
export interface FlowGraph {
  /** 结构版本，导入时校验，不同版本走迁移 */
  schema: 1
  meta: FlowMeta
  nodes: FlowNode[]
  edges: FlowEdge[]
  /** 泳道 / 区域框 */
  groups?: FlowGroupBox[]
}

/** 版本快照 */
export interface FlowVersion {
  id: string
  flowId: string
  /** 版本号，从 1 开始递增 */
  version: number
  name: string
  remark?: string
  createdBy?: string
  createdAt: number
  graph: FlowGraph
}

/** 节点评论（E13） */
export interface FlowComment {
  id: string
  nodeId: string
  author: string
  content: string
  createdAt: number
  resolved?: boolean
}

/** 校验问题 */
export interface FlowIssue {
  /** 规则编号 */
  code: string
  /** 严重级别：error 必须改 / warn 建议改 / info 提示 */
  level: 'error' | 'warn' | 'info'
  message: string
  /** 涉及的元素，点击定位用 */
  nodeIds?: string[]
  edgeIds?: string[]
}

/** 列表项（GET /flow/list 返回） */
export interface FlowListItem {
  id: string
  name: string
  category?: FlowMeta['category']
  description?: string
  thumbnail?: string
  updatedAt: number
  version?: number
  status?: 'draft' | 'review' | 'published'
  /** 列表展示用：节点 / 连线数（列表接口由 graph 拆出来，不返回整张图） */
  nodeCount?: number
  edgeCount?: number
}
