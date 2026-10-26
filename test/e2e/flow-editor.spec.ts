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

  /**
   * 配置写在代码里（editor.vue 的 editorConfig = { preset: 'pro' }），
   * 页面没有开关条 —— 这里验证「代码里的配置」真的渲染出来了。
   */
  test('代码配置生效：pro 档渲染出高级按钮与半导体元件库', async ({ page }) => {
    await login(page)
    await openEditor(page)

    await expect(page.locator('[data-test=flow-editor]')).toHaveAttribute('data-preset', 'pro')
    // pro 档才有的：校验 / 自动布局 / 模板 / 版本 / 分享
    for (const action of ['validate', 'layout', 'template', 'version', 'share']) {
      await expect(page.locator(`[data-test=tb-${action}]`)).toHaveCount(1)
    }
    // 半导体库 4 组（工序 / 设备 / 判定 / 物料）
    await expect(page.locator('.pal-group')).toHaveCount(4)
  })

  /** 只读走 URL 参数（只读分享场景），页面本身没有开关 */
  test('readonly：不渲染左侧元件库，画布仍可缩放', async ({ page }) => {
    await login(page)
    await page.goto('/flow/editor/F1?readonly=1')
    await page.waitForSelector('.wb-flow-canvas svg', { timeout: 30000 })
    await page.waitForTimeout(1500)

    await expect(page.locator('.wb-flow-palette')).toHaveCount(0)
    // 缩放控件保留（PRD 验收标准 10）
    await expect(page.locator('[data-test=zoom-in]')).toBeVisible()
    await page.locator('[data-test=zoom-in]').click()
    await expect(page.locator('[data-test=zoom-in]')).toBeVisible()
  })

  test('工具条左侧的「返回列表」能回到列表页', async ({ page }) => {
    await login(page)
    await openEditor(page)
    const back = page.locator('[data-test=flow-back]')
    await expect(back).toBeVisible()
    await back.click()
    await page.waitForURL(/\/flow\/index/, { timeout: 10000 })
    await expect(page.locator('.el-table__body tr').first()).toBeVisible({ timeout: 20000 })
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

  /**
   * 回归：「边距太大了」——页面容器自己又加了一层 padding，四周留白变成 24px。
   * 口径是与标准页（demo/crud）对齐：内容区留白只由 .wb-app-main 提供一次。
   */
  test('编辑页留白与标准页一致', async ({ page }) => {
    await login(page)

    // 基准：标准页第一块卡片相对内容区（去掉 padding 后）的偏移
    await page.goto('/demo/crud')
    await expect(page.locator('.wb-page').first()).toBeVisible({ timeout: 20000 })
    await page.waitForTimeout(600)
    const base = await page.evaluate(() => {
      const m = document.querySelector('.wb-app-main')!
      const cs = getComputedStyle(m)
      const r = m.getBoundingClientRect()
      const first = document.querySelector('.wb-page')!.firstElementChild!.getBoundingClientRect()
      return {
        left: Math.round(first.x - (r.x + parseFloat(cs.paddingLeft))),
        top: Math.round(first.y - (r.y + parseFloat(cs.paddingTop)))
      }
    })

    await openEditor(page)
    const ed = await page.evaluate(() => {
      const m = document.querySelector('.wb-app-main')!
      const cs = getComputedStyle(m)
      const r = m.getBoundingClientRect()
      const inner = {
        x: r.x + parseFloat(cs.paddingLeft),
        y: r.y + parseFloat(cs.paddingTop),
        right: r.right - parseFloat(cs.paddingRight),
        bottom: r.bottom - parseFloat(cs.paddingBottom)
      }
      const pageEl = document.querySelector('.wb-page') as HTMLElement
      const flow = document.querySelector('.wb-flow')!.getBoundingClientRect()
      return {
        pagePad: getComputedStyle(pageEl).padding,
        flowTop: Math.round(flow.y - inner.y),
        flowLeft: Math.round(flow.x - inner.x),
        flowRight: Math.round(inner.right - flow.right),
        flowBottom: Math.round(inner.bottom - flow.bottom),
        overflow: pageEl.scrollHeight - pageEl.clientHeight
      }
    })

    expect(ed.pagePad, '页面容器不应再有 padding').toBe('0px')
    expect(ed.flowLeft).toBe(base.left)
    expect(ed.flowTop).toBe(base.top)
    // 画布左右与标准页同宽，并且竖向吃满剩余高度（不再靠 calc(100vh - 220px) 猜）
    expect(ed.flowLeft).toBe(base.left)
    expect(ed.flowRight).toBe(base.left)
    expect(Math.abs(ed.flowBottom)).toBeLessThanOrEqual(1)
    expect(ed.overflow).toBeLessThanOrEqual(1)
  })
})
