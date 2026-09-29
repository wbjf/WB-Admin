# 动态路由与权限

这是整套脚手架里最容易踩坑、也最值得先看的一块。

## 为什么不是「后端直接返回路由」

纯后端返回路由意味着后端可以下发任意组件路径，存在注入风险。WB-Admin 采用**三段式**：

```text
静态路由（constantRoutes / baseRoutes）
        +
后端菜单树（只下发数据：path、component、type、perms）
        +
前端组件白名单（import.meta.glob 扫描 /src/views）
```

`component: 'system/user/index'` 只是个字符串，前端在 `import.meta.glob` 的结果里查得到才加载，查不到就丢弃。**后端无法凭空加载一个前端组件。**

## 三级权限

| 级别 | 实现 | 位置 |
| --- | --- | --- |
| 路由级 | 后端按角色过滤菜单，前端据此生成路由 | `router/helper.ts` `buildRoutes` |
| 菜单级 | `filterVisibleMenus` 过滤隐藏项 | `router/helper.ts` |
| 按钮级 | `v-hasPermi` 指令 / `hasPermi()` 函数 | `directives/permission.ts` |
| 数据级 | 角色 `dataScope`：全部 / 自定义 / 本部门 / 本部门及以下 / 仅本人 | `views/system/role` |

```vue
<!-- 指令用法 -->
<el-button v-hasPermi="['system:user:add']">新增</el-button>
<el-button v-hasRole="['admin']">危险操作</el-button>

<!-- 函数用法 -->
<el-button v-if="hasPermi('system:user:export')">导出</el-button>
```

超级管理员（`isSuperAdmin`）直接绕过所有按钮级判断。

## 路由注册的两个坑（已修复，别再踩回去）

### 1. 顶层路由必须带 `name`

守卫里如果写成：

```ts
routes.forEach((r) => {
  if (r.name && !router.hasRoute(r.name)) router.addRoute(r)  // ❌
})
```

顶层布局路由（`type: 'M'`）一旦没有 `name`，整条会被静默跳过，表现是**菜单有、点进去全白**，控制台还不报错。

现在的做法是：M 分支也写入 `name`（取菜单的 `name`，缺失时用 path 生成 `AutoSystemUser` 这类稳定名），并且守卫里按 `name` / `path` 双通道判重，无 name 也照样注册：

```ts
function applyDynamicRoutes(routes: RouteRecordRaw[]) {
  routes.forEach((r) => {
    const key = r.name ? `name:${String(r.name)}` : `path:${String(r.path)}`
    if (addedRouteKeys.has(key)) return
    if (r.name && router.hasRoute(r.name)) { addedRouteKeys.add(key); return }
    addedRouteKeys.add(key)
    router.addRoute(r)
  })
}
```

### 2. 刷新后菜单树也会丢

路由是运行时 `addRoute` 的，刷新就没了；`permissionStore` 没做持久化，所以 `menuTree` 同样是空的。守卫里的补偿分支**必须同时补菜单**，否则刷新后侧边栏一片空白：

```ts
const routes = await permStore.loadRoutes()
applyDynamicRoutes(routes)
if (routes.length) await permStore.loadMenus()   // 少了这句，刷新后没菜单
```

## visible 字段的约定

与 RuoYi 保持一致：**`visible: '0'` = 显示，`'1'` = 隐藏**。

写反的后果是 `filterVisibleMenus` 把整棵树过滤掉。判断依据：

```ts
hidden: menu.visible === '1'                                  // meta
.filter((m) => m.type !== 'F' && m.visible !== '1')            // 菜单过滤
```

## 新增一个受权限控制的页面

1. 在 `src/views/<模块>/<页面>/index.vue` 写好页面。
2. 后端菜单表加一条：`type='C'`、`path='xxx'`、`component='<模块>/<页面>/index'`、`perms='<模块>:<页面>:list'`。
3. 给角色勾选该菜单。
4. 完事——路由、菜单、按钮权限都由框架接管，前端不用改路由表。
