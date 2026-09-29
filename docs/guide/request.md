# 请求层

封装在 `src/utils/request.ts`，导出 `http.get / post / put / del / request`。

## 统一响应结构

```ts
interface R<T> {
  code: number   // 200 或 0 视为成功
  msg: string
  data: T
}
```

响应拦截器把 `R<T>` 解包成 `T` 直接返回，业务代码拿到的就是 `data`：

```ts
const user = await getUserProfile()   // 类型是 UserInfo，不是 R<UserInfo>
```

## 请求拦截器做了什么

1. 注入 `Authorization: Bearer <token>`
2. 注入 `X-Tenant-Id`
3. 注入 `Accept-Language`
4. **pending 去重**：相同 method + url + 参数的请求在途时，后到的直接复用第一个的 Promise
5. 挂载 `AbortController`，支持按 URL 取消

## 响应拦截器做了什么

1. 解包 `R<T>`；`code` 非 200/0 时 `ElMessage.error(msg)` 并 reject
2. **401 静默刷新**：用 refresh token 换新的 access token，期间并发的请求进队列，刷新完成后统一重放
3. 失败重试：网络错误 / 5xx 按指数退避重试（可通过 `meta` 关闭）
4. 路由切换时 `clearPending()` 取消在途请求

## 自定义单次请求行为

通过 `meta` 传递：

```ts
http.get('/xxx', params, {
  meta: {
    showError: false,    // 不弹错误 toast，自己处理
    showLoading: true,   // 走全局 loading
    retry: 0,            // 不重试
    cancelable: false    // 不允许被路由切换取消
  }
} as any)
```

## 文件下载

`src/utils/download.ts`：

```ts
await download('/system/user/export', params, '用户列表.xlsx')
```

关键点：**下载是 blob 响应，后端报错时返回的其实是一个 JSON**。所以下载函数会先尝试按 JSON 解析，能解析出 `code` 就当错误处理，只有当真不是 JSON 时才走保存文件。否则用户会下载到一个名为 `用户列表.xlsx` 的错误 JSON。

## 取消请求

```ts
import { clearPending } from '@/utils/request'

clearPending()                       // 取消全部
clearPending('/system/user/list')    // 取消指定
```

主动取消产生的 `CanceledError` 会被全局 `unhandledrejection` 处理器静默掉，不污染控制台。
