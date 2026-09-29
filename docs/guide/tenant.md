# 多租户

多租户是「一套系统服务多个客户/组织」的能力。WB-Admin 在**前端这一侧**做了三件事：选租户、带租户上下文、按租户隔离展示。

## 开关

```ini
# .env.development
VITE_ENABLE_TENANT=true
```

关闭后：登录页不显示租户下拉、侧栏隐藏「租户管理」、请求头不带 `X-Tenant-Id`。

## 租户上下文如何传递

登录时选择租户 → `tenantStore.setTenant(id)` → 写 `localStorage` + cookie → 请求拦截器每次自动带上：

```ts
// src/utils/request.ts
config.headers['X-Tenant-Id'] = getTenantId()
```

**业务代码不需要、也不应该在每次请求里手动传租户 ID。** 漏传一次就是一个越权风险，交给拦截器统一处理。

## store

```ts
const tenantStore = useTenantStore()

tenantStore.enabled      // 是否启用
tenantStore.tenants      // 租户列表
tenantStore.currentId    // 当前租户
tenantStore.setTenant(id)
```

## 切换租户

「租户管理」页可以切换当前租户。切换会清空用户态并要求重新拉取路由与字典，避免拿到上一个租户的缓存：

```ts
await userStore.logout()
await tenantStore.setTenant(id)
permStore.resetRoute()
router.replace('/login')
```

## 超管视角

租户列表里有一条 `000000`（平台方/默认租户），拥有跨租户查看能力。页面上的租户筛选器对普通租户隐藏。

## 后端要配合什么

1. 所有业务表带 `tenant_id` 字段。
2. 从 `X-Tenant-Id` 解析租户并自动拼到查询条件（MyBatis 拦截器 / JPA Filter）。
3. `000000` 视为平台方，跳过租户过滤。

> 前端只负责「带得上、切得动、看得对」，真正的隔离必须在后端做。前端的租户隔离只是体验，不是安全边界。
