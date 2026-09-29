# 快速开始

## 环境要求

- Node.js >= 18.18（推荐 20 LTS 或 22）
- 包管理器：npm / pnpm / yarn 均可（示例用 npm）

## 安装与启动

```bash
# 1. 安装依赖
npm install

# 2. 启动开发服务（默认 http://localhost:3000，已内置 Mock）
npm run dev

# 3. 打包
npm run build          # 等价于 vue-tsc --noEmit && vite build

# 4. 本地预览产物
npm run preview
```

## 演示账号

| 账号 | 密码 | 说明 |
| --- | --- | --- |
| `admin` | `admin123` | 超级管理员，拥有全部菜单与按钮权限 |
| `common` | `admin123` | 普通角色，权限受限，可用于验证权限过滤 |

> Mock 默认关闭图形验证码、关闭短信校验，登录页直接点「登录」即可。

## 常用脚本

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 开发服务（含 Mock 中间件） |
| `npm run dev:host` | 开发服务并暴露到局域网 |
| `npm run build` | 类型检查 + 生产构建 |
| `npm run build:test` | 用 `.env.test` 构建 |
| `npm run typecheck` | 只做类型检查，不产出文件 |
| `npm run lint` | ESLint 自动修复 |
| `npm run format` | Prettier 全量格式化 |
| `npm run test` | Vitest 单元测试（17 个用例） |
| `npm run test:e2e` | Playwright 端到端测试 |
| `npm run gen` | 交互式代码生成器 |
| `npm run docs:dev` | 本地起组件文档站 |

## 接后端时要做的事

1. 改 `.env.development`：

```ini
VITE_USE_MOCK=false
VITE_API_BASE_URL=/api        # 或直接写完整域名
```

2. 在 `vite.config.ts` 的 `server.proxy` 里把 `/api` 指向后端地址（开发期）。
3. 对齐后端响应结构。默认约定为：

```ts
interface R<T> {
  code: number // 200 或 0 视为成功
  msg: string
  data: T
}
```

如果你的后端用的是 `{ success, result }` 这类结构，改 `src/utils/request.ts` 响应拦截器里的解包逻辑即可，全站自动生效。

4. 对齐 `src/api/*.ts` 里的接口路径与入参（也可以直接用代码生成器生成）。
