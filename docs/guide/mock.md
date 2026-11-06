# Mock 数据

## 为什么不用 mockjs 的 XHR 劫持

mockjs 靠拦截 `XMLHttpRequest` 工作，和 axios 的取消、拦截器、blob 下载都会打架，而且开发环境的行为跟真实环境不一致。

WB-Admin 用 **Vite 中间件**实现，请求是真的发出去的 HTTP 请求，走完整的 axios 链路，行为和接后端后完全一致。

```ts
// src/mock/plugin.ts（Vite 插件）
server.middlewares.use(async (req, res, next) => {
  const rawUrl = req.url || ''
  if (!rawUrl.startsWith(prefix)) return next()
  const result = handleRequest(method, path, query, body)
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(result))
})
```

> 注意：不能写成 `server.middlewares.use(prefix, fn)`。connect 会把匹配到的前缀从 `req.url` 里剥掉，导致内部再判断 `startsWith(prefix)` 永远失败，请求全部穿透到 proxy 报 `ECONNREFUSED`。

## 三个文件

| 文件 | 作用 |
| --- | --- |
| `db.ts` | 内存数据源，mockjs 播种 100 条量级的数据 |
| `index.ts` | 路由表 + 资源映射 + 通用分页/增删改 |
| `plugin.ts` | Vite 中间件本体 |

## 匹配顺序

```text
1. 特殊路由（'GET /system/menu/getRouteList'、'GET /system/dict/data/type/:type' …）
2. 列表资源（resources() 里登记的数组，自动分页 + 关键字过滤）
3. /base 的写操作（POST 新增 / PUT 更新 / DELETE 删除）
4. /base/:id 的写操作（DELETE /system/dept/1、PUT /system/user/1）
5. /base/:id 的 GET 详情
6. 兜底 ok(null)
```

第 4 步是必须的。少了它，`DELETE /system/dept/1` 会落到兜底返回"成功但实际什么都没删"——页面上表现为**点了删除没反应**，而且不报错。

## 新增一个资源的 mock

```ts
// 1) db.ts 里造数据
db.products = Array.from({ length: 60 }).map((_, i) => ({ productId: String(i + 1), productName: `商品${i + 1}` }))

// 2) index.ts 的 resources() 登记
'/mall/product/list': { list: db.products, key: 'productId', search: ['productName'] },

// 3) index.ts 的 writeMap() 登记
'/mall/product': { list: db.products, key: 'productId' },
```

分页、搜索、增删改立刻可用。

## 特殊返回值

```ts
'GET /captchaImage': () => ok({ captchaEnabled: false, img: '', uuid: 'mock-uuid' })
```

想验证验证码流程，把 `captchaEnabled` 改成 `true` 即可（图片为空时页面会隐藏该表单项）。

## 放行真实接口（`bypass`）

这个中间件注册在 `configureServer` 里，**排在 vite 内置 proxy 之前**，而它对未命中的 `/api` 请求不是返回 404，而是兜底 `ok(null)` + HTTP 200。也就是说：已经接了真实后端的接口，只要还在 `/api` 前缀下，就会被「兜」成一个成功但空的响应 —— 请求看起来成功了，数据却是 `null`，比报错难查得多。

所以真实接口要显式放行：

```ts
// vite.config.ts
mockServer({
  enabled: env.VITE_USE_MOCK === 'true',
  bypass: ['/api/chat', '/api/tags']
})
```

匹配规则是「相等或以 `p/` 开头」，避免 `/api/chat` 把 `/api/chatx` 一起放过去。当前放行的是 AI 对话的两条 Ollama 接口（见 [AI 对话面板](../components/ai-chat.md)）。

> 这也是删掉 AI 占位路由后仍然需要 bypass 的原因：路由没了，兜底还在。少了它，旧路径会安静地返回 `{code:200,data:null}`。

## 关掉 Mock

```ini
VITE_USE_MOCK=false
```

中间件直接不挂载，所有请求走 `server.proxy`。

## 覆盖度自检

改完 mock 建议跑一次接口对账（脚本思路：扫 `src/api/*.ts` 里的 `http.get/post/put/del` 路径，与 mock 路由表 + 资源表 + 写操作表比对），列出未覆盖的端点。当前项目已补齐到 0 缺口。
