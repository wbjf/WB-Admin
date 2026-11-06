# 配置项

## 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `VITE_APP_TITLE` | `WB-Admin` | 站点标题、登录页大标题 |
| `VITE_APP_ENV` | `development` | 环境标识，仅用于区分构建产物，不参与运行时逻辑 |
| `VITE_BASE_URL` | `/` | 应用基路径。静态托管在子目录（如 `/WB-Admin/`）时必须改，否则所有资源去域名根目录找 |
| `VITE_API_PREFIX` | `/api` | 请求统一前缀 |
| `VITE_PROXY_TARGET` | `http://127.0.0.1:8080` | 开发代理目标（`server.proxy` 的通用 `/api` 规则） |
| `VITE_OLLAMA_TARGET` | `http://127.0.0.1:11434` | AI 对话的 Ollama 地址，只作用于 `/api/chat`、`/api/tags` 两条代理规则 |
| `VITE_OLLAMA_MODEL` | `qwen2.5:3b` | 模型列表拉不到时的兜底模型名，必须与服务器上实际存在的一致 |
| `VITE_PORT` | `3000` | 开发服务端口 |
| `VITE_USE_MOCK` | `true`（dev） | 是否启用内置 Mock |
| `VITE_ENABLE_TENANT` | `true` | 是否启用多租户（关闭后隐藏租户相关入口） |
| `VITE_ENABLE_I18N` | `true` | 是否启用国际化 |
| `VITE_ENABLE_DEMO` | `true` | 是否展示示例演示模块 |
| `VITE_ROUTER_HISTORY` | `history` | 设为 `hash` 切到哈希路由 |
| `VITE_BUILD_COMPRESS` | `false` | 构建产物压缩（Windows 下有已知路径问题，建议交给 Nginx） |
| `VITE_BUILD_ANALYZE` | `false` | 是否产出打包分析页 |
| `VITE_BUILD_SOURCEMAP` | `true` | 是否产出 sourcemap（`pages` 模式关闭） |

> AI 对话相关的两个变量怎么用、Ollama 怎么对外开放，见 [AI 对话面板 · 接口怎么接](../components/ai-chat.md#二接口怎么接)。

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
