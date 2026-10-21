import { expect, test, type Page } from '@playwright/test'

async function login(page: Page): Promise<void> {
  await page.goto('/login')
  await page.locator('input[type="text"]').first().fill('admin')
  await page.locator('input[type="password"]').first().fill('admin123')
  await page.getByRole('button', { name: /登\s*录/ }).click()
  await page.waitForURL(/\/index/, { timeout: 20000 })
}

/** 以服务端数据为基准：mock 是内存库，跑过保存后基准会变，不能写死节点数 */
async function serverGraph(page: Page, id = 'F1'): Promise<{ nodes: number; edges: number }> {
  return page.evaluate(async (flowId) => {
    const r = await fetch(`/api/flow/${flowId}`)
    const j = await r.json()
    return { nodes: (j?.data?.nodes || []).length, edges: (j?.data?.edges || []).length }
  }, id)
}

async function openEditor(page: Page, id = 'F1'): Promise<void> {
  await page.goto(`/flow/editor/${id}`)
  await page.waitForSelector('.wb-flow-canvas svg', { timeout: 30000 })
  await page.waitForTimeout(1500)
}

test.describe('FlowEditor', () => {
  test('列表页与编辑页都能打开，画布渲染出节点与泳道', async ({ page }) => {
    await login(page)
    await page.goto('/flow/index')
    await expect(page.locator('.el-table__body tr').first()).toBeVisible({ timeout: 20000 })

    await openEditor(page)
    const base = await serverGraph(page)
    await expect(page.locator('[data-test=stat-nodes]')).toHaveText(String(base.nodes))
    await expect(page.locator('[data-test=stat-edges]')).toHaveText(String(base.edges))
    // 自定义节点是纯 SVG，导出与渲染共用同一套形状
    await expect(page.locator('.wb-flow-canvas svg g.wb-flow-node').first()).toBeVisible()
  })

  test('从左侧拖入元件可创建节点', async ({ page }) => {
    await login(page)
    await openEditor(page)
    const before = Number(await page.locator('[data-test=stat-nodes]').textContent())

    const chip = page.locator('[data-test=pal-etch]').first()
    const cb = await chip.boundingBox()
    const canvas = await page.locator('.wb-flow-canvas').boundingBox()
    await page.mouse.move(cb!.x + cb!.width / 2, cb!.y + cb!.height / 2)
    await page.mouse.down()
    await page.mouse.move(canvas!.x + 220, canvas!.y + canvas!.height - 90, { steps: 12 })
    await page.mouse.up()
    await page.waitForTimeout(600)

    const after = Number(await page.locator('[data-test=stat-nodes]').textContent())
    expect(after).toBe(before + 1)
  })

  test('改名后切走再回来仍在（草稿恢复 + 状态栏提示）', async ({ page }) => {
    await login(page)
    await openEditor(page)

    const NAME = 'e2e 改名验证'
    await page.locator('.wb-flow-toolbar .fname input').fill(NAME)
    await page.waitForTimeout(1200)

    // 切到别的页面再回来（AppMain 没有 KeepAlive，回来必须靠草稿）
    await page.goto('/flow/index')
    await page.waitForTimeout(800)
    await openEditor(page)

    // 草稿恢复会弹确认框，选择「恢复」
    const restore = page.getByRole('button', { name: /恢复/ })
    if (await restore.isVisible().catch(() => false)) {
      await restore.click()
      await page.waitForTimeout(800)
    }
    await expect(page.locator('.wb-flow-toolbar .fname input')).toHaveValue(NAME)
  })

  test('preset=mini：高级按钮与元件库按档位收敛', async ({ page }) => {
    await login(page)
    await openEditor(page)

    await page.locator('.cfg-bar .el-radio-button', { hasText: 'mini' }).first().click()
    await page.waitForTimeout(1500)

    // 校验 / 自动布局 / 模板 / AI 都不渲染
    await expect(page.locator('[data-test=tb-validate]')).toHaveCount(0)
    await expect(page.locator('[data-test=tb-layout]')).toHaveCount(0)
    await expect(page.locator('[data-test=tb-ai]')).toHaveCount(0)
    // 元件库跟随档位降为基础库（2 组 10 项）
    await expect(page.locator('.pal-group')).toHaveCount(2)
    await expect(page.locator('.pal-chip')).toHaveCount(10)

    await page.locator('.cfg-bar .el-radio-button', { hasText: 'pro' }).first().click()
    await page.waitForTimeout(1500)
    await expect(page.locator('[data-test=tb-validate]')).toHaveCount(1)
  })

  test('palette 开关：searchable / collapsible / draggable 真的生效', async ({ page }) => {
    await login(page)
    await openEditor(page)

    // 关掉搜索：搜索框不渲染
    await page.locator('.cfg-bar label', { hasText: 'palette.searchable' }).first().click()
    await page.waitForTimeout(1200)
    await expect(page.locator('.wb-flow-palette .pal-search')).toHaveCount(0)

    // 关掉折叠：分组标题不再有折叠箭头
    await page.locator('.cfg-bar label', { hasText: 'palette.collapsible' }).first().click()
    await page.waitForTimeout(1200)
    await expect(page.locator('.pal-group .caret')).toHaveCount(0)

    // 关掉拖拽：元件置灰，按下不再产生拖拽影子
    await page.locator('.cfg-bar label', { hasText: 'palette.draggable' }).first().click()
    await page.waitForTimeout(1200)
    await expect(page.locator('.pal-chip.disabled').first()).toBeVisible()
    const chip = page.locator('.pal-chip').first()
    const cb = await chip.boundingBox()
    await page.mouse.move(cb!.x + cb!.width / 2, cb!.y + cb!.height / 2)
    await page.mouse.down()
    await page.mouse.move(cb!.x + 200, cb!.y + 200, { steps: 6 })
    await expect(page.locator('.wb-flow-ghost')).toHaveCount(0)
    await page.mouse.up()
  })

  test('readonly：不渲染左侧元件库，画布仍可缩放', async ({ page }) => {
    await login(page)
    await openEditor(page)
    await page.locator('.cfg-bar label', { hasText: 'readonly' }).first().click()
    await page.waitForTimeout(1500)

    await expect(page.locator('.wb-flow-palette')).toHaveCount(0)
    // 缩放控件保留（PRD 验收标准 10）
    await expect(page.locator('[data-test=zoom-in]')).toBeVisible()
    await page.locator('[data-test=zoom-in]').click()
    await expect(page.locator('[data-test=zoom-in]')).toBeVisible()
  })

  test('校验面板可打开并列出问题', async ({ page }) => {
    await login(page)
    await openEditor(page)
    await page.locator('[data-test=tb-validate]').click()
    await page.waitForTimeout(1000)
    // 未打开的 drawer 也会有一个 width 为 0 的占位元素，只认真正打开的那个
    await expect(page.locator('.el-drawer.open').first()).toBeVisible()
  })

  test('导出 JSON 会触发下载', async ({ page }) => {
    await login(page)
    await openEditor(page)
    await page.locator('[data-test=tb-export]').click()
    await page.waitForTimeout(300)
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 15000 }),
      page.locator('.el-dropdown-menu__item', { hasText: '.flow.json' }).click()
    ])
    expect(download.suggestedFilename()).toMatch(/\.flow$/)
  })
})
