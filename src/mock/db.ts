import Mock from 'mockjs'

const { Random } = Mock

/** 内存数据源：mock 环境下的“数据库” */
export const db = {
  users: [] as any[],
  roles: [] as any[],
  menus: [] as any[],
  depts: [] as any[],
  posts: [] as any[],
  dictTypes: [] as any[],
  dictData: [] as any[],
  configs: [] as any[],
  notices: [] as any[],
  tenants: [] as any[],
  online: [] as any[],
  operlogs: [] as any[],
  loginlogs: [] as any[],
  jobs: [] as any[],
  jobLogs: [] as any[],
  files: [] as any[],
  genTables: [] as any[],
  demos: [] as any[]
}

function id(i: number = 0, prefix = ''): string {
  return `${prefix}${i + 1}`
}

export function seed(): void {
  // 部门
  db.depts = [
    { deptId: '100', parentId: '0', deptName: 'WB 科技', orderNum: 1, leader: '吴总', phone: '13800000000', email: 'wb@example.com', status: '0' },
    { deptId: '101', parentId: '100', deptName: '研发中心', orderNum: 1, leader: '张伟', phone: '13800000001', status: '0' },
    { deptId: '102', parentId: '101', deptName: '前端组', orderNum: 1, leader: '李娜', status: '0' },
    { deptId: '103', parentId: '101', deptName: '后端组', orderNum: 2, leader: '王强', status: '0' },
    { deptId: '104', parentId: '100', deptName: '市场部', orderNum: 2, leader: '赵敏', status: '0' },
    { deptId: '105', parentId: '100', deptName: '财务部', orderNum: 3, leader: '孙丽', status: '1' }
  ]

  // 岗位
  db.posts = [
    { postId: '1', postCode: 'ceo', postName: '首席执行官', postSort: 1, status: '0' },
    { postId: '2', postCode: 'fe', postName: '前端工程师', postSort: 2, status: '0' },
    { postId: '3', postCode: 'be', postName: '后端工程师', postSort: 3, status: '0' },
    { postId: '4', postCode: 'pm', postName: '产品经理', postSort: 4, status: '0' }
  ]

  // 角色
  db.roles = [
    { roleId: '1', roleName: '超级管理员', roleKey: 'admin', roleSort: 1, dataScope: '1', status: '0', remark: '拥有全部权限' },
    { roleId: '2', roleName: '普通角色', roleKey: 'common', roleSort: 2, dataScope: '2', status: '0' },
    { roleId: '3', roleName: '只读角色', roleKey: 'readonly', roleSort: 3, dataScope: '5', status: '0' }
  ]

  // 用户
  db.users = Array.from({ length: 38 }).map((_, i) => {
    const name = i === 0 ? 'admin' : `wbuser${i}`
    const nick = i === 0 ? '超级管理员' : Random.cname()
    const dept = db.depts[(i % 4) + 1]
    return {
      userId: id(i, 'U'),
      userName: name,
      nickName: nick,
      password: '',
      email: `${name}@example.com`,
      phonenumber: /^1[3-9]\d{9}$/.test(Random.string('number', 11)) ? Random.string('number', 11) : '13800000000',
      sex: String(i % 3),
      status: i % 9 === 8 ? '1' : '0',
      deptId: dept.deptId,
      deptName: dept.deptName,
      avatar: '',
      remark: i % 4 === 0 ? '由 mock 生成' : '',
      createTime: Random.datetime('yyyy-MM-dd HH:mm:ss'),
      roles: i === 0 ? [db.roles[0]] : [db.roles[i % 2 === 0 ? 1 : 2]],
      postIds: [],
      roleIds: i === 0 ? ['1'] : [String((i % 2) + 2)]
    }
  })

  // 菜单
  db.menus = buildMenus()

  // 字典
  db.dictTypes = [
    { dictId: '1', dictName: '用户性别', dictType: 'sys_user_sex', status: '0', remark: '用户性别列表' },
    { dictId: '2', dictName: '菜单状态', dictType: 'sys_show_hide', status: '0' },
    { dictId: '3', dictName: '系统开关', dictType: 'sys_normal_disable', status: '0' },
    { dictId: '4', dictName: '任务状态', dictType: 'sys_job_status', status: '0' },
    { dictId: '5', dictName: '系统是否', dictType: 'sys_yes_no', status: '0' },
    { dictId: '6', dictName: '商品分类', dictType: 'demo_category', status: '0' }
  ]

  db.dictData = [
    ...dict('sys_user_sex', [['0', '男'], ['1', '女'], ['2', '未知']]),
    ...dict('sys_show_hide', [['0', '显示', 'success'], ['1', '隐藏', 'danger']]),
    ...dict('sys_normal_disable', [['0', '正常', 'success'], ['1', '停用', 'danger']]),
    ...dict('sys_job_status', [['0', '正常', 'success'], ['1', '暂停', 'danger']]),
    ...dict('sys_yes_no', [['Y', '是', 'primary'], ['N', '否', 'info']]),
    ...dict('demo_category', [['1', '数码', 'primary'], ['2', '家居', 'success'], ['3', '食品', 'warning'], ['4', '图书', 'info']])
  ]

  // 参数配置
  db.configs = [
    { configId: '1', configName: '用户初始密码', configKey: 'sys.user.initPassword', configValue: '123456', configType: 'Y' },
    { configId: '2', configName: '侧边栏主题', configKey: 'sys.index.sideTheme', configValue: 'theme-dark', configType: 'Y' },
    { configId: '3', configName: '验证码开关', configKey: 'sys.account.captchaEnabled', configValue: 'true', configType: 'N' }
  ]

  // 公告
  db.notices = Array.from({ length: 8 }).map((_, i) => ({
    noticeId: id(i, 'N'),
    noticeTitle: i % 2 === 0 ? `关于系统升级的通知 #${i + 1}` : `新功能上线公告 #${i + 1}`,
    noticeType: i % 2 === 0 ? '2' : '1',
    noticeContent: Random.cparagraph(2, 4),
    status: '0',
    createBy: 'admin',
    createTime: Random.datetime('yyyy-MM-dd HH:mm:ss')
  }))

  // 租户
  db.tenants = [
    { tenantId: '000000', tenantName: '默认租户', tenantCode: 'default', contactUser: '吴先生', contactPhone: '13800000000', status: '0', expireTime: '2099-12-31', createTime: '2026-01-01 00:00:00' },
    { tenantId: '000001', tenantName: '蓝海科技', tenantCode: 'lanhai', contactUser: '张伟', contactPhone: '13900000001', status: '0', expireTime: '2027-06-30', createTime: '2026-03-01 10:00:00' },
    { tenantId: '000002', tenantName: '星辰物流', tenantCode: 'xingchen', contactUser: '李娜', contactPhone: '13900000002', status: '1', expireTime: '2026-02-01', createTime: '2026-04-11 09:20:00' }
  ]

  // 在线用户
  db.online = db.users.slice(0, 6).map((u, i) => ({
    tokenId: Random.guid().slice(0, 24),
    userName: u.userName,
    ipaddr: Random.ip(),
    loginLocation: Random.city(),
    browser: Random.pick(['Chrome 131', 'Edge 130', 'Firefox 133']),
    os: Random.pick(['Windows 11', 'macOS 15', 'Ubuntu 24.04']),
    loginTime: Random.datetime('yyyy-MM-dd HH:mm:ss')
  }))

  // 日志
  db.operlogs = Array.from({ length: 46 }).map((_, i) => ({
    operId: id(i, 'O'),
    title: Random.pick(['用户管理', '角色管理', '菜单管理', '字典管理', '参数设置']),
    businessType: i % 6,
    operName: i % 5 === 0 ? 'admin' : 'wbuser1',
    operIp: Random.ip(),
    operTime: Random.datetime('yyyy-MM-dd HH:mm:ss'),
    status: i % 11 === 0 ? '1' : '0',
    costTime: Random.integer(5, 900),
    requestMethod: Random.pick(['POST', 'PUT', 'DELETE', 'GET']),
    operUrl: `/api/system/${Random.pick(['user', 'role', 'menu', 'dict'])}`,
    operParam: JSON.stringify({ pageNum: 1, pageSize: 10 }),
    errorMsg: i % 11 === 0 ? 'java.lang.RuntimeException: mock error' : ''
  }))

  db.loginlogs = Array.from({ length: 32 }).map((_, i) => ({
    infoId: id(i, 'L'),
    userName: i % 4 === 0 ? 'admin' : `wbuser${i % 6}`,
    ipaddr: Random.ip(),
    status: i % 7 === 0 ? '1' : '0',
    msg: i % 7 === 0 ? '密码错误' : '登录成功',
    accessTime: Random.datetime('yyyy-MM-dd HH:mm:ss'),
    browser: 'Chrome',
    os: 'Windows 11'
  }))

  db.jobs = Array.from({ length: 6 }).map((_, i) => ({
    jobId: id(i, 'J'),
    jobName: Random.pick(['同步用户数据', '清理过期会话', '生成日报']),
    jobGroup: Random.pick(['DEFAULT', 'SYSTEM']),
    invokeTarget: 'wbTask.wbParams("system")',
    cronExpression: Random.pick(['0 0/10 * * * ?', '0 0 1 * * ?', '0 30 6 * * ?']),
    misfirePolicy: '1',
    concurrent: i % 2 === 0 ? '1' : '0',
    status: i % 4 === 0 ? '1' : '0',
    nextValidTime: Random.datetime('yyyy-MM-dd HH:mm:ss'),
    createTime: Random.datetime('yyyy-MM-dd HH:mm:ss')
  }))

  db.jobLogs = Array.from({ length: 12 }).map((_, i) => ({
    jobLogId: id(i, 'JL'),
    jobName: db.jobs[i % db.jobs.length].jobName,
    invokeTarget: db.jobs[i % db.jobs.length].invokeTarget,
    status: i % 8 === 0 ? '1' : '0',
    createTime: Random.datetime('yyyy-MM-dd HH:mm:ss'),
    costTime: Random.integer(20, 4000)
  }))

  db.files = Array.from({ length: 14 }).map((_, i) => ({
    fileId: id(i, 'F'),
    fileName: `${Random.word(4, 8)}-${i + 1}.${Random.pick(['png', 'xlsx', 'pdf', 'docx'])}`,
    fileUrl: `https://example.com/files/${i + 1}`,
    fileSize: Random.integer(1024, 5_242_880),
    fileType: Random.pick(['image/png', 'application/pdf', 'application/vnd.ms-excel']),
    createTime: Random.datetime('yyyy-MM-dd HH:mm:ss')
  }))

  db.genTables = [
    { tableId: '1', tableName: 'sys_user', tableComment: '用户信息表', createTime: '2026-01-01 00:00:00' },
    { tableId: '2', tableName: 'sys_order', tableComment: '订单表', createTime: '2026-01-02 00:00:00' },
    { tableId: '3', tableName: 'sys_goods', tableComment: '商品表', createTime: '2026-01-03 00:00:00' }
  ]

  db.demos = Array.from({ length: 56 }).map((_, i) => ({
    id: id(i, 'D'),
    name: `${Random.pick(['机械键盘', '人体工学椅', '显示器', '扩展坞', '无线鼠标'])}-${i + 1}`,
    category: String((i % 4) + 1),
    price: Random.integer(39, 4999),
    stock: Random.integer(0, 999),
    status: i % 7 === 0 ? '1' : '0',
    tags: [Random.pick(['热销', '新品', '清仓'])],
    cover: '',
    remark: Random.sentence(6, 14),
    createTime: Random.datetime('yyyy-MM-dd HH:mm:ss')
  }))
}

function dict(type: string, items: [string, string, string?][]): any[] {
  return items.map(([value, label, cls], i) => ({
    dictCode: `${type}-${i + 1}`,
    dictSort: i + 1,
    dictLabel: label,
    dictValue: value,
    dictType: type,
    listClass: cls ?? 'primary',
    isDefault: i === 0 ? 'Y' : 'N',
    status: '0'
  }))
}

export function buildMenus(): any[] {
  return [
    {
      id: '1', parentId: '0', name: 'System', title: '系统管理', icon: 'Setting', type: 'M',
      path: '/system', component: 'Layout', visible: '0', sort: 1, children: [
        { id: '11', parentId: '1', name: 'User', title: '用户管理', icon: 'User', type: 'C', path: 'user', component: 'system/user/index', perms: 'system:user:list', visible: '0', isCache: '0' },
        { id: '12', parentId: '1', name: 'Role', title: '角色管理', icon: 'UserFilled', type: 'C', path: 'role', component: 'system/role/index', perms: 'system:role:list', visible: '0' },
        { id: '13', parentId: '1', name: 'Menu', title: '菜单管理', icon: 'Menu', type: 'C', path: 'menu', component: 'system/menu/index', perms: 'system:menu:list', visible: '0' },
        { id: '14', parentId: '1', name: 'Dept', title: '部门管理', icon: 'OfficeBuilding', type: 'C', path: 'dept', component: 'system/dept/index', perms: 'system:dept:list', visible: '0' },
        { id: '15', parentId: '1', name: 'Post', title: '岗位管理', icon: 'Postcard', type: 'C', path: 'post', component: 'system/post/index', perms: 'system:post:list', visible: '0' },
        { id: '16', parentId: '1', name: 'Dict', title: '字典管理', icon: 'Collection', type: 'C', path: 'dict', component: 'system/dict/index', perms: 'system:dict:list', visible: '0' },
        { id: '17', parentId: '1', name: 'Config', title: '参数设置', icon: 'Tools', type: 'C', path: 'config', component: 'system/config/index', perms: 'system:config:list', visible: '0' },
        { id: '18', parentId: '1', name: 'Notice', title: '通知公告', icon: 'Bell', type: 'C', path: 'notice', component: 'system/notice/index', perms: 'system:notice:list', visible: '0' },
        { id: '19', parentId: '1', name: 'Tenant', title: '租户管理', icon: 'Coin', type: 'C', path: 'tenant', component: 'system/tenant/index', perms: 'system:tenant:list', visible: '0' }
      ]
    },
    {
      id: '2', parentId: '0', name: 'Monitor', title: '系统监控', icon: 'Monitor', type: 'M',
      path: '/monitor', component: 'Layout', visible: '0', sort: 2, children: [
        { id: '21', parentId: '2', name: 'Online', title: '在线用户', icon: 'Connection', type: 'C', path: 'online', component: 'monitor/online/index', perms: 'monitor:online:list', visible: '0' },
        { id: '22', parentId: '2', name: 'Operlog', title: '操作日志', icon: 'Document', type: 'C', path: 'operlog', component: 'monitor/operlog/index', perms: 'monitor:operlog:list', visible: '0' },
        { id: '23', parentId: '2', name: 'Loginlog', title: '登录日志', icon: 'Tickets', type: 'C', path: 'loginlog', component: 'monitor/loginlog/index', perms: 'monitor:loginlog:list', visible: '0' },
        { id: '24', parentId: '2', name: 'Server', title: '服务监控', icon: 'Cpu', type: 'C', path: 'server', component: 'monitor/server/index', perms: 'monitor:server:list', visible: '0' },
        { id: '25', parentId: '2', name: 'Cache', title: '缓存监控', icon: 'Coin', type: 'C', path: 'cache', component: 'monitor/cache/index', perms: 'monitor:cache:list', visible: '0' }
      ]
    },
    {
      id: '3', parentId: '0', name: 'Tool', title: '系统工具', icon: 'Tools', type: 'M',
      path: '/tool', component: 'Layout', visible: '0', sort: 3, children: [
        { id: '31', parentId: '3', name: 'Gen', title: '代码生成', icon: 'MagicStick', type: 'C', path: 'gen', component: 'tool/gen/index', perms: 'tool:gen:list', visible: '0' },
        { id: '32', parentId: '3', name: 'Job', title: '定时任务', icon: 'Timer', type: 'C', path: 'job', component: 'tool/job/index', perms: 'monitor:job:list', visible: '0' },
        { id: '33', parentId: '3', name: 'File', title: '文件管理', icon: 'Folder', type: 'C', path: 'file', component: 'tool/file/index', perms: 'system:file:list', visible: '0' }
      ]
    },
    {
      id: '4', parentId: '0', name: 'Demo', title: '示例演示', icon: 'Present', type: 'M',
      path: '/demo', component: 'Layout', visible: '0', sort: 4, children: [
        { id: '41', parentId: '4', name: 'CrudDemo', title: 'CRUD 示例', icon: 'EditPen', type: 'C', path: 'crud', component: 'demo/crud/index', perms: 'demo:crud:list', visible: '0' },
        { id: '42', parentId: '4', name: 'DialogDemo', title: '弹窗能力', icon: 'FullScreen', type: 'C', path: 'dialog', component: 'demo/dialog/index', perms: 'demo:dialog:list', visible: '0' }
      ]
    }
  ]
}

seed()
