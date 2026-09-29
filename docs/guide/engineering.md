# 构建与部署

## 本地构建

```bash
npm run build           # = vue-tsc --noEmit && vite build
npm run build:test      # 用 .env.test
npm run build:prod      # 用 .env.production
npm run preview         # 预览 dist
```

构建前会先跑类型检查，类型不过不会产出包。

## 产物结构

```text
dist/
├─ assets/
│  ├─ vue-[hash].js
│  ├─ element-plus-[hash].js
│  ├─ echarts-[hash].js
│  └─ vendor-[hash].js
└─ index.html
```

`manualChunks` 把大依赖拆开，避免单文件过长的告警，也利于浏览器缓存。

## Docker

```bash
docker build -t wb-admin:1.0.0 .
docker run -d -p 80:80 wb-admin:1.0.0

# 或用 compose
docker-compose up -d
```

镜像是两阶段构建：Node 阶段打包，Nginx 阶段只拷贝 `dist`。

## Nginx 要点

```nginx
location / {
  try_files $uri $uri/ /index.html;   # SPA history 回退，必须有
}

gzip on;
gzip_types text/css application/javascript application/json image/svg+xml;
```

> `VITE_BUILD_COMPRESS` 在 Windows 下会产生奇怪的路径（`dist/D:/...`），已列为已知问题。**建议关掉它，用 Nginx 的 gzip**，效果一样且更省事。

## CI（GitHub Actions）

`.github/workflows/ci.yml` 依次执行：

```text
install → lint → typecheck → test → build → 上传 dist 产物
```

Push 到 `main` / PR 都会触发。

## 部署到子路径

如果站点挂在 `https://example.com/admin/`：

1. `vite.config.ts` 里设 `base: '/admin/'`
2. 路由 `createWebHistory('/admin/')`
3. Nginx 的 `location /admin/` 同样回退到 `/admin/index.html`

## 环境变量在构建期就固化

Vite 的环境变量是**构建时替换**的，不是运行时读取。所以一套 `dist` 不能靠改环境变量切换后端地址。要么每个环境各打一次包，要么把配置放到 `public/config.js` 里运行时加载。
