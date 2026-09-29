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
})
