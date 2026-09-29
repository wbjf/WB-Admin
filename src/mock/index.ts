import { db } from './db'

type Handler = (query: Record<string, any>, body: any, params: Record<string, string>) => any

const ok = (data: any) => ({ code: 200, msg: '操作成功', data })
const fail = (msg: string, code = 500) => ({ code, msg, data: null })

interface ResourceDef {
  list: any[]
  key: string
  search?: (keyof any)[]
  pageSize?: number
}

/** 资源映射：path → 内存数组 */
function resources(): Record<string, ResourceDef> {
  return {
    '/system/user/list': { list: db.users, key: 'userId', search: ['userName', 'phonenumber', 'nickName'] },
    '/system/role/list': { list: db.roles, key: 'roleId', search: ['roleName', 'roleKey'] },
    '/system/dept/list': { list: db.depts, key: 'deptId', search: ['deptName'] },
    '/system/post/list': { list: db.posts, key: 'postId', search: ['postName'] },
    '/system/dict/type/list': { list: db.dictTypes, key: 'dictId', search: ['dictName', 'dictType'] },
    '/system/dict/data/list': { list: db.dictData, key: 'dictCode', search: ['dictLabel'] },
    '/system/config/list': { list: db.configs, key: 'configId', search: ['configName', 'configKey'] },
    '/system/notice/list': { list: db.notices, key: 'noticeId', search: ['noticeTitle'] },
    '/system/tenant/list': { list: db.tenants, key: 'tenantId', search: ['tenantName'] },
    '/system/file/list': { list: db.files, key: 'fileId', search: ['fileName'] },
    '/monitor/online/list': { list: db.online, key: 'tokenId', search: ['userName'] },
    '/monitor/operlog/list': { list: db.operlogs, key: 'operId', search: ['title', 'operName'] },
    '/monitor/logininfor/list': { list: db.loginlogs, key: 'infoId', search: ['userName'] },
    '/monitor/job/list': { list: db.jobs, key: 'jobId', search: ['jobName'] },
    '/monitor/jobLog/list': { list: db.jobLogs, key: 'jobLogId', search: ['jobName'] },
    '/tool/gen/db/list': { list: db.genTables, key: 'tableId', search: ['tableName', 'tableComment'] },
    '/demo/list': { list: db.demos, key: 'id', search: ['name'] }
  }
}

/** 写操作映射（不带 /list 的 REST 资源） */
function writeMap(): Record<string, ResourceDef> {
  return {
    '/system/user': { list: db.users, key: 'userId' },
    '/system/role': { list: db.roles, key: 'roleId' },
    '/system/dept': { list: db.depts, key: 'deptId' },
    '/system/post': { list: db.posts, key: 'postId' },
    '/system/dict/type': { list: db.dictTypes, key: 'dictId' },
    '/system/dict/data': { list: db.dictData, key: 'dictCode' },
    '/system/config': { list: db.configs, key: 'configId' },
    '/system/notice': { list: db.notices, key: 'noticeId' },
    '/system/tenant': { list: db.tenants, key: 'tenantId' },
    '/system/file': { list: db.files, key: 'fileId' },
    '/monitor/operlog': { list: db.operlogs, key: 'operId' },
    '/monitor/logininfor': { list: db.loginlogs, key: 'infoId' },
    '/monitor/job': { list: db.jobs, key: 'jobId' },
    '/demo': { list: db.demos, key: 'id' }
  }
}

const ALL_PERMS = [
  'system:user:list', 'system:user:add', 'system:user:edit', 'system:user:remove', 'system:user:resetPwd', 'system:user:export',
  'system:role:list', 'system:role:add', 'system:role:edit', 'system:role:remove', 'system:role:export',
  'system:menu:list', 'system:menu:add', 'system:menu:edit', 'system:menu:remove',
  'system:dept:list', 'system:dept:add', 'system:dept:edit', 'system:dept:remove',
  'system:post:list', 'system:post:add', 'system:post:edit', 'system:post:remove', 'system:post:export',
  'system:dict:list', 'system:dict:add', 'system:dict:edit', 'system:dict:remove',
  'system:config:list', 'system:config:add', 'system:config:edit', 'system:config:remove',
  'system:notice:list', 'system:notice:add', 'system:notice:edit', 'system:notice:remove',
  'system:tenant:list', 'system:tenant:add', 'system:tenant:edit', 'system:tenant:remove',
  'monitor:online:list', 'monitor:online:kick',
  'monitor:operlog:list', 'monitor:operlog:remove', 'monitor:loginlog:list', 'monitor:loginlog:remove',
  'monitor:server:list', 'monitor:cache:list', 'monitor:job:list', 'monitor:job:add', 'monitor:job:edit', 'monitor:job:remove',
  'tool:gen:list', 'tool:gen:code',
  'system:file:list', 'system:file:add', 'system:file:remove',
  'demo:crud:list', 'demo:crud:add', 'demo:crud:edit', 'demo:crud:remove', 'demo:crud:export'
]

const routes: Record<string, Handler> = {
  'GET /captchaImage': () => ok({ captchaEnabled: false, img: '', uuid: 'mock-uuid' }),

  'POST /login': (_q, body) => {
    const username = body?.username
    if (!username) return fail('账号不能为空')
    return ok({
      access_token: `mock-token-${username}-${Date.now()}`,
      refresh_token: 'mock-refresh-token',
      expires_in: 7200
    })
  },

  'POST /sms/login': () => ok({ access_token: `mock-sms-token-${Date.now()}`, expires_in: 7200 }),
  'GET /sms/code': () => ok({ uuid: 'mock-sms', expires: 120 }),

  'POST /refresh': () => ok({ access_token: `mock-refreshed-${Date.now()}` }),
  'POST /logout': () => ok(null),
  'POST /register': () => ok(null),
  'POST /forget': () => ok(null),

  'GET /getInfo': () => {
    const user = db.users[0]
    const tenant = db.tenants[0]
    return ok({
      ...user,
      tenantId: tenant.tenantId,
      roles: [db.roles[0], db.roles[1]],
      permissions: ALL_PERMS,
      isSuperAdmin: false
    })
  },

  'GET /system/menu/getRouteList': () => ok(db.menus),
  'GET /system/menu/getUserMenuList': () => ok(db.menus),
  'GET /system/menu/list': () => ok(db.menus),
  'POST /system/menu': (_q, body) => {
    const item = { ...body, id: String(Date.now()), children: [] }
    db.menus.push(item)
    return ok(null)
  },
  'PUT /system/menu': (_q, body) => {
    const i = db.menus.findIndex((m) => m.id === body?.id)
    if (i > -1) db.menus[i] = { ...db.menus[i], ...body }
    return ok(null)
  },

  'GET /system/dict/data/type/:type': (_q, _b, params) =>
    ok(db.dictData.filter((d) => d.dictType === params.type)),

  'GET /system/menu/roleMenuTreeselect/:roleId': () =>
    ok(db.menus.flatMap((m) => [m.id, ...(m.children ?? []).map((c: any) => c.id)])),

  'GET /dashboard/overview': () =>
    ok({
      visit: 12840,
      order: 2681,
      amount: 862310,
      userCount: 329,
      weekTrend: Array.from({ length: 7 }).map((_, i) => ({
        date: `2026-09-${String(17 + i).padStart(2, '0')}`,
        value: Math.round(600 + Math.random() * 800 + i * 40)
      })),
      category: [
        { name: '数码', value: 4200 },
        { name: '家居', value: 2800 },
        { name: '食品', value: 1900 },
        { name: '图书', value: 1200 }
      ],
      funnel: [
        { name: '曝光', value: 12000 },
        { name: '点击', value: 7200 },
        { name: '加购', value: 3100 },
        { name: '下单', value: 1840 },
        { name: '支付', value: 1520 }
      ],
      todos: [
        { title: '待审核订单', count: 12, color: '#409eff', icon: 'ShoppingCart' },
        { title: '待处理工单', count: 5, color: '#67c23a', icon: 'Service' },
        { title: '库存预警', count: 8, color: '#e6a23c', icon: 'Warning' },
        { title: '今日新增用户', count: 34, color: '#f56c6c', icon: 'User' }
      ],
      notices: [
        { title: '关于 2026 年国庆放假安排的通知', date: '2026-09-20', type: '公告' },
        { title: '系统将于本周六凌晨进行例行维护', date: '2026-09-19', type: '通知' },
        { title: '新版数据看板已上线，欢迎试用', date: '2026-09-18', type: '通知' }
      ]
    }),

  'GET /monitor/server': () =>
    ok({
      cpu: { used: 23.4, sys: 8.1, user: 15.3, wait: 2.2, free: 76.6 },
      mem: { total: 32, used: 14.6, free: 17.4, usage: 45.6 },
      disks: [
        { path: '/', total: '500 GB', free: '218 GB', used: '282 GB', usage: 56.4 },
        { path: '/data', total: '2 TB', free: '1.4 TB', used: '600 GB', usage: 30 }
      ],
      jvm: { name: 'OpenJDK', version: '17.0.9', home: '/usr/lib/jvm', startTime: '2026-09-01 08:00:00', runTime: '22天 6小时', used: 512, usage: 41.2 },
      sys: { computerName: 'wb-node-01', osName: 'Linux 5.15', computerIp: '10.0.0.8', osArch: 'x86_64', userDir: '/opt/wb-admin' }
    }),

  'GET /monitor/cache': () =>
    ok({
      commandStats: [
        { name: 'GET', value: '128432' },
        { name: 'SET', value: '41230' },
        { name: 'DEL', value: '8210' },
        { name: 'EXPIRE', value: '3120' }
      ],
      info: { version: '7.2.4', mode: 'standalone', clients: 12, memory: '128M', keys: 8642 },
      dbSize: 8642
    }),

  'DELETE /monitor/online/:tokenId': (_q, _b, params) => {
    const i = db.online.findIndex((o) => o.tokenId === params.tokenId)
    if (i > -1) db.online.splice(i, 1)
    return ok(null)
  },

  'GET /system/user/resetPwd': () => ok({ password: '123456' }),

  'POST /system/file/upload': () => ok({ url: 'https://example.com/mock.png', name: 'mock.png', size: 1024 }),
  // 查不到就返回 null：不要兜底成第一条，那会把"路径写错"伪装成"数据正常"
  'GET /system/tenant/:tenantId': (_q, _b, params) =>
    ok(db.tenants.find((t) => t.tenantId === params.tenantId) ?? null),

  // 预览内容按真实生成结果的长度给：里面有超过容器宽的长行，代码预览的
  // el-scrollbar 靠横向滚动才能看全 —— 这也是一条回归基线（别把它裁掉）。
  'GET /tool/gen/preview/:tableId': () =>
    ok({
      'api.ts':
        '// 由 WB-Admin 代码生成器生成\n' +
        "import { http } from '@/utils/request'\n" +
        "import type { PageResult, SysUserQuery, SysUserRow } from './types'\n" +
        '\n' +
        'export const sysUserApi = {\n' +
        "  list: (params: SysUserQuery) => http.get<PageResult<SysUserRow>>('/system/user/list', { params, headers: { 'X-Tenant-Id': tenantId } }),\n" +
        "  detail: (userId: string) => http.get<SysUserRow>(`/system/user/${userId}`),\n" +
        "  add: (data: Partial<SysUserRow>) => http.post<void>('/system/user', data),\n" +
        "  remove: (ids: string[]) => http.delete<void>(`/system/user/${ids.join(',')}`)\n" +
        '}\n',
      'index.vue':
        '<template>\n' +
        '  <div class="app-container">\n' +
        '    <ProTable ref="tableRef" :columns="columns" :request="request" row-key="userId" />\n' +
        '  </div>\n' +
        '</template>\n',
      'form.vue': '<template><el-form /></template>\n'
    }),

  'GET /tool/gen/:tableId': (_q, _b, params) =>
    ok(db.genTables.find((t) => t.tableId === params.tableId) ?? db.genTables[0]),

  /** ---------- 以下为补齐的"写动作 / 附属接口"，缺了会在页面上表现为点了没反应 ---------- */

  // 角色下拉（用户表单里的角色多选依赖它）
  'GET /system/role/all': () => ok(db.roles),
  'GET /system/post/all': () => ok(db.posts),
  'GET /system/dict/type/all': () => ok(db.dictTypes),

  // 部门下拉：排除自身及所有子孙部门（缺了会落进 /system/dept/:id 兜底返回 null）
  'GET /system/dept/list/exclude/:deptId': (_q, _b, params) => {
    const excluded = new Set<string>([String(params.deptId)])
    let changed = true
    while (changed) {
      changed = false
      for (const d of db.depts) {
        if (!excluded.has(String(d.deptId)) && excluded.has(String(d.parentId))) {
          excluded.add(String(d.deptId))
          changed = true
        }
      }
    }
    return ok(db.depts.filter((d) => !excluded.has(String(d.deptId))))
  },

  'PUT /system/role/changeStatus': (_q, body) => {
    const i = db.roles.findIndex((r) => String(r.roleId) === String(body?.roleId))
    if (i > -1) db.roles[i] = { ...db.roles[i], status: body?.status }
    return ok(null)
  },
  'PUT /system/role/dataScope': (_q, body) => {
    const i = db.roles.findIndex((r) => String(r.roleId) === String(body?.roleId))
    if (i > -1) db.roles[i] = { ...db.roles[i], dataScope: body?.dataScope }
    return ok(null)
  },
  'PUT /system/role/authUser/cancel': () => ok(null),
  'PUT /system/role/authUser/cancelAll': () => ok(null),
  'PUT /system/role/authUser/selectAll': () => ok(null),

  // 菜单：按 id 增删
  'GET /system/menu/:menuId': (_q, _b, params) => {
    const hit = findInTree(db.menus, (m) => String(m.id) === params.menuId)
    return ok(hit ?? null)
  },
  'DELETE /system/menu/:menuId': (_q, _b, params) => {
    removeFromTree(db.menus, String(params.menuId))
    return ok(null)
  },

  // 部门拖拽移动
  'PUT /system/dept/move': (_q, body) => {
    const i = db.depts.findIndex((d) => String(d.deptId) === String(body?.deptId))
    if (i > -1) db.depts[i] = { ...db.depts[i], parentId: body?.parentId }
    return ok(null)
  },

  // 缓存刷新
  'DELETE /system/dict/type/refreshCache': () => ok(null),
  'DELETE /system/config/refreshCache': () => ok(null),

  // 日志清空
  'DELETE /monitor/operlog/clean': () => {
    db.operlogs.length = 0
    return ok(null)
  },
  'DELETE /monitor/logininfor/clean': () => {
    db.loginlogs.length = 0
    return ok(null)
  },
  'DELETE /monitor/jobLog/clean': () => {
    db.jobLogs.length = 0
    return ok(null)
  },

  // 租户
  'PUT /system/tenant/changeStatus': (_q, body) => {
    const i = db.tenants.findIndex((t) => String(t.tenantId) === String(body?.tenantId))
    if (i > -1) db.tenants[i] = { ...db.tenants[i], status: body?.status }
    return ok(null)
  },
  'PUT /system/tenant/syncPackage': () => ok(null),

  // 代码生成
  'POST /tool/gen/generate': () => ok('代码已生成（mock）'),
  'POST /tool/gen/download/batch': () => ok(null),

  // 定时任务
  'PUT /monitor/job/changeStatus': (_q, body) => {
    const i = db.jobs.findIndex((j) => String(j.jobId) === String(body?.jobId))
    if (i > -1) db.jobs[i] = { ...db.jobs[i], status: body?.status }
    return ok(null)
  },
  'PUT /monitor/job/run': () => ok(null),

  // 文件
  'PUT /system/file/rename': (_q, body) => {
    const i = db.files.findIndex((f) => String(f.fileId) === String(body?.fileId))
    if (i > -1) db.files[i] = { ...db.files[i], fileName: body?.fileName }
    return ok(null)
  },
  'POST /system/file/mkdir': (_q, body) => {
    db.files.unshift({ fileId: String(Date.now()), fileName: body?.name ?? '新建目录', isDir: true, size: 0, url: '', createTime: new Date().toISOString() })
    return ok(null)
  },

  // 用户
  'PUT /system/user/changeStatus': (_q, body) => {
    const i = db.users.findIndex((u) => String(u.userId) === String(body?.userId))
    if (i > -1) db.users[i] = { ...db.users[i], status: body?.status }
    return ok(null)
  },
  'PUT /system/user/authRole': (_q, body) => {
    const i = db.users.findIndex((u) => String(u.userId) === String(body?.userId))
    if (i > -1) db.users[i] = { ...db.users[i], roleIds: body?.roleIds }
    return ok(null)
  },
  'PUT /system/user/profile': (_q, body) => {
    const i = db.users.findIndex((u) => String(u.userId) === String(body?.userId ?? db.users[0]?.userId))
    if (i > -1) db.users[i] = { ...db.users[i], ...body }
    return ok(null)
  },
  'PUT /system/user/profile/updatePwd': () => ok(null),
  'PUT /system/user/profile/avatar': (_q, body) => ok({ imgUrl: body?.avatar ?? '' }),

  // 看板拆分接口（页面若按需拉取）
  'GET /dashboard/weekTrend': () =>
    ok(Array.from({ length: 7 }).map((_, i) => ({ date: `2026-09-${String(17 + i).padStart(2, '0')}`, value: Math.round(600 + Math.random() * 800 + i * 40) }))),
  'GET /dashboard/category': () =>
    ok([{ name: '数码', value: 4200 }, { name: '家居', value: 2800 }, { name: '食品', value: 1900 }, { name: '图书', value: 1200 }]),
  'GET /dashboard/todos': () =>
    ok([
      { title: '待审核订单', count: 12, color: '#409eff', icon: 'ShoppingCart' },
      { title: '待处理工单', count: 5, color: '#67c23a', icon: 'Service' },
      { title: '库存预警', count: 8, color: '#e6a23c', icon: 'Warning' },
      { title: '今日新增用户', count: 34, color: '#f56c6c', icon: 'User' }
    ]),
  'GET /dashboard/notices': () =>
    ok([
      { title: '关于 2026 年国庆放假安排的通知', date: '2026-09-20', type: '公告' },
      { title: '系统将于本周六凌晨进行例行维护', date: '2026-09-19', type: '通知' },
      { title: '新版数据看板已上线，欢迎试用', date: '2026-09-18', type: '通知' }
    ])
}

/** 菜单树里按条件查找 */
function findInTree(list: any[], pred: (n: any) => boolean): any | null {
  for (const n of list) {
    if (pred(n)) return n
    if (n.children?.length) {
      const hit = findInTree(n.children, pred)
      if (hit) return hit
    }
  }
  return null
}

/** 菜单树里按 id 删除 */
function removeFromTree(list: any[], id: string): boolean {
  for (let i = 0; i < list.length; i++) {
    if (String(list[i].id) === id) {
      list.splice(i, 1)
      return true
    }
    if (list[i].children?.length && removeFromTree(list[i].children, id)) return true
  }
  return false
}

function paginate(list: any[], query: Record<string, any>) {
  const pageNum = Number(query.pageNum) || 1
  const pageSize = Number(query.pageSize) || 10
  const start = (pageNum - 1) * pageSize
  return { list: list.slice(start, start + pageSize), total: list.length, pageNum, pageSize }
}

function filterList(list: any[], query: Record<string, any>, fields: string[] = []): any[] {
  let out = list
  fields.forEach((f) => {
    if (query[f]) out = out.filter((item) => String(item[f] ?? '').includes(String(query[f])))
  })
  if (query.status) out = out.filter((i) => String(i.status) === String(query.status))
  return out
}

function matchRoute(method: string, path: string) {
  const key = `${method} ${path}`
  if (routes[key]) return { handler: routes[key], params: {} as Record<string, string> }

  /*
   * 列表资源（分页 + 过滤）必须优先于 :param 模式路由，否则会被抢走：
   * `/system/tenant/list` 会被 'GET /system/tenant/:tenantId' 命中，
   * tenantId 取到的是字符串 'list'，查不到再被 `?? db.tenants[0]` 兜底成第一条，
   * 于是「列表接口」静默返回单个对象，调用方拿不到数组。
   */
  if (resources()[path]) return null

  for (const routeKey of Object.keys(routes)) {
    const [m, p] = routeKey.split(' ')
    if (m !== method || !p.includes(':')) continue
    const routeParts = p.split('/')
    const pathParts = path.split('/')
    if (routeParts.length !== pathParts.length) continue
    const params: Record<string, string> = {}
    const matched = routeParts.every((part, i) => {
      if (part.startsWith(':')) {
        params[part.slice(1)] = decodeURIComponent(pathParts[i])
        return true
      }
      return part === pathParts[i]
    })
    if (matched) return { handler: routes[routeKey], params }
  }
  return null
}

/** mock 主入口 */
export function handleRequest(
  method: string,
  path: string,
  query: Record<string, any>,
  body: any
): any {
  // 1. 精确 / 带参路由
  const special = matchRoute(method, path)
  if (special) return special.handler(query, body, special.params)

  // 2. 列表资源
  const res = resources()[path]
  if (res && method === 'GET') {
    const filtered = filterList(res.list, query, (res.search ?? []) as string[])
    if (path.includes('/dict/data/list') && query.dictType) {
      const list = filtered.filter((d) => d.dictType === query.dictType)
      return ok(paginate(list, query))
    }
    if (path === '/system/dept/list' || path === '/tool/gen/db/list') {
      return ok(paginate(filtered, query))
    }
    return ok(paginate(filtered, query))
  }

  // 3. 写操作
  const wmap = writeMap()
  if (wmap[path]) {
    const def = wmap[path]
    if (method === 'POST') {
      const item = { ...body, [def.key]: String(Date.now()), createTime: new Date().toISOString() }
      def.list.unshift(item)
      return ok(null)
    }
    if (method === 'PUT') {
      const i = def.list.findIndex((it) => String(it[def.key]) === String(body?.[def.key]))
      if (i > -1) def.list[i] = { ...def.list[i], ...body }
      return ok(null)
    }
    if (method === 'DELETE') {
      const ids = String(query.ids || body?.ids || '')
        .split(',')
        .filter(Boolean)
      for (const idv of ids) {
        const i = def.list.findIndex((it) => String(it[def.key]) === String(idv))
        if (i > -1) def.list.splice(i, 1)
      }
      return ok(null)
    }
  }

  // 3b. /base/:id 形式的写操作（DELETE /system/dept/1、PUT /system/user/1 …）
  //     不处理的话会走到最后的 ok(null)，表现为"点了删除却没反应"
  for (const [base, def] of Object.entries(wmap)) {
    if (!path.startsWith(`${base}/`)) continue
    const value = path.slice(base.length + 1)
    const i = def.list.findIndex((it) => String(it[def.key]) === String(value))
    if (method === 'DELETE') {
      if (i > -1) def.list.splice(i, 1)
      return ok(null)
    }
    if (method === 'PUT' && i > -1) {
      def.list[i] = { ...def.list[i], ...body }
      return ok(null)
    }
  }

  // 4. 按前缀兜底：detail /:id
  for (const [base, def] of Object.entries(wmap)) {
    if (path.startsWith(`${base}/`) && method === 'GET') {
      const value = path.slice(base.length + 1)
      const hit = def.list.find((it) => String(it[def.key]) === String(value))
      return ok(hit ?? null)
    }
  }

  return ok(null)
}

export default handleRequest
