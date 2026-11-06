import { expect, test } from '@playwright/test'

/**
 * CRUD 示例的表单里挂了一个自定义 slot 字段（富文本说明，md-editor-v3）。
 *
 * 这条用例守的是「组件在 setup 阶段就抛错、整块静默消失」这类失败：
 * 页面上只剩一个空的表单项，控制台之外没有任何提示，功能却已经没了。
 * 所以断言必须落在**渲染出来的 DOM**（编辑器节点与高度）和**提交的数据**（description）上，
 * 只断言「弹窗能打开」「表单项存在」是抓不住的 —— 它们原本就是通过的。
 */
test.describe('CRUD 示例 · 表单富文本字段', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.locator('input[type="text"]').first().fill('admin')
    await page.locator('input[type="password"]').first().fill('admin123')
    await page.getByRole('button', { name: /登\s*录/ }).click()
    await page.waitForURL(/\/(index)?/, { timeout: 15000 })
    await page.goto('/demo/crud')
    await expect(page.locator('.el-table')).toBeVisible({ timeout: 10000 })
  })

  test('富文本编辑器能渲染出来，输入的内容随表单一起提交', async ({ page }) => {
    await page
      .getByRole('button', { name: /新\s*增/ })
      .first()
      .click()

    const dialog = page.locator('.el-dialog')
    await expect(dialog).toBeVisible()

    const editor = dialog.locator('.md-editor')
    await expect(editor).toBeVisible()
    // 高度是显式传进去的 320px：写死成 0 或者只剩一个空壳都会被这一条抓住
    const box = await editor.boundingBox()
    expect(box?.height ?? 0).toBeGreaterThan(200)
    // 工具栏渲染出来说明组件真正挂载了（只留一个空 div 时这里是 0）
    expect(await editor.locator('.md-editor-toolbar-item').count()).toBeGreaterThan(10)

    await dialog
      .locator('.el-form-item')
      .filter({ hasText: '商品名称' })
      .locator('input')
      .fill('富文本用例')
    await dialog.locator('.el-form-item').filter({ hasText: '价格' }).locator('input').fill('10')

    const input = editor.locator('.cm-content').first()
    await input.click()
    await page.keyboard.type('**粗体** 说明文字')
    await expect(input).toContainText('说明文字')

    const reqPromise = page.waitForRequest(
      (r) => r.url().endsWith('/api/demo') && r.method() === 'POST',
      { timeout: 8000 }
    )
    await dialog
      .locator('.el-dialog__footer')
      .getByRole('button', { name: /确\s*定/ })
      .click()
    const req = await reqPromise

    // v-model 绑的是 slot 传下来的 model.description，回写得通不通就看这里
    const payload = JSON.parse(req.postData() || '{}')
    expect(payload.description).toContain('说明文字')
  })
})
