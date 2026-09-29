---
layout: home

hero:
  name: WB-Admin
  text: 通用后台管理系统脚手架
  tagline: Vue 3 · TypeScript · Vite 6 · Element Plus · 开箱即用的中后台底座
  actions:
    - theme: brand
      text: 快速开始
      link: /guide/start
    - theme: alt
      text: 组件文档
      link: /components/pro-table

features:
  - title: 三层架构，可删可换
    details: 业务视图（views）/ 通用组件（components）/ 核心运行时（router、permission、request）分层解耦，删掉任意业务页面都不会影响底座。
  - title: 动态路由 + 三级权限
    details: 静态路由 + 后端菜单合并 + 组件白名单，路由级 / 菜单级 / 按钮级权限全覆盖，支持数据权限与超级管理员绕过。
  - title: 主题与布局可配置
    details: 主色、暗黑、色弱、灰色模式、标签页、面包屑、水印等全部走 CSS 变量与设置面板，首屏无闪白。
  - title: 多租户 + 国际化
    details: 租户上下文注入请求头、租户切换页；vue-i18n 与 Element Plus 语言包联动，支持运行时切换。
  - title: 零依赖 Mock
    details: Vite 中间件实现的 Mock 服务，不依赖 mockjs 的 XHR 劫持，前端可独立跑通全部页面与 CRUD。
  - title: 工程化配套
    details: 代码生成器、ESLint/Prettier/Husky/commitlint、Vitest 单测、Playwright E2E、Docker + Nginx、GitHub Actions。
---
