# 配置项

## 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `VITE_APP_TITLE` | `WB-Admin` | 站点标题、登录页大标题 |
| `VITE_API_BASE_URL` | `/dev-api` / `/api` | 接口前缀，最终会被 `VITE_API_PREFIX` 统一 |
| `VITE_API_PREFIX` | `/api` | 请求统一前缀 |
| `VITE_PORT` | `3000` | 开发服务端口 |
| `VITE_USE_MOCK` | `true`（dev） | 是否启用内置 Mock |
| `VITE_ENABLE_TENANT` | `true` | 是否启用多租户（关闭后隐藏租户相关入口） |
| `VITE_ENABLE_I18N` | `true` | 是否启用国际化 |
| `VITE_ENABLE_DEMO` | `true` | 是否展示示例演示模块 |
| `VITE_ROUTER_MODE` | `history` | `history` / `hash` |
| `VITE_BUILD_COMPRESS` | `false` | 构建产物压缩（Windows 下有已知路径问题，建议交给 Nginx） |
| `VITE_BUILD_ANALYZE` | `false` | 是否产出打包分析页 |

## 构建与别名（`vite.config.ts`）

```ts
resolve.alias = {
  '@': 'src',
  '#': 'types'
}
```

按需自动引入：

- `unplugin-auto-import`：`ref` `computed` `onMounted` `useRouter` `useRoute` `ElMessage` 等
- `unplugin-vue-components` + `ElementPlusResolver`：Element Plus 组件与样式

> 因此页面里**不需要**手动 `import { ElMessage } from 'element-plus'`，但**类型**仍需显式导入：
> `import type { FormInstance, FormRules } from 'element-plus'`

手动分包（`manualChunks`）：`vue` / `element-plus` / `echarts` / 其余 vendor，避免单个 chunk 过大。

## 主题与布局持久化

主题状态写入 `localStorage['wb-admin-theme']`，`index.html` 里有一段内联脚本在首屏前读取并应用，避免闪白。

```ts
interface ThemeState {
  mode: 'light' | 'dark'
  primaryColor: string
  layout: 'side' | 'top' | 'mix'
  sidebarOpened: boolean
  tagsView: boolean
  fixedHeader: boolean
  footer: boolean
  gray: boolean       // 灰色模式（哀悼）
  weak: boolean       // 色弱模式
  compact: boolean
  allowWatermark: boolean
}
```

## 各 store 的持久化白名单

| store | key | 持久化字段 |
| --- | --- | --- |
| user | `wb-admin-user` | userId / userName / nickName / avatar / roles / permissions / tenantId / currentRole / isSuperAdmin |
| tenant | `wb-admin-tenant` | currentId / tenants |
| dict | `wb-admin-dict` | 字典缓存 |
| app | `wb-admin-app` | 语言 / 设备 / 锁屏时间 |

> **token 不进 localStorage**，走 `js-cookie`（`remember` 勾选时延长有效期），见 `src/utils/auth.ts`。
