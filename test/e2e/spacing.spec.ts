import { expect, test, type Page } from '@playwright/test'

/**
 * 内容区间距 / 滚动条 / 模块撑满 —— 回归用例。
 *
 * 这四条都只有真实渲染才暴露（依赖 flex 计算 + `:has()` 选择器），单测覆盖不到：
 *  1. 内容区四周留白统一 12px（曾经是 .wb-app-main 16px + .wb-page 16px 叠加成 32px）
 *  2. 窗口与内容区永不出现滚动条
 *  3. 模块撑满到内容区底边（高矮窗口都成立）
 *  4. 超高内容在模块内部滚动 —— 表格要表头固定、分页固定、表体自己滚
 */
const PAD = 12

/** 列表页 / 分栏页 / 内容流页各取一个代表 */
const PAGES = ['/system/user', '/system/post', '/system/dict', '/tool/gen', '/index', '/profile']

async function login(page: Page): Promise<void> {
  await page.goto('/login')
  await page.locator('input[type="text"]').first().fill('admin')
  await page.locator('input[type="password"]').first().fill('admin123')
  await page.getByRole('button', { name: /登\s*录/ }).click()
  await page.waitForURL(/\/(index)?/, { timeout: 15000 })
}

async function open(page: Page, path: string): Promise<void> {
  await page.goto(path)
  await expect(page.locator('.wb-page')).toBeVisible({ timeout: 15000 })
  await page.waitForTimeout(1200)
}

function metrics(page: Page) {
  return page.evaluate(() => {
    const box = (el: Element) => el.getBoundingClientRect()
    const main = document.querySelector('.wb-app-main') as HTMLElement
    const pageEl = document.querySelector('.wb-page') as HTMLElement
    const sidebar = document.querySelector('.wb-layout__sidebar')
    const tags = document.querySelector('.wb-tags')
    const cards = [...pageEl.querySelectorAll('.wb-card')]
    const first = cards[0]
    const mb = box(main)

    // 滚到底再看底边，滚动页与非滚动页用同一套判定
    const prev = pageEl.scrollTop
    pageEl.scrollTop = pageEl.scrollHeight
    const ps = getComputedStyle(pageEl)
    const contentBottom = box(pageEl).bottom - parseFloat(ps.paddingBottom)
    const lastBottom = Math.max(...cards.map((c) => box(c).bottom))
    pageEl.scrollTop = prev

    const bodyWrap = pageEl.querySelector('.el-table__body-wrapper') as HTMLElement | null
    const innerWrap = pageEl.querySelector('.el-table__body-wrapper .el-scrollbar__wrap') as HTMLElement | null
    const holder = cards.find((c) => c.querySelector('.wb-pro-table')) as HTMLElement | undefined
    const headerWrap = pageEl.querySelector('.el-table__header-wrapper')
    const footer = pageEl.querySelector('.wb-pro-table__footer')
    const chart = pageEl.querySelector('.wb-dashboard__chart')

    return {
      gap: {
        top: +(box(first).top - (tags ? box(tags).bottom : mb.top)).toFixed(2),
        left: +(box(first).left - (sidebar ? box(sidebar).right : mb.left)).toFixed(2),
        right: +(mb.right - Math.max(...cards.map((c) => box(c).right))).toFixed(2),
        bottom: +(lastBottom - contentBottom).toFixed(2)
      },
      docBarY: document.documentElement.scrollHeight > document.documentElement.clientHeight,
      docBarX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      mainBarY: main.scrollHeight > main.clientHeight,
      mainBarX: main.scrollWidth > main.clientWidth,
      pageBarY: pageEl.scrollHeight > pageEl.clientHeight + 1,
      contentBox: { top: box(pageEl).top, bottom: contentBottom },
      cardBottom: +Math.max(...cards.map((c) => box(c).bottom)).toFixed(2),
      table: bodyWrap
        ? {
            bodyH: +box(bodyWrap).height.toFixed(2),
            // 表体真实滚动容器（EP 在 body-wrapper 内再套了一层 scrollbar）
            innerScroll: innerWrap ? innerWrap.scrollHeight - innerWrap.clientHeight : 0,
            rows: pageEl.querySelectorAll('.el-table__body-wrapper tbody tr').length,
            headerTop: headerWrap ? +box(headerWrap).top.toFixed(2) : null,
            bodyTop: +box(bodyWrap).top.toFixed(2),
            holderH: holder ? +box(holder).height.toFixed(2) : null,
            holderBottom: holder ? +box(holder).bottom.toFixed(2) : null,
            footerTop: footer ? +box(footer).top.toFixed(2) : null
          }
        : null,
      chartH: chart ? +box(chart).height.toFixed(2) : null
    }
  })
}

test.describe('内容区间距 / 滚动条 / 模块撑满', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('内容区四周留白统一 12px', async ({ page }) => {
    for (const path of PAGES) {
      await open(page, path)
      const { gap } = await metrics(page)
      expect(Math.abs(gap.top - PAD), `${path} 上留白 ${gap.top}`).toBeLessThanOrEqual(0.5)
      expect(Math.abs(gap.left - PAD), `${path} 左留白 ${gap.left}`).toBeLessThanOrEqual(0.5)
      expect(Math.abs(gap.right - PAD), `${path} 右留白 ${gap.right}`).toBeLessThanOrEqual(0.5)
      // 底部量的是「模块底边 − 内容区底边」，撑满时应当为 0（不是 12）
      expect(Math.abs(gap.bottom), `${path} 底边差 ${gap.bottom}`).toBeLessThanOrEqual(1)
    }
  })

  test('窗口与内容区都不出现滚动条', async ({ page }) => {
    for (const path of PAGES) {
      await open(page, path)
      const m = await metrics(page)
      expect(m.docBarY, `${path} 窗口纵向滚动条`).toBe(false)
      expect(m.docBarX, `${path} 窗口横向滚动条`).toBe(false)
      expect(m.mainBarY, `${path} 内容区纵向滚动条`).toBe(false)
      expect(m.mainBarX, `${path} 内容区横向滚动条`).toBe(false)
    }
  })

  test('模块撑满内容区底边', async ({ page }) => {
    for (const path of PAGES) {
      await open(page, path)
      const m = await metrics(page)
      expect(
        Math.abs(m.cardBottom - m.contentBox.bottom),
        `${path} 模块底边 ${m.cardBottom} vs 内容区底边 ${m.contentBox.bottom}`
      ).toBeLessThanOrEqual(1)
    }
  })

  test('表格在卡片内部滚动：表头与分页固定、表体自己滚', async ({ page }) => {
    for (const path of ['/system/user', '/system/post', '/system/dict']) {
      await open(page, path)
      const t = (await metrics(page)).table
      expect(t, `${path} 应有表格`).not.toBeNull()
      if (!t) continue
      // 表头在滚动区上沿之外（不随表体滚动）
      expect(t.headerTop, `${path} 表头位置`).toBeLessThan(t.bodyTop)
      // 分页贴在卡片底部内边距之内
      expect(
        t.footerTop as number,
        `${path} 分页底 ${(t.footerTop as number) + 32} vs 卡片底 ${(t.holderBottom as number) - PAD}`
      ).toBeLessThanOrEqual((t.holderBottom as number) - PAD + 1)
      // 表格没被压扁
      expect(t.holderH as number, `${path} 表格模块高度`).toBeGreaterThan(400)
    }
  })

  test('矮窗口下超高内容仍在模块内部滚动', async ({ page }) => {
    for (const vp of [
      { width: 1280, height: 620 },
      { width: 1024, height: 520 }
    ]) {
      await page.setViewportSize(vp)
      for (const path of ['/system/user', '/system/post']) {
        await open(page, path)
        const m = await metrics(page)
        const tag = `${vp.width}x${vp.height} ${path}`
        expect(m.docBarY, `${tag} 窗口滚动条`).toBe(false)
        expect(m.mainBarY, `${tag} 内容区滚动条`).toBe(false)
        expect(m.mainBarX, `${tag} 内容区横向滚动条`).toBe(false)
        expect(m.pageBarY, `${tag} 页面容器出现了滚动条`).toBe(false)
        // 行数 × 行高超过表体高度 → 必须在表体内部滚，而不是把卡片顶高
        expect(m.table?.innerScroll, `${tag} 表体内部滚动量`).toBeGreaterThan(0)
      }
    }
  })

  test('工作台图表跟随容器自适应，不撑出滚动条', async ({ page }) => {
    // 两个都放得下的高度：图表应当跟着容器变，而不是写死 300px
    await page.setViewportSize({ width: 1440, height: 1000 })
    await open(page, '/index')
    const tall = await metrics(page)
    expect(tall.chartH as number).toBeGreaterThan(140)
    expect(tall.pageBarY, '1000 高时页面容器不应滚动').toBe(false)

    await page.setViewportSize({ width: 1440, height: 820 })
    await open(page, '/index')
    const short = await metrics(page)
    expect(short.chartH as number).toBeLessThan(tall.chartH as number)
    expect(short.chartH as number).toBeGreaterThanOrEqual(140)
    expect(short.docBarY).toBe(false)
    expect(short.mainBarY).toBe(false)
    expect(short.pageBarY, '820 高时页面容器不应滚动').toBe(false)
  })
})
