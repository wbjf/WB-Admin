import { expect, test, type Page } from '@playwright/test'

/**
 * 对话框表单不出现横向滚动条 —— 回归用例。
 *
 * 根因不在表单本身：`el-row` 的栅格间距是**组件写的内联样式**
 * （`margin-left/right: -gutter/2`），整行因此比容器宽一个 gutter
 * （gutter=12 → 实测溢出 6px）。父容器 overflow 可见时无害，但 ProDialog 的
 * 正文包在 el-scrollbar 里（`overflow: auto` 双向），这 6px 就变成一条横向滚动条
 * —— 真实滚轮横滚能滚到 scrollLeft=6。
 *
 * 修复：`.el-dialog__body .el-row { margin: 0 !important }`（必须 !important，
 * 内联样式优先级高于选择器）。列自身内边距保留，于是内容左右各内缩 6px、对称。
 *
 * 同时必须守住 tool/gen 代码预览的横向滚动 —— 长代码行是**正当需要**横滚的场景，
 * 若改成「给滚动容器 overflow-x: hidden」就会把它静默裁掉。
 */

const DIALOG_PAGES = [
  '/system/tenant',
  '/system/user',
  '/system/menu',
  '/system/dict',
  '/system/role',
  '/system/post',
  '/system/notice',
  '/system/dept',
  '/system/config'
]

const BODY_WRAP = '.el-dialog__body .el-scrollbar__wrap'
const GEN_WRAP = '.wb-tool-gen__tabs .el-scrollbar__wrap'

async function login(page: Page): Promise<void> {
  await page.goto('/login')
  await page.locator('input[type="text"]').first().fill('admin')
  await page.locator('input[type="password"]').first().fill('admin123')
  await page.getByRole('button', { name: /登\s*录/ }).click()
  await page.waitForURL(/\/(index)?/, { timeout: 15000 })
}

/** 打开页面并点开「新增」对话框，返回是否成功打开 */
async function openDialog(page: Page, path: string): Promise<boolean> {
  await page.goto(path)
  await expect(page.locator('.wb-page')).toBeVisible({ timeout: 15000 })
  await page.waitForTimeout(900)
  // 同名按钮可能有隐藏副本，必须挑可见的那个
  const btn = page.locator('.wb-card button:visible').filter({ hasText: /新增/ }).first()
  if (!(await btn.count())) return false
  await btn.click()
  await page.waitForTimeout(1100)
  return page.locator('.el-dialog').first().isVisible()
}

function dialogMetrics(page: Page) {
  return page.evaluate((sel) => {
    const wrap = document.querySelector(sel) as HTMLElement | null
    if (!wrap) return null
    const wr = wrap.getBoundingClientRect()
    wrap.scrollLeft = 0

    // 内容超出多少
    let over = 0
    for (const el of wrap.querySelectorAll('*')) {
      const b = el.getBoundingClientRect()
      if (!b.width || !b.height) continue
      if (b.right - wr.right > over) over = b.right - wr.right
    }
    // 有没有可见控件被容器裁掉
    let clipped = 0
    for (const c of wrap.querySelectorAll(
      'input, textarea, .el-input, .el-select, .el-radio-group, .el-checkbox-group, .el-date-editor, .el-button'
    )) {
      const b = c.getBoundingClientRect()
      if (!b.width) continue
      if (b.right > wr.right + 0.5) clipped++
    }
    return {
      overflowX: getComputedStyle(wrap).overflowX,
      overflowY: getComputedStyle(wrap).overflowY,
      sw: wrap.scrollWidth,
      cw: wrap.clientWidth,
      over: +over.toFixed(2),
      clipped
    }
  }, BODY_WRAP)
}

/** 用真实滚轮横向滚 140px，返回容器最终 scrollLeft（0 = 滚不动） */
async function wheelScrollX(page: Page, sel: string): Promise<number> {
  await page.evaluate((s) => {
    const w = document.querySelector(s) as HTMLElement | null
    if (w) w.scrollLeft = 0
  }, sel)
  const box = await page.locator(sel).first().boundingBox()
  if (!box) return -1
  await page.mouse.move(box.x + box.width / 2, box.y + Math.min(box.height / 2, 60))
  await page.mouse.wheel(140, 0)
  await page.waitForTimeout(400)
  return page.evaluate((s) => (document.querySelector(s) as HTMLElement | null)?.scrollLeft ?? -1, sel)
}

test.describe('对话框表单：不出现横向滚动条', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('九个表单对话框都没有横向溢出，也没有控件被裁', async ({ page }) => {
    // 本用例要顺序跑 9 个页面：固定等待就有 9 × (900 + 1100 + 400) = 21.6s，
    // 再加 9 次导航，CI runner 上会超过全局 30s 预算（实测 30.2s 超时）。
    // 这是测试预算问题，不是产品缺陷 —— 单独放宽，不动全局值。
    test.setTimeout(90_000)
    for (const path of DIALOG_PAGES) {
      expect(await openDialog(page, path), `${path} 应能打开新增对话框`).toBe(true)
      const m = await dialogMetrics(page)
      expect(m, `${path} 应找到对话框正文滚动容器`).not.toBeNull()
      if (!m) continue
      // 栅格负外边距已归零：内容不比容器宽
      expect(m.over, `${path} 内容横向溢出 ${m.over}px`).toBeLessThanOrEqual(0.5)
      expect(m.sw, `${path} scrollWidth ${m.sw} vs clientWidth ${m.cw}`).toBe(m.cw)
      expect(m.clipped, `${path} 有 ${m.clipped} 个控件被裁`).toBe(0)
      // 纵向滚动能力保留（长表单照旧能滚）
      expect(['auto', 'scroll'], `${path} overflowY`).toContain(m.overflowY)
      await page.keyboard.press('Escape')
      await page.waitForTimeout(400)
    }
  })

  test('真实滚轮无法横向滚动表单', async ({ page }) => {
    for (const path of ['/system/tenant', '/system/user', '/system/post']) {
      expect(await openDialog(page, path), `${path} 应能打开新增对话框`).toBe(true)
      expect(await wheelScrollX(page, BODY_WRAP), `${path} 滚轮横滚后不应位移`).toBe(0)
      await page.keyboard.press('Escape')
      await page.waitForTimeout(400)
    }
  })

  test('代码预览的横向滚动仍然可用（未被本次修复误伤）', async ({ page }) => {
    await page.goto('/tool/gen')
    await expect(page.locator('.wb-page')).toBeVisible({ timeout: 15000 })
    await page.waitForTimeout(1200)
    const btn = page.locator('.el-table button:visible').filter({ hasText: /代码预览/ }).first()
    expect(await btn.count(), '代码预览按钮应可见').toBeGreaterThan(0)
    await btn.click()
    await page.waitForTimeout(1500)

    const pre = page.locator('.wb-tool-gen__pre').first()
    await expect(pre).toBeVisible({ timeout: 10000 })
    // 长代码行必须真的超宽（否则这个用例测不到东西）
    const sizes = await pre.evaluate((el) => ({ sw: el.scrollWidth, cw: el.clientWidth }))
    expect(sizes.sw, '预览代码应存在超宽长行').toBeGreaterThan(sizes.cw)

    const wrap = page.locator(GEN_WRAP).first()
    expect(await wrap.evaluate((el) => getComputedStyle(el).overflowX)).toBe('auto')
    expect(await wheelScrollX(page, GEN_WRAP), '代码预览应能被滚轮横向滚动').toBeGreaterThan(0)
  })
})
