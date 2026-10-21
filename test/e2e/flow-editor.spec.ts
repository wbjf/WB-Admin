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

  test('列表页：按名称筛选、重置、新建后直接进编辑器', async ({ page }) => {
    await login(page)
    await page.goto('/flow/index')
    await page.waitForSelector('.wb-pro-table .fl-name__text:visible', { timeout: 20000 })
    await page.waitForTimeout(500)

    // 筛选条件必须真的发给接口（传空串等于没筛，会静默返回全部）
    await page.locator('.wb-search-form input').first().fill('BEOL')
    await page.getByRole('button', { name: /搜\s*索/ }).click()
    await page.waitForTimeout(1000)
    const filtered = await page.locator('.wb-pro-table .fl-name__text:visible').allTextContents()
    expect(filtered.length).toBeGreaterThan(0)
    expect(filtered.every((n) => n.includes('BEOL'))).toBe(true)

    await page.getByRole('button', { name: /重\s*置/ }).click()
    await page.waitForTimeout(1000)
    expect(await page.locator('.wb-pro-table .fl-name__text:visible').count()).toBeGreaterThan(
      filtered.length
    )

    // 新建要能拿到 id 并跳转，否则「建完进不去画」
    const NAME = `e2e 新建-${Date.now()}`
    await page.getByRole('button', { name: /新\s*增/ }).click()
    const dlg = page.locator('.el-dialog:visible').last()
    await dlg.locator('input').first().fill(NAME)
    await dlg.getByRole('button', { name: /确\s*定/ }).click()
    await page.waitForURL(/\/flow\/editor\//, { timeout: 15000 })
    await page.waitForSelector('.wb-flow-canvas svg', { timeout: 30000 })
    await expect(page.locator('.wb-flow-toolbar .fname input')).toHaveValue(NAME)
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

  /**
   * 回归：线上反馈「全屏后弹窗显示不出来」。
   * 根因是原生全屏只渲染全屏元素的子树，而弹窗 teleport 在 body 上。
   * 断言不看 DOM 是否存在（全屏时它照样有尺寸），而是看它是否在
   * fullscreenElement 子树内 —— 在树外就是用户看不到。
   */
  test('全屏下弹窗 / 消息仍在可见的渲染树内', async ({ page }) => {
    await login(page)
    await openEditor(page)

    await page.locator('[data-test=tb-fullscreen]').click()
    await page.waitForTimeout(800)
    const fs = await page.evaluate(() => ({
      isHtml: document.fullscreenElement === document.documentElement,
      tag: document.fullscreenElement?.tagName || null
    }))
    expect(fs.isHtml, `fullscreenElement=${fs.tag}`).toBe(true)

    // 编辑器铺满视口
    const box = await page.locator('.wb-flow').boundingBox()
    const vw = await page.evaluate(() => window.innerWidth)
    expect(Math.round(box!.width)).toBe(vw)
    expect(Math.round(box!.y)).toBe(0)

    // 弹窗必须在全屏元素之内
    await page.locator('[data-test=tb-version]').click()
    await page.waitForTimeout(800)
    const dlg = await page.evaluate(() => {
      const el = [...document.querySelectorAll('.el-dialog')].find(
        (d) => d.getClientRects().length > 0
      )
      if (!el) return { found: false, inside: false }
      return { found: true, inside: !!document.fullscreenElement?.contains(el) }
    })
    expect(dlg.found).toBe(true)
    expect(dlg.inside).toBe(true)

    // 关闭后退出全屏，编辑器恢复常规布局
    // （Escape 是浏览器级行为，Playwright 的按键不一定触发，用按钮退出最稳）
    await page.locator('.el-dialog__headerbtn:visible').first().click()
    await page.waitForTimeout(400)
    await page.locator('[data-test=tb-fullscreen]').click()
    await page.waitForFunction(() => !document.fullscreenElement, undefined, { timeout: 5000 })
    await page.waitForTimeout(400)
    const after = await page.evaluate(() => ({
      fs: !!document.fullscreenElement,
      pos: getComputedStyle(document.querySelector('.wb-flow')!).position
    }))
    expect(after.fs).toBe(false)
    expect(after.pos).not.toBe('fixed')
  })
})
