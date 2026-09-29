# WB-Admin

[![CI](https://github.com/wbjf/WB-Admin/actions/workflows/ci.yml/badge.svg)](https://github.com/wbjf/WB-Admin/actions/workflows/ci.yml)
[![Node](https://img.shields.io/badge/node-%3E%3D18.18-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![Vue](https://img.shields.io/badge/vue-3.5-4FC08D?logo=vuedotjs&logoColor=white)](https://vuejs.org)
[![Element Plus](https://img.shields.io/badge/element--plus-2.8-409EFF?logo=element&logoColor=white)](https://element-plus.org)
[![TypeScript](https://img.shields.io/badge/typescript-5.6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![在线演示](https://img.shields.io/badge/demo-在线体验-409EFF?logo=githubpages&logoColor=white)](https://wbjf.github.io/WB-Admin/)
[![文档](https://img.shields.io/badge/docs-文档站-42B883)](https://wbjf.github.io/WB-Admin/docs/)

通用后台管理系统脚手架 —— Vue 3 + TypeScript + Vite + Element Plus + Pinia。

**在线演示：<https://wbjf.github.io/WB-Admin/>** —— 账号 `admin / admin123`，纯前端自带 mock，打开即用。

**文档站：<https://wbjf.github.io/WB-Admin/docs/>** —— 指南、核心机制、14 个通用组件 API，带本地搜索。

目标不是"做一个后台"，而是沉淀一套**改配置就能出系统**的底座：把每次新项目都要重写的东西（请求、路由、权限、表格、CRUD、部署）固化成稳定层，新项目只写业务差异部分。

---

## 快速开始

```bash
npm install          # 或 pnpm install
npm run dev          # http://localhost:3000
```

默认走 **内置 mock**（`.env.development` 中 `VITE_USE_MOCK=true`），无需后端即可跑通全部页面。

演示账号：`admin / admin123`（其他账号任意密码也可登录）。

常用脚本：

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 开发服务器（含 mock） |
| `npm run build` | 类型检查 + 生产构建 |
| `npm run typecheck` | vue-tsc 全量类型检查 |
| `npm run lint` | ESLint + Prettier 修复 |
| `npm run test` | Vitest 单元测试 |
| `npm run test:e2e` | Playwright 端到端（默认直接用本机 Chrome，无需下载内核；要用自带内核算设 `E2E_CHANNEL=chromium`） |
| `npm run gen` | 代码生成器 CLI |
| `npm run docs:dev` | 本地起文档站（VitePress）。地址是 `http://localhost:5173/WB-Admin/docs/`，**base 与线上一致**，路径问题本地就能暴露 |
| `npm run docs:build` | 构建文档站到 `docs/.vitepress/dist` |
| `npm run docs:build:pages` | 构建文档站到 `dist/docs`（给 GitHub Pages 用） |

> 完整文档见 `docs/`：起步、动态路由与权限、主题、i18n、多租户、请求层、Mock、代码生成、部署，以及全部 14 个通用组件的 API。

---

## 已实现功能

### 基础设施
- 多环境配置（dev / test / prod），统一 `VITE_` 前缀
- 全局错误兜底：`app.config.errorHandler` + `unhandledrejection`
- Element Plus 按需引入 + 组件 / API 自动导入（`unplugin-vue-components`）
- ESLint(flat) + Prettier + husky + lint-staged + commitlint
- 打包优化：手动分包、gzip、CDN 预留、体积分析（`VITE_BUILD_ANALYZE=true`）
- 版本更新检测位、Sentry 接入位

### 请求层
- 统一响应解包 + 业务错误码映射 + Message 去重
- Token 自动注入 + 401 无感刷新（并发请求队列）
- 请求取消（路由切换）、防重复提交、超时重试（指数退避可配）
- 文件下载（blob + 进度 + 错误 JSON 识别）、上传（类型/大小校验 + 进度）
- 多 BaseURL、全局 loading 开关（`meta.loading`）

### 路由与导航
- 静态路由 + 后端动态路由合并，**组件白名单**（`import.meta.glob`）杜绝注入
- 路由守卫：登录 / 权限 / 白名单 / 进度条 / 动态路由丢失自动重建
- keep-alive 按 meta 缓存、TagsView（右键菜单 + 拖拽排序 + 上限数 + 持久化）
- 面包屑自动生成、页面切换动画、404 / 403 / 500、外链 iframe
- `Ctrl + K` 菜单搜索、`Ctrl + L` 锁屏

### 认证与会话
- 账号密码 / 短信 / 扫码（QR）三种登录
- 验证码开关、记住密码（轻度混淆存储）、CapsLock 提示、密码强度条
- 注册、找回密码、登录过期自动登出 + 原路径回跳
- 锁屏（自动锁屏 + 密码解锁）、在线设备管理预留

### 权限体系（核心）
- RBAC：用户 / 角色 / 菜单 / 部门 / 岗位
- **三级权限**：路由级（动态路由过滤）、菜单级（显隐）、按钮级（`v-hasPermi` + `hasPermi()`）
- 数据权限：全部 / 自定义 / 本部门 / 本部门及以下 / 仅本人
- 超级管理员 bypass、多角色切换
- **多租户**：租户列表、切换租户、请求头 `X-Tenant-Id`、租户管理页

### 布局与主题
- 三种布局：左侧菜单 / 顶部菜单 / 混合，运行时切换
- 明暗主题 + 跟随系统 + 12 色主题色在线切换（CSS 变量 + 色阶生成）
- 首屏主题防闪烁（`index.html` 内联脚本）
- 色弱模式、灰色模式、页面水印、组件尺寸、页脚 / 头部 / 动画开关
- 响应式三档断点，移动端抽屉菜单
- 主题配置可复制 / 一键重置
- **内容区恒定布局**：四周留白统一 `--wb-content-padding: 12px`（只有 `.wb-app-main` 一层提供）；窗口与内容区永远不出现滚动条；模块撑满可用高度，超高内容在模块内部滚动（表格 = 表头固定 + 分页固定 + 表体自己滚）

### 通用组件
| 组件 | 说明 |
| --- | --- |
| `ProTable` | 配置列 + 插槽 + 分页 + 多选 + 排序 + 列设置（显隐/排序/固定）+ 导出 + 打印 + 树表 |
| `ProForm` | Schema 驱动表单，19 种控件，栅格布局，字典联动 |
| `SearchForm` | 查询表单，自动折叠展开 |
| `ProDialog` | 统一弹窗（确认态 / 滚动 / destroy-on-close） |
| `DictSelect` / `DictTag` | 字典组件，统一缓存 |
| `IconSelect` | 图标选择器（全量 EP Icons） |
| `EChart` | 图表封装，跟主题明暗联动 + 容器 resize |
| `ProUpload` | 图片/文件上传，类型大小校验、进度、预览、删除 |
| `ImageCropper` | 头像裁剪（旋转 / 缩放 / 重置） |
| `WangEditor` / `MarkdownEditor` | 富文本与 Markdown |
| `DeptSelect` | 部门树选择器 |

### Hooks
`useCrud`（CRUD 全流程）、`useTable`（轻量列表）、`useDict`、`useDownload`、`usePermission`

### 系统页面
- 用户 / 角色 / 菜单 / 部门 / 岗位 / 字典 / 参数 / 公告 / 租户管理
- 在线用户、操作日志、登录日志、服务监控、缓存监控
- 代码生成、定时任务（含 cron 生成器）、文件管理
- 工作台 Dashboard、个人中心、CRUD 示例页、403 / 404 / 500

### 工程化
- **代码生成器 CLI**：`npm run gen`，产出 api / types / 列表页 / 表单 / 菜单 SQL
- 内置 mock 服务（零依赖中间件，可开关）
- Dockerfile + Nginx（SPA history 回退 + gzip）+ docker-compose
- GitHub Actions：lint / typecheck / unit / build / e2e
- Vitest 单测（17 例）+ Playwright E2E

### 国际化
中英文双语（`vue-i18n` + Element Plus locale 联动），文案集中在 `src/locales/lang/*`，运行时切换。

---

## 目录结构

```
src/
├─ api/            接口层（按域分文件，统一返回 typed Promise）
├─ assets/
├─ components/     通用组件（Pro* 系列，业务无关）
├─ composables/    hooks：useCrud / useTable / useDict / useDownload
├─ directives/     权限、复制、防抖、长按、拖拽、水印
├─ layouts/        三种布局 + Navbar / TagsView / Settings / 锁屏 / 搜索
├─ locales/        i18n（zh-CN / en-US）
├─ mock/           mock 服务（vite 插件 + 内存数据）
├─ plugins/        全局注册入口
├─ router/         静态路由 + 守卫 + 菜单→路由转换
├─ stores/         Pinia：app / user / permission / settings / tagsView / dict / tenant
├─ styles/         变量与全局样式
├─ types/          全局类型与 shims
├─ utils/          request / auth / download / excel / print / theme / validate
└─ views/          业务页面（system / monitor / tool / demo / auth / error）
code-generator/    代码生成器 CLI（独立于 src）
docker/            Nginx 配置
test/              unit + e2e
```

**铁律**：上层依赖下层，严禁反向依赖。`views/` 下任何页面整目录删除后底座不得报错 —— 这是这套脚手架能长期复用的唯一硬指标。

---

## 新项目五步法

1. **拉模板**：拷贝仓库 / `git subtree`，保留 git 历史以便后续 `git pull` 同步底座修复
2. **改配置**：`.env.*` 的 `VITE_APP_TITLE`、`VITE_API_PREFIX`、`VITE_PROXY_TARGET`；`public/favicon.svg`；`src/utils/theme.ts` 的 `DEFAULT_THEME.color`
3. **生成 CRUD**：`npm run gen -- --table=sys_xxx --name=xxx --module=system --comment=某某`，把产出物放进 `src/views/` 与 `src/api/`
4. **配菜单权限**：用生成的 `menu.sql` 或直接菜单管理页录入，权限标识与后端对齐
5. **写差异业务**：只改 `views/` 与 `api/`，不动 `components/`、`utils/`、`router/`

一个标准业务页面应该长这样（`views/demo/crud` 是完整示范）：

```vue
<script setup lang="ts">
const { tableRef, query, formData, visible, openAdd, openEdit, submit, remove } = useCrud({
  listApi: demoApi.list,
  addApi: demoApi.add,
  updateApi: demoApi.update,
  delApi: demoApi.remove
})
</script>

<template>
  <SearchForm v-model="params" :schemas="schemas" @search="tableRef?.reload()" />
  <ProTable ref="tableRef" :columns="columns" :request="query">
    <template #toolbar-left>
      <el-button v-hasPermi="['demo:crud:add']" type="primary" @click="openAdd">新增</el-button>
    </template>
  </ProTable>
</template>
```

---

## 环境变量

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `VITE_APP_TITLE` | WB-Admin | 站点标题 |
| `VITE_API_PREFIX` | /api | 接口前缀 |
| `VITE_PROXY_TARGET` | http://127.0.0.1:8080 | 开发代理目标 |
| `VITE_USE_MOCK` | true | 是否启用内置 mock |
| `VITE_ENABLE_TENANT` | true | 多租户开关 |
| `VITE_ENABLE_I18N` | true | 国际化开关 |
| `VITE_BUILD_COMPRESS` | false | gzip 压缩（Windows 下建议用 Nginx 代替） |
| `VITE_BUILD_ANALYZE` | false | 打包体积分析 |
| `VITE_ROUTER_HISTORY` | history | 设为 `hash` 切换哈希路由 |

---

## 部署

```bash
npm run build                 # 产出 dist/
docker compose up -d          # 本地容器验证，访问 http://localhost:8080
```

Nginx 关键配置已放在 `docker/nginx.conf`（SPA history 回退 + 静态资源长缓存 + `/prod-api` 反代）。

### 静态托管（GitHub Pages）

演示站与文档站由同一个工作流自动部署（`.github/workflows/deploy-pages.yml`），push 到 `main` 即更新：

| 站点 | 地址 | 产物目录 |
| --- | --- | --- |
| 演示站 | <https://wbjf.github.io/WB-Admin/> | `dist/`（Vue 单页应用） |
| 文档站 | <https://wbjf.github.io/WB-Admin/docs/> | `dist/docs/`（VitePress） |

> 一个仓库只有一个 Pages 站点，所以文档挂成演示站的**子目录**。两者的 base 都带 `/WB-Admin` 前缀。

**别直接把 `npm run build` 的产物丢到静态托管上** —— 会得到一个「登录都过不去」的空壳。
原因是 mock 中间件挂在 Vite dev server 上（`src/mock/plugin.ts` 的 `configureServer`），
静态产物里根本不会被加载，接口全部 404。静态托管请用 `npm run build:pages`（配置见 `.env.pages`）：

| 措施 | 为什么必须 |
| --- | --- |
| `VITE_BASE_URL=/WB-Admin/` | 项目站挂在 `/<repo>/` 子路径下，base 不改则所有资源去域名根目录找 → 整站 404 |
| `VITE_USE_MOCK=true` | 生产构建开着这个开关时，`src/utils/request.ts` 会把 axios 的 adapter 换成 `src/mock/adapter.ts` —— 把纯函数 `handleRequest` 直接跑在浏览器里，接口行为与开发环境一致，**不需要** mockjs 那种 XHR 劫持 |
| `npm run docs:build:pages`（**必须在应用构建之后**） | 文档站建到 `dist/docs`。`vite build` 会先清空 `dist`，顺序调换会把文档冲掉 |
| `node scripts/make-404.js dist`（构建后） | GitHub Pages 对不存在的路径只返回**站点根目录**的 404.html（子目录里的不会被使用）。脚本把 `index.html` 复制成兜底页，并在 `<head>` 开头插一段分流脚本：文档站路径回文档站首页，其余交给应用按 `location.pathname` 走 history 路由 |

`src/mock/adapter.ts` 是**懒加载**的（`import()` 切独立 chunk），所以 `VITE_USE_MOCK=false`
的正式构建里这个分支是死代码，Rollup 会把整个 chunk 连同 mockjs 一并去掉，正式包不会被拖大。

文档站的 base 写在 `docs/.vitepress/config.ts`（`/WB-Admin/docs/`，可用环境变量 `DOCS_BASE` 覆盖）。
**不要改用 CLI 的 `--base` 传参**：Windows 的 Git Bash(MSYS) 会把以 `/` 开头的参数当路径改写
（实测 `/WB-Admin/docs/` → `C:/Users/.../PortableGit/versions/1.2.0/WB-Admin/docs/`），
**构建照样成功**，但产物里所有链接都是垃圾路径。`scripts/make-404.js` 里有前缀自检，对不上会直接失败。

本地预演 Pages 环境（子路径 + 404 回退 + 真实 Chrome）用仓库外的两个脚本，未纳入版本控制
（它们依赖先构建）：

| 脚本 | 覆盖范围 |
| --- | --- |
| `_pages-verify.cjs` | 演示站：登录、菜单、表格出数据、深链接直达 |
| `_docs-verify.cjs` | 文档站：首页/侧边栏/本地搜索/深链接，兜底页分流是否正确，以及演示站回归（22 项） |

---

## 验证状态

| 项目 | 结果 |
| --- | --- |
| `vue-tsc --noEmit` | 0 错误 |
| `vitest run` | 27 / 27 通过（路由回归 7 例守住「目录菜单 → 路由」；租户 store 3 例守住「持久化脏数据」） |
| `vite build` | 成功 |
| `vitepress build docs` | 成功 |
| `npm run test:e2e` | 15 / 15 通过（主链路 3 + 布局细节 3 + 内容区间距/滚动/撑满 6 + **对话框横向滚动条 3**） |
| **对话框横向滚动条回归**（真实浏览器，10 个对话框 + 同源对照） | **55 / 55 通过**：9 个表单对话框内容横向溢出 **6px → 0**（`scrollWidth 614 → 608 = clientWidth`）· **真实滚轮横滚 `scrollLeft 6 → 0`** · 无控件被裁 · 纵向滚动能力保留 · **`tool/gen` 代码预览的横向滚动完好**（长代码行 `sw 922 / cw 868`，滚轮横滚到 `scrollLeft 54`）—— 守住"不拿 `overflow-x: hidden` 一刀切" |
| **内容区间距 / 滚动条 / 撑满回归**（真实浏览器） | **74 / 74 通过**：8 个代表页四周留白 **32px → 12px** · 窗口与内容区 0 滚动条 · 模块底边贴内容区底边（差 ≤1px）· 表头固定 + 分页贴卡片底 + 表体内部滚动（用户页 10 行溢出 31px，实测在表体内部）· **矮窗口 1280×620 / 1024×520 下仍然只有表体滚动**（表体内部溢出 >0，窗口/内容区/页面容器均无滚动条）· 工作台图表跟随容器自适应（1000px 高 356px → 820px 高 176px） |
| **布局细节回归**（真实浏览器，含同源对照） | **55 / 55 通过**：按钮组相对列左边框缩进 8px → **88px**（= 列内边距 + labelWidth，与输入框左对齐）· 行内按钮中心离散 **6px → 0** · 左卡片高度 **232px → 795px = 所在列高** · 覆盖 1/2/3/4 个查询条件的 5 个页面（按钮组均不折行、不越界）· 浅色/深色双主题 · 3 个条件的岗位管理页按钮行未发生跨行位移 |
| **布局与配色回归**（真实浏览器，含同源对照） | **18 / 18 通过**：菜单 hover 在浅/深色下均不再出现纯黑底（浅色 `rgb(0,0,0)` 对比度 3.44 → `rgb(245,247,250)` 5.69；深色 → `rgb(38,39,39)` 9.99）· 菜单常态与激活项对比度达标 · **tags 垂直居中（中心偏差 -6px → -0.5px）** · 折叠态 64px 图标居中无溢出 · 顶部布局菜单高度不溢出导航栏 · 混合布局侧边栏二级菜单 + 顶部一级入口 |
| 真实浏览器全链路 | 11 / 11 通过：登录 → **注入历史脏持久化数据后刷新不崩** → 租户下拉 3 项 → 20 个业务页面内容区非空 → 侧边栏目录可展开 → 用户表格出 10 行数据 → 直接访问 `/system` 正确落到子页 → 未知路径落 404 → **全站 0 条 Vue 告警**；无 pageerror、无 console.error、无失败请求、0 次重新预构建 |

浏览器验证覆盖的页面：用户 / 角色 / 菜单 / 部门 / 岗位 / 字典 / 参数 / 公告 / 租户 / 在线用户 / 操作日志 / 登录日志 / 服务监控 / 缓存监控 / 代码生成 / 定时任务 / 文件管理 / 个人中心。

---

## 已知事项

- `vite-plugin-compression` 在 Windows 下日志路径显示异常，推荐用 Nginx gzip；确需前端压缩再开启 `VITE_BUILD_COMPRESS`
- 首屏 JS 偏大（Element Plus + ECharts + 编辑器全量引入），正式项目建议：ECharts 改按需引入、富文本/Markdown 编辑器改为异步组件
- mock 数据在内存中，`src/mock/db.ts` 里的写操作重启后复位
- 列表接口「返回分页对象还是纯数组」统一用 `toArray()` 归一化，不要手写 `Array.isArray` 判断

---

## 踩坑记录（改代码前建议先看）

以下几条都曾真实导致"页面白屏 / 点了没反应 / 菜单空白"，且**控制台不报错**，最难查：

1. **动态路由没 `name` → 整条被静默跳过。** 守卫里别写 `if (r.name && ...)`，无 name 也要 `addRoute`（按 path 判重）。症状：菜单在，点进去全白。
2. **刷新后菜单树也会丢。** 动态路由补偿分支必须同时 `loadMenus()`，否则 F5 之后侧边栏空白。
3. **`visible` 语义写反。** 约定 `'0'` 显示 / `'1'` 隐藏；`filterVisibleMenus` 写反会把整棵菜单过滤掉。
4. **`isAffix(contextTarget!)` 这类非空断言会在运行时炸。** `Boolean(null.affix)` 抛 TypeError，被全局错误处理器吞掉，表现为标签页区域渲染中断。
5. **mock 里 `DELETE /base/:id` 未处理 → 点了删除没反应。** 会落到兜底 `ok(null)`，接口返回成功但数据没删。
6. **`server.middlewares.use(prefix, fn)` 不能用。** connect 会剥掉前缀，导致内部 `startsWith(prefix)` 永远失败，请求穿透到 proxy 报 `ECONNREFUSED`。
7. **目录级菜单（`type: 'M'`）必须生成 `redirect`。** 目录自身没有组件，点它（或搜索菜单里选中它）会导航到 `/system` 这种"空壳路径"，`router-view` 渲染空白且不报错。`buildRoutes` 现在会自动指向第一个可见子页面。
8. **兜底路由会抢在动态路由之前重定向。** `/:pathMatch(.*)*` 在刷新场景下先把 `/system` 变成到 `/404` 的重定向，守卫随后补注册动态路由时目标已经丢了。补偿分支必须用 `to.redirectedFrom?.fullPath` 回到用户原本要去的地址（见 `guard.ts` 的 `resolveTarget`）。
9. **mock 的 `:param` 模式路由会吃掉列表端点。** `/system/tenant/list` 曾被 `GET /system/tenant/:tenantId` 命中，`tenantId` 拿到字符串 `'list'`，查不到再被 `?? db.tenants[0]` 兜底成第一条 —— 列表接口静默返回单个对象，租户下拉的 `el-option` 于是拿到 `undefined` 并抛 prop 校验错误。修法：`matchRoute` 里列表资源优先于模式路由，并且**不要在查不到时兜底成第一条数据**。
10. **菜单可见性只保留一份实现。** `SidebarItem` 曾自己写了一遍 `visible !== '0'`（反了），结果所有子菜单被过滤掉，「系统管理」退化成可点击的叶子项，点了就跳 `/system` 白屏。统一走 `isMenuVisible()`。
11. **Element Plus 按需导入要在 `optimizeDeps.include` 里预先声明。** 每个组件的 `style/css` 是运行时才被发现的依赖，不声明会不断触发"发现新依赖 → 重新预构建 → 整页 reload"。`vite.config.ts` 里已用 `elementPlusStyleEntries()` 自动列出（注意别连 `index` 一起列，附属组件如 `breadcrumb-item` 没有 `index.mjs`）。
12. **不要持久化服务端列表数据。** `tenantStore.tenants` 早期参与过持久化，旧版本把**分页对象** `{ list, total }` 写进了 localStorage；水合时直接灌进 state，Navbar 的 `.filter` 抛 `TypeError: ... .filter is not a function`，整页渲染被打断（白屏）。两处一起改才算修完：
    - 持久化只留 `pick: ['currentId']`（列表随时能重新拉）；
    - store 的 `options` getter 用 `toArray()` **无条件归一化** —— 老用户浏览器里的脏数据在代码侧清不掉，必须在「读」的一侧兜住。

    更一般的教训：**被持久化的 state 结构会跟着版本走**。改了数据结构后，老用户的 localStorage 里仍是旧结构，所以凡是被持久化的字段，读取时都要假定它可能是任何东西。（同一类问题的通用对策见「已知事项」最后一条：列表统一 `toArray()`。）
13. **`el-popover` 的 `#reference` 里不要直接放组件。** Element Plus 会把 reference 交给内部的 `ElOnlyChild`，由它给「第一个合法子节点」挂 `forwardRef` 指令；若那个子节点是**根节点为 fragment 的组件**（`el-tooltip` 就是），Vue 会报 `Runtime directive used on component with non-element root node. The directives will not function as intended.`，指令失效。包一层普通元素（`<span>`）即可。同类结构：`el-tooltip` / `el-dropdown` 的默认插槽。
14. **不要给 `el-menu` 传 `background-color` / `text-color` 这类「会由它推导另一个颜色」的 prop，更不要喂 CSS 变量表达式。** EP 的 `useMenuColor()` 会对传入值做 `new TinyColor(value).shade(20)` 来算出 `--el-menu-hover-bg-color`；`TinyColor` 解析不了 `var(--wb-sidebar-bg, #ffffff)`，**解析失败会兜底成 `#000000`**，于是 hover 背景变纯黑 —— 浅色主题下菜单文字是 `#606266`，黑底深字实测对比度只有 3.44（AA 要求 4.5），表现就是"鼠标移上去看不见菜单名"。更麻烦的是这些变量是 EP **内联写在元素上**的，内联优先级高于任何选择器，事后用 CSS 覆盖不掉。正确做法：**颜色 props 一个都不传**，全部在样式里定义 `--el-menu-*` 变量（`cssVarBlock` 会 `if (object[key])` 跳过空值，不传就没有内联变量）。同理适用于 EP 里任何「由一个颜色算出另一个颜色」的 prop。
15. **`el-scrollbar` 内部只有 `__wrap` 撑满，`__view` 的高度是 auto。** 所以在 38px 的 tags 容器上给 `.wb-tags__list { height: 100% }` 是无效的 —— 它的父级 `__view` 高度由内容决定，`align-items: center` 落不到容器上，标签整体贴顶（实测中心偏差 -6px）。必须补 `:deep(.el-scrollbar__view) { height: 100% }` 才真正垂直居中。
16. **混合布局（`layout: 'mix'`）必须同时给出一级菜单入口。** `Sidebar` 的 `mixChildren` 会按当前路由的一级段只渲染该一级下的子菜单，所以顶部得有个切换一级的地方；`Navbar` 里原先只判 `layout === 'top'` 渲染 `TopMenu`，导致混合布局下侧边栏只剩二级菜单、却没有一级菜单可点，等于不可用。现在按「左侧布局用面包屑，其余用一级菜单条」来切。
17. **栅格列里的操作按钮组要包一层「不传 label 的 `el-form-item`」，并且列宽别用固定的 `span`。** 这三点会同时出问题，缺一不可：
    - **贴边**：同排字段的输入框在 `el-form-item__content` 里，左边缘 = 列内边距 8 + `labelWidth`；按钮直接放 `el-col` 里没有这段缩进，实测比输入框靠左 88px，看起来就是"贴在卡片边上"。
    - **不居中**：容器写 `align-items: flex-start` 时是顶对齐，而「展开」这类 link 按钮只有 20px 高、普通按钮 32px，顶对齐会让它比同伴高 6px。
    - **折行**：`el-col` 默认 `flex: 0 0 25%`（1440px 下约 225px），装不下「`labelWidth` 缩进 + 三个按钮」，会被 `flex-wrap` 折成两行。

    修法只用 EP 自己的机制，不写魔法数字：无 label 的 `el-form-item` 会被加上 `margin-left: labelWidth`（对齐），其内容区自带 `display:flex + align-items:center`（居中）；列宽改 `flex: 1 1 auto; max-width: 100%`（同行时占满剩余、不够则整列换行撑满）。**注意这个改动会让"按钮组和字段同行还是换行"取决于栅格剩余宽度，所以必须按查询条件数量（1/2/3/4 个）分别验证，只测一个页面测不出折行。**
18. **`.wb-card` 的高度是 auto，`el-row` 把 `el-col` 撑到列高并不会把卡片撑起来。** 于是内容少的一侧背景块只有半截高，下面留白（实测 232px vs 列高 782px）。需要撑满就给卡片加 `.wb-card--fill`（`height:100%` + 纵向 flex），内部要滚动的区域配 `flex: 1; min-height: 0; overflow: auto`。也别用 `max-height: calc(100vh - 260px)` 这类硬编码 —— 它随导航栏 / tags / 页脚高度漂移，既不准也不会自愈。
19. **Playwright 默认要下载 Chromium 内核，代理不通时会卡死；直接用它已经装好的 Chrome。** `playwright.config.ts` 里设 `channel: 'chrome'` 即可（本机 Chrome 免下载），需要自带内核时用 `E2E_CHANNEL=chromium`。另外**没有浏览器的环境下 Playwright 用例等于从未执行过** —— 本项目就有一条 `getByText('简体中文')` 的用例一直超时，因为登录页右上角按钮显示的是"下一个语言"（中文环境下文案就是 `English`）；补上真实内核后立刻暴露。
20. **内容区留白只能有一层来源。** `.wb-app-main` 和 `.wb-page` 一度各写了 `padding: 16px`，两级叠加成 **32px**（实测左右上下都是 32px），看起来就是"边距莫名偏大"。现在留白只由 `.wb-app-main` 提供，间距一律用 `--wb-content-padding` / `--wb-gap`，页面容器 `padding: 0`，页面内的 `wb-mt12` 等 margin 在 gap 生效处归零（`gap` 与 `margin` 同时存在会变成双倍间距）。
21. **"模块撑满 + 内部滚动"不要用 JS 算高度，交给 flex。** 三步就够，但缺一步都会失败：
    - 页面容器 `height: 100%; display: flex; flex-direction: column`，**且子项默认 `flex: none`** —— 否则内容超高时 flex 会先把模块压扁，而不是让容器滚动；
    - 撑满型卡片 `flex: 1 1 0; min-height: 0; display: flex; flex-direction: column`；
    - **`el-table` 必须显式 `flex: 1 1 0`**：EP 给它写了 `height: fit-content`，作为 flex 子项会挡住拉伸。注意 `flex-basis: 0` 时 `height` 不参与主轴尺寸计算，所以不用去覆盖它。
    撑满型卡片的识别用 `:has(> .wb-pro-table)` 自动判定（含表格的卡片天然就是"需要内部滚动"的），其余场景用显式类 `.wb-card--fill`。
22. **滚动条要按"谁滚"分层，不能只把某一层改成 `overflow: hidden`。** `.wb-app-main` 设 `overflow: hidden` 只挡住了窗口级滚动，页面内容超高时仍会撑出去。正确分层：窗口/内容区 `hidden` → 页面容器（`.wb-page`）`overflow-y: auto; overflow-x: hidden` → 模块（卡片）内部再滚。横向那个 `hidden` 不能省：栅格 `el-row` 带 `gutter` 时左右各有 `-6px` 负外边距，会溢出 6px 并触发横向滚动条。
23. **`EChart` 的 `height` 是内联样式，在 flex 容器里不受 class 控制。** 直接给组件挂 `flex: 1 1 0` 会被内联 `height` 干扰，正确做法是**外面包一层 div** 承接 `flex: 1 1 0; min-height: 140px`，图表传 `height="100%"` 填满这层。组件内部已有 `ResizeObserver`，容器一变就会 `chart.resize()`。
24. **对话框正文里的横向滚动条来自栅格负外边距，而且不能在「滚动容器」那一层堵。** `el-row` 的 `gutter` 是用**内联样式**实现的（`row.vue` 里 `styles.marginLeft = styles.marginRight = -gutter/2 + 'px'`），整行因此比容器宽一个 gutter —— gutter=12 时实测 `scrollWidth 614 / clientWidth 608`，真实滚轮横滚能滚到 `scrollLeft=6`。父容器 overflow 可见时它无害，但 `ProDialog` 正文包在 `el-scrollbar` 里（滚动容器 `overflow: auto`，双向），这 6px 就成了用户看得见的一条横条。两个关键点：
    - **别在滚动容器上加 `overflow-x: hidden` 兜底。** `tool/gen` 的代码预览把 `<pre>` 放在 `el-scrollbar` 里（实测长代码行 `scrollWidth 922 / clientWidth 868`），那是**正当需要横向滚动**的场景，一刀切会把它静默裁掉。正解是消除溢出本身：`.el-dialog__body .el-row { margin-left: 0 !important; margin-right: 0 !important }` —— 列自身的内边距保留，于是内容左右各内缩 gutter/2、两侧对称，列间距不变。
    - **必须 `!important`。** 内联样式优先级高于任何选择器，不加就是"改了没生效"。
    另外：`overflow-x: hidden` 的元素**仍允许程序化赋值 `scrollLeft`**，所以"能不能滚"只能靠真实滚轮（`page.mouse.wheel`）验证，用 `wrap.scrollLeft = 400` 去判断会得到假结论。
25. **侧边栏菜单动效：`.el-menu` 上的 `transition` 和垂直 `padding` 都要不得，折叠宽度也别用 EP 的固定值。** 三个坑叠在一起，症状都是"高度/宽度跳一下"：
    - **展开收起被"跳"过去。** EP 的子菜单折叠过渡走 `max-height`（`ElCollapseTransition`：`beforeEnter` 设 `maxHeight: 0` → `enter` 设成 `scrollHeight` → `afterEnter` 归位 `''`），过渡来自 `.el-collapse-transition-*-active` 上的 `transition: max-height .3s`（特异性 0,1,0）。而样式里给 `.el-menu` 写的 `transition: padding .28s` 编译后是 `.wb-sidebar[data-v-x] .el-menu`（0,2,0），**作用在同一个元素上、优先级更高，直接把 EP 的过渡覆盖掉** —— 于是 `max-height` 一帧跳到位（实测 410 → 12），只剩 padding 在慢慢蠕动。教训：**给 EP 内部组件加 `transition` 简写前，先确认它没在同一个元素上管着别的东西**（简写会重置 `transition-property`）。
    - **目标高度被量小，收尾必弹。** 同一个 `beforeEnter` 会先把 `paddingTop/Bottom` 归零、再读 `el.scrollHeight`。所以**给子菜单的 ul 留垂直 padding，量出来的目标高度就少一个 padding**（实测 394 vs 真实 410）；另外 `scrollHeight` 不含子元素的外边距，首尾项各 2px 的外边距也不在内。动画走完 `max-height` 归位 `auto` 时，这 16px 会**一次性弹出来**。修法：ul 的垂直 padding 归零（留白挪到 `.wb-sidebar__scroll` 上，它在过渡的测量范围之外），子菜单 ul 的首尾项 `margin-top/bottom: 0`。
    - **折叠时"内容先缩、外框后缩"。** `.wb-sidebar` 的宽度是 `0.28s` 过渡的，而 EP 给 `.el-menu--collapse` 设了固定宽度 `calc(icon-width + base-padding * 2)`，折叠瞬间内容就跳到 64px 宽，外框还在 220px 慢慢收 —— 实测动画中途两者能错开 **92px**，视觉上就是菜单挤在左边、右边一片空白。把 `.el-menu--collapse` 的宽度改成 `width: 100%`（跟随容器）即同步；折叠完成时容器宽 64px，与 EP 的计算值一致，外观不变。

    验证方式：动效类缺陷静态量几何量不出来，**用 `requestAnimationFrame` 逐帧采样**才是可靠的。判定"有没有过渡"看**单帧最大变化量占总变化量的比例**（跳变 ≈ 0.96，ease 过渡 ≈ 0.1），判定"有没有量小"看**是否停在某个非终值上不动**（旧版停 17~19 帧）。这三条已固化为 `test/e2e/menu-motion.spec.ts`，并用注入旧样式的方式确认过断言在缺陷版本上确实会失败。
26. **不要用 `padding` 给 `el-icon` 撑点击热区 —— 会从图标自身里"扣"，把图标横向压扁。** `el-icon` 的尺寸是 `width: 1em; height: 1em`，而 Element Plus 全局设了 `box-sizing: border-box`，所以 `font-size: 17px` 的图标再写 `padding: 5px`，**内容盒只剩 7×7**（padding 是往里扣的，不是往外撑）。里面的 `<svg>` 同样是 `1em`：主轴（水平）被 `flex-shrink` 压到 7px，副轴（垂直）因为 `align-items: center` 不参与收缩仍是 17px —— 实测渲染成 **7×17、横向压到 41%**，图标看起来"又细又小"，而且纵向还会溢出 5px 盖在 padding 区上。正解是**给固定方形尺寸再靠 flex 居中**（`width/height: 30px; padding: 0`），svg 自然按 1em 正常显示（实测 18×18）。同理：任何自身带 `1em` 尺寸 + 全局 border-box 的组件（EP 的 `el-icon`、部分 `el-tag` 内容）都不该用 padding 调尺寸。
27. **工具条里的按钮间距别依赖 `.el-button + .el-button`。** EP 有一条 `.el-button + .el-button { margin-left: 12px }` 负责相邻按钮间距，但它只认**直接相邻的两个 el-button**。`.wb-toolbar__left/__right` 原本没有任何布局样式（计算值 `display: block`），组内按钮是 inline 排列、全靠这条规则给间距；而「列设置」的触发元素外面包了一层 `<span>`（`el-popover` 的 reference 要挂 forwardRef，见 `ColumnSetting.vue` 注释），不是 `el-button`，于是它左边距为 0 —— 实测右侧间距 `[12, 12, 12, 0]`，"设置按钮贴上一个按钮"。修法是把左右分组声明成 `display: flex; gap: var(--wb-gap)`（间距与子节点是什么标签无关），同时把 EP 那条相邻 margin 归零，否则 `gap 12 + margin 12` 会叠成 24。**排查这类"间距不一致"的通用手法：量出全部相邻间距的数组，看有几种取值** —— 只有 0 和 12 两种，就说明是"某个节点没吃到那条规则"，而不是 CSS 值写错。
    另外量顶栏图标间距时要注意：右侧一栏里夹着租户下拉、头像等非图标元素，**按"所有相邻图标"算间距会把隔着下拉框的那段距离（实测 146px）也算进来**，断言必然误报。要按直接子元素切成「连续图标段」再量段内间距（`test/e2e/navbar-toolbar.spec.ts` 就是这么写的）。
28. **EP 的 `.el-upload-list` 带固定的 `margin: 10px 0 0`，列表为空时这段间距照样占位 —— 会让同一行里的按钮高低不齐。**
    EP 在 dist 里给它写死了 `margin: 10px 0 0`（不是主题变量、也没有 `v-if` 兜底），而 `el-upload` 无论有没有文件都会渲染这个 `<ul>`。
    于是 `ProUpload` 的外层 `.wb-upload` 被撑成「触发按钮 32 + 空列表 10 = **42px**」。
    放进 `align-items: center` 的一行（如 `views/tool/file` 的工具条）后：外层那个 42px 的盒子确实被居中了，
    可按钮贴在自己盒子的顶部 —— **实测「上传文件」比同排的「新建文件夹 / 删除 / 列表」高 5px**（`top` 189 vs 194，(42-32)/2 = 5）。
    修法就一句：`:deep(.el-upload-list:not(:has(li))) { margin-top: 0 }`（空列表不占位，有文件时保留 EP 原本的 10px）。
    顺带修好了 picture-card 场景 —— EP 在 picture-card 模式下把文件列表渲染在**触发卡片之前**，那 10px 原本是把上传卡片往下推（实测卡片顶边 183 vs 容器顶边 173），去掉后卡片正好从表单项顶边开始。

    **排查手法**：遇到"同一行里某个元素总是高出/低于几像素"，别盯着那个元素看（它自己 32px 完全正常），
    要**量每个元素垂直中心相对容器中心的偏移** `rect.top + rect.height/2 - containerCy`，一眼就能找到唯一的离群者；
    再去比**它的外层包装盒高度是否等于它自身**（本次 42 vs 32），差额 ÷ 2 就是那个偏移量。
    另外 `/tool/file` 用的是页面自己的条 `.wb-tool-file__bar`，不是 `ProTable` 的 `.wb-toolbar` ——
    这页上两行长得像但容器不同，探针要按实际容器取，否则会量到隔壁那行（本次第一版就取错了）。
    那一轮量到的是「图标相对按钮中心偏 1px」，当时觉得放大 6 倍不可辨就没处理；后来用户一眼看出"没垂直居中"，
    按文字中心重新量出来是 **1.5px**，根因见第 29 条（图标底边贴了文字基线），已修。
29. **EP 给图标间距用的是「相邻兄弟选择器」，slot 写法一律吃不到 —— 同一条工具条上会同时出现两种间距。**
    EP 的规则是 `.el-button [class*=el-icon] + span { margin-left: 6px }`，要求图标是那层 `<span>` 的**兄弟**：

    ```
    :icon prop 写法  <button><i class="el-icon"/><span>上传文件</span></button>            ← 命中，6px
    slot 手写写法    <button><span><i class="el-icon"/>新建文件夹</span></button>          ← 图标在 span 内部，
                                                                                            相邻兄弟是文本节点不是 span
                                                                                            → 不命中，0px
    ```

    实测同一行 `[6, 0, 0]`。CSS 选不中「相邻的文本节点」，所以别去补选择器，直接给 EP 本来就写成
    `inline-flex` 的那层 `.el-button > span` 加 `gap`（间距与子节点是什么标签无关；`:icon` 的图标不在 span 内，
    仍走 EP 的 margin，不会叠成双倍）。按 EP 口径分三档 `6 / 8 / 4`。

    **单选按钮（`el-radio-button`）是同一类坑，而且更隐蔽**：
    - 水平：EP 那条 `.el-radio-button__inner [class*=el-icon-] + span { margin-left: 5px }` 的**选择器末尾多了个短横线**，
      匹配的是 `el-icon-xxx` 形式的 class，而图标渲染出来的 class 就是 `el-icon` —— **恒不生效**，实测 gap 0。
    - 垂直：压根没人管。图标是 `inline-flex` 且 `vertical-align` 默认 `baseline`，1em 方盒**底边贴在文字基线上**
      （实测图标底边 211、文字基线 211.02，完全吻合）；而中文字形视觉中心在基线上方约 0.44em，
      图标中心却在 0.5em → 整体偏高 1.5px，看起来"顶边贴着文字顶边、底部空一截"。

    修法：图标加 `margin-right: 5px` + 下移 1.4px，写成 `top: 0.1em`。

    **下移必须用 `position: relative`，不能用 `vertical-align`** —— 后者参与行盒高度计算：
    图标下移 1.4px 后它在基线上方的部分从 14px 变成 12.6px，行盒跟着矮 1.39px
    （实测 inner 高度 32 → 30.61），而同行的普通按钮还是 32px，于是"修好居中、又矮了一截"。
    同理也别图省事把 `.el-radio-button__inner` 改成 `inline-flex; align-items: center` —— 同一条路：
    内容高度只剩 `line-height: 1` 的 14px，按钮从 32 掉到 30。
    （`.el-icon` 本身就是 `position: relative`，加个 `top` 零成本。）
    这两处已固化为 `test/e2e/icon-text.spec.ts`。
30. **element-plus 的 CSS 在页面里可能有两份，后一份会让「同等特异性的覆盖」静默失效 —— 不要依赖 import 顺序。**
    排查单选按钮 `display` 改不动时发现：`document.styleSheets` 里既有 `main.ts` 中
    `import 'element-plus/dist/index.css'` 那份（2639 条规则），**又有一份运行时按需注入的组件样式**
    （`el-radio-button` 那份 18 条），后者排在 `styles/index.scss` **之后**。
    现象很有迷惑性：同一条自定义规则里 `align-items: center` 生效了、`display` 却还是 `inline-block`
    —— 因为 EP 只声明了 `display`，两者特异性相同（都是 0,1,0）时按文档顺序后者胜。
    对策不是 `!important`，而是**把选择器提高一级特异性**（`.el-radio-group .el-radio-button__inner`，0,2,0），
    这样 dev 与 build 表现一致、也不受注入时机影响。

    **排查手法**：遍历 `document.styleSheets`，打印每张表的规则条数与是否含目标选择器，
    再按 CSSOM 顺序列出所有命中该选择器的规则及其目标属性 —— 比反复改代码猜快得多
    （见 `_icon-text-gap.cjs` 输出的 C 段）。**凡是"改了样式没生效"且不涉及内联样式的情况，先看这条。**
31. **给元素加间距/改对齐时，先确认容器的尺寸来源 —— flex 与 inline-block 的高度算的不是一回事。**
    本轮两次踩到同一件事：`inline-block` 里那 2px 是**字体 descent 在基线下方撑出来的行盒空白**
    （14px 字号下 inner 高 32px）；一旦改成 flex，内容高度就只剩 `line-height` 的 14px，容器变 30px。
    `el-radio-button__inner`、`el-checkbox-button__inner` 都属于这种"高度靠行盒撑出来"的组件。
    判断方法：改动前后**都量一次容器高度**，别只量你要修的那个属性 —— 本次就是靠
    「inner 高度 32 → 30.61」这行对照数据才发现副作用，否则会以"已居中"收工、留下一个矮 2px 的按钮。
    同类要提防的还有 `padding` 与 `border-box` 的组合（见第 26 条，量的是图标被压扁）。

---

## License

[MIT](./LICENSE) © 2026 wbjf

可自由用于商业项目，保留版权声明即可。
