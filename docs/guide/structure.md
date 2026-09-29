# 目录结构

```text
WB-Admin/
├─ code-generator/            # 零依赖代码生成器 CLI
│  └─ cli.js
├─ docker/
│  └─ nginx.conf              # SPA history 回退 + gzip
├─ docs/                      # VitePress 文档站
├─ public/
│  └─ favicon.svg
├─ src/
│  ├─ api/                    # 接口层：一模块一文件，只做类型化调用
│  │  ├─ auth.ts  user.ts  role.ts  menu.ts  dept.ts  post.ts
│  │  └─ dict.ts  tenant.ts  monitor.ts  tool.ts  dashboard.ts  demo.ts
│  ├─ assets/styles/          # 全局样式、CSS 变量、Element Plus 变量桥接
│  ├─ components/             # L2 通用组件（Pro 系列）
│  │  ├─ ProTable/            # 高级表格（配置 + 插槽）
│  │  ├─ ProForm/             # 表单（19 种控件）
│  │  ├─ SearchForm/          # 顶部查询区
│  │  ├─ Dict/                # DictSelect / DictTag
│  │  ├─ EChart/  Editor/  ProUpload/  ImageCropper/  DeptSelect/  IconSelect/
│  │  └─ ProDialog.vue
│  ├─ composables/            # 组合式逻辑：useCrud / useTable / useDownload / useDict / usePermission
│  ├─ directives/             # v-hasPermi / v-hasRole / v-copy / v-debounce / v-longpress / v-drag / v-watermark
│  ├─ layouts/                # 布局：侧栏、顶栏、面包屑、标签页、TopMenu
│  ├─ locales/                # i18n
│  │  └─ lang/{zh-CN,en-US}.ts
│  ├─ mock/                   # 零依赖 Mock（Vite 中间件）
│  │  ├─ plugin.ts            # 中间件本体
│  │  ├─ db.ts                # 内存数据源
│  │  └─ index.ts             # 路由表
│  ├─ router/                 # 静态路由 + 动态路由构建 + 守卫
│  │  ├─ routes.ts  helper.ts  guard.ts  index.ts
│  ├─ stores/                 # Pinia
│  │  └─ modules/{app,user,permission,settings,tagsView,dict,tenant}.ts
│  ├─ types/                  # 全局类型、环境声明
│  ├─ utils/                  # request / auth / theme / permission / download / excel / print / validate …
│  └─ views/                  # L1 业务视图（可整体删除）
│     ├─ auth/  dashboard/  profile/  error/  common/
│     ├─ system/{user,role,menu,dept,post,dict,config,notice,tenant}/
│     ├─ monitor/{online,operlog,loginlog,server,cache}/
│     ├─ tool/{gen,job,file}/
│     └─ demo/crud/
├─ test/
│  ├─ unit/                   # Vitest
│  └─ e2e/                    # Playwright
├─ .env.development / .env.test / .env.production
├─ .github/workflows/ci.yml
├─ Dockerfile / docker-compose.yml
├─ eslint.config.js / .prettierrc / commitlint.config.js
├─ index.html                 # 含首屏防闪白内联脚本
├─ vite.config.ts
└─ tsconfig.json
```

## 几处刻意的设计

**`views/` 与 `components/` 不互相 import。** 页面要用表格就写 `<ProTable>`，靠 `unplugin-vue-components` 自动引入；组件里绝不 import 任何页面，否则 L2 就被 L1 污染了。

**`api/` 只做类型化调用。** 不在 `api/` 里写业务分支、不弹 toast、不改路由。异常统一交给请求层的拦截器。

**`stores/` 里不放视图状态。** 弹窗开关、表格 loading 这些留在页面自己的 `ref` 里；store 只放跨页面共享的（用户、权限、字典、租户、设置）。
