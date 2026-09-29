import { expect, test } from '@playwright/test'

/**
 * 主链路冒烟：登录 → 菜单 → 列表查询 → 打开表单 → 退出
 * 依赖 .env.development 的 VITE_USE_MOCK=true
 */
test.describe('WB-Admin 主链路', () => {
  test('登录后进入首页并渲染菜单', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })

    await page.goto('/login')
    await expect(page.getByRole('button', { name: /登\s*录/ })).toBeVisible()

    await page.locator('input[type="text"]').first().fill('admin')
    await page.locator('input[type="password"]').first().fill('admin123')
    await page.getByRole('button', { name: /登\s*录/ }).click()

    await page.waitForURL(/\/(index)?/, { timeout: 15000 })
    await expect(page.locator('body')).toContainText(/系统管理|WB-Admin/)

    expect(errors.filter((e) => !e.includes('favicon') && !e.includes('net::ERR')).length).toBe(0)
  })

  test('用户管理列表可查询并打开新增弹窗', async ({ page }) => {
    await page.goto('/login')
    await page.locator('input[type="text"]').first().fill('admin')
    await page.locator('input[type="password"]').first().fill('admin123')
    await page.getByRole('button', { name: /登\s*录/ }).click()
    await page.waitForURL(/\/(index)?/, { timeout: 15000 })

    await page.goto('/system/user')
    await expect(page.locator('.el-table')).toBeVisible({ timeout: 10000 })

    await page.getByRole('button', { name: /新\s*增/ }).first().click()
    await expect(page.locator('.el-dialog')).toBeVisible()
    await expect(page.locator('.el-dialog')).toContainText(/用户名称|用户昵称/)
  })

  test('切换语言后界面文案变为英文', async ({ page }) => {
    await page.goto('/login')
    // 登录页右上角按钮上的文案是「下一个语言」：中文环境下就是 English，
    // 所以这里点的是 English 而不是「简体中文」（写错会让用例永远超时）。
    await page.getByRole('button', { name: 'English' }).click()
    await expect(page.locator('body')).toContainText(/Sign in|WB-Admin Console/)
  })

  /**
   * 回归：老会话点新菜单被挡在 403。
   *
   * `permissions` 与 `userId` 都在 persist.pick 里，也就是会被持久化。
   * 守卫原先只判 `!userStore.userId`，刷新页面时这两个字段「有值、但可能是上次会话的旧快照」，
   * 于是整个「拉取用户信息」分支被跳过、全程不请求 getInfo ——
   * 后端新增的权限点在本机永远拿不到，点进去就是「403 抱歉，你没有访问权限」，
   * 而且**刷新、清缓存都没用，只有退出重登才能恢复**（实测就是这么被发现的）。
   *
   * 这里用一份「不含 demo:dialog:list 的旧权限快照」模拟老用户，断言页面能正常打开。
   */
  test('持久化里的旧权限快照不会把新菜单挡在 403', async ({ page }) => {
    const infoCalls: string[] = []
    page.on('request', (r) => {
      if (r.url().includes('/getInfo')) infoCalls.push(r.url())
    })

    // 先落地一次站点，才能往同源下写 localStorage
    await page.goto('/login')
    await page.evaluate(() => {
      localStorage.setItem(
        'wb-admin-user',
        JSON.stringify({
          userId: '1',
          userName: 'admin',
          nickName: '超级管理员',
          roles: [{ roleId: 2, roleKey: 'common', roleName: '普通角色' }],
          // 关键：这是「新增 demo:dialog:list 之前」那次登录拿到的权限列表。
          // 末尾那个假权限点是「探针」：它只可能来自这份旧快照，后端永远不会下发。
          // 加载完还在 → 说明权限数组根本没被后端的新清单覆盖（即修复失效）。
          permissions: ['system:user:list', 'demo:crud:list', '__stale_probe__'],
          currentRole: 'common',
          isSuperAdmin: false
        })
      )
      localStorage.setItem('wb-admin-token', 'mock-token-stale')
    })

    await page.goto('/demo/dialog')

    await expect(page).not.toHaveURL(/\/403/)
    // 会重定向到 403 时这里必然超时失败，所以这一条就能锁住行为
    await expect(page.locator('.wb-demo-dialog')).toBeVisible({ timeout: 15000 })

    // 断言「真的重新拉过用户信息」。这里刻意不走「数请求次数」：
    // 开发环境的 mock 是 Vite dev server 中间件（会真的发请求），
    // 而 Pages 线上是浏览器内的 axios adapter（**一个请求都不发**），
    // 数请求在两种环境下的答案不同。改断言**可观测的结果**，两边都成立。
    const perms = await page.evaluate(() => {
      const raw = localStorage.getItem('wb-admin-user')
      return raw ? ((JSON.parse(raw).permissions || []) as string[]) : []
    })
    expect(perms).not.toContain('__stale_probe__')
    expect(perms).toContain('demo:dialog:list')

    // 上面那条是主断言；这条只在开发环境有意义，作为额外线索保留
    expect(infoCalls.length).toBeGreaterThan(0)
  })
})
