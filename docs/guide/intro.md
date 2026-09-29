# 项目介绍

WB-Admin 是一套**通用后台管理系统脚手架**。目标只有一个：新开一个管理系统时，底座不用重写。

它不是「后台模板」，而是一套**分层契约**：

| 层级 | 目录 | 职责 | 替换成本 |
| --- | --- | --- | --- |
| L1 业务视图 | `src/views/**` | 具体业务页面 | 随时删，不影响底座 |
| L2 通用组件 | `src/components/**` | Pro 系列业务组件 | 可增删，向下只依赖 L3 |
| L3 核心运行时 | `src/router` `src/stores` `src/utils` `src/api` | 路由、权限、请求、状态 | 稳定，尽量不改 |
| L4 基础设施 | `vite.config.ts` `eslint.config.js` `tsconfig.json` | 构建与规范 | 换项目时基本不动 |
| L5 交付 | `code-generator/` `docker/` `.github/` | 生成器、镜像、CI | 按需启用 |

**核心约束：上层可依赖下层，下层绝不依赖上层。** 判据是——删掉 `src/views/system` 整个目录，项目仍能启动、登录、进首页。

## 技术栈

- **Vue 3.5** + `<script setup>` + **TypeScript 严格模式**
- **Vite 6**（`@vitejs/plugin-vue`、AutoImport、Components 按需引入）
- **Pinia 3** + `pinia-plugin-persistedstate`（白名单持久化）
- **Vue Router 4**（hash / history 可切换）
- **Element Plus 2.8** + `@element-plus/icons-vue`
- **vue-i18n 10**（Composition API 模式）
- **axios**（统一封装 + 静默刷新 + 并发去重）
- **ECharts 5** / **xlsx** / **wangEditor** / **md-editor-v3** / **cropperjs**
- **Vitest**（单测）+ **Playwright**（E2E）
- **ESLint 9 flat config** + Prettier + Husky + lint-staged + commitlint

## 功能清单概览

| 分组 | 内容 |
| --- | --- |
| A 工程底座 | Vite/TS/ESLint/Prettier/Husky/环境变量/别名/自动导入/分包 |
| B 布局框架 | 侧栏（含折叠/抽屉）、顶栏、面包屑、标签页、页脚、移动端适配 |
| C 主题外观 | 主色自定义、暗黑、色弱、灰色、紧凑、圆角、水印、首屏无闪 |
| D 权限体系 | 动态路由、三级权限、数据权限、超级管理员绕过、无权限页 |
| E 请求层 | 拦截器、统一响应、401 刷新队列、取消、去重、重试、下载 |
| F 通用组件 | ProTable / ProForm / SearchForm / ProDialog / ProUpload / Dict / IconSelect / EChart / ImageCropper / Editor |
| G 业务页面 | 用户、角色、菜单、部门、岗位、字典、参数、公告、租户、个人中心 |
| H 监控工具 | 在线用户、操作日志、登录日志、服务监控、缓存监控、代码生成、定时任务、文件管理 |
| I 增强 | 富文本/Markdown、导入导出、打印、二维码、裁剪、拖拽、复制指令 |
| J 工程化 | 代码生成器、Mock、Docker + Nginx、GitHub Actions、单测、E2E、组件文档 |

## 接下来

- [快速开始](/guide/start) —— 5 分钟跑起来
- [动态路由与权限](/guide/permission) —— 最核心也最容易踩坑的一块
- [新项目落地五步法](/guide/new-project) —— 直接拿去开新项目
