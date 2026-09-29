import { expect, test, type Page } from '@playwright/test'

/**
 * 布局回归：两处只有真实渲染才暴露的缺陷（栅格宽度 + flex 计算，单测覆盖不到）。
 *
 * 1. 查询栏按钮组——原来是 el-col 里直接放按钮：既没有 label 缩进（贴着卡片左边缘），
 *    又用 align-items: flex-start 顶对齐，导致 20px 高的「展开」link 按钮比 32px 的
 *    按钮中心高 6px。现改为包一层无 label 的 el-form-item：EP 会给内容区加
 *    margin-left = labelWidth 实现左对齐，内容区自带 align-items: center 实现居中。
 * 2. 用户管理左侧部门树卡片——el-col 已被 el-row 撑到列高，但卡片高度仍是 auto，
 *    于是背景块只有内容那么高。现用 .wb-card--fill 撑满、树区 flex:1 内部滚动。
 */
async function login(page: Page): Promise<void> {
  await page.goto('/login')
  await page.locator('input[type="text"]').first().fill('admin')
  await page.locator('input[type="password"]').first().fill('admin123')
  await page.getByRole('button', { name: /登\s*录/ }).click()
  await page.waitForURL(/\/(index)?/, { timeout: 15000 })
}

test.describe('布局细节', () => {
  test('查询栏按钮组与输入框左对齐、行内垂直居中', async ({ page }) => {
    await login(page)
    await page.goto('/system/user')
    await expect(page.locator('.el-table')).toBeVisible({ timeout: 10000 })

    const m = await page.evaluate(() => {
      const actions = document.querySelector('.wb-search-form__actions') as HTMLElement
      const content = actions.querySelector('.el-form-item__content') as HTMLElement
      const label = document.querySelector('.wb-search-form .el-form-item__label') as HTMLElement
      const input = document.querySelector(
        '.wb-search-form .el-form-item__content .el-input'
      ) as HTMLElement
      const btns = [...actions.querySelectorAll('button')]
      const contentBox = content.getBoundingClientRect()
      const box = (el: Element) => {
        const r = el.getBoundingClientRect()
        return { left: r.left, cy: r.top + r.height / 2, h: r.height }
      }
      return {
        contentMarginLeft: parseFloat(getComputedStyle(content).marginLeft),
        labelWidth: label.getBoundingClientRect().width,
        btnLeft: box(btns[0]).left,
        inputLeft: box(input).left,
        centers: btns.map((b) => box(b).cy),
        contentCenter: contentBox.top + contentBox.height / 2
      }
    })

    // 不再贴边：缩进等于查询条件下的 label 宽度，且与输入框左边缘对齐
    expect(Math.abs(m.contentMarginLeft - m.labelWidth)).toBeLessThanOrEqual(1)
    expect(Math.abs(m.btnLeft - m.inputLeft)).toBeLessThanOrEqual(1)

    // 行内按钮中心一致（不会折行），并相对按钮行垂直居中
    const spread = Math.max(...m.centers) - Math.min(...m.centers)
    expect(spread, `按钮中心离散 ${spread}px`).toBeLessThanOrEqual(1)
    expect(Math.abs(m.centers[0] - m.contentCenter)).toBeLessThanOrEqual(1)
  })

  test('查询条件较少的页面按钮组不折行、不超出所在列', async ({ page }) => {
    await login(page)
    for (const path of ['/system/post', '/system/dept', '/tool/gen']) {
      await page.goto(path)
      await expect(page.locator('.wb-search-form')).toBeVisible({ timeout: 10000 })

      const m = await page.evaluate(() => {
        const actions = document.querySelector('.wb-search-form__actions') as HTMLElement
        const btns = [...actions.querySelectorAll('button')]
        const col = actions.getBoundingClientRect()
        const last = btns[btns.length - 1].getBoundingClientRect()
        return {
          count: btns.length,
          centers: btns.map((b) => {
            const r = b.getBoundingClientRect()
            return r.top + r.height / 2
          }),
          rowHeight: col.height,
          lastRight: last.right,
          colRight: col.right
        }
      })

      const spread = Math.max(...m.centers) - Math.min(...m.centers)
      expect(m.count, `${path} 按钮数量`).toBeGreaterThanOrEqual(2)
      expect(spread, `${path} 按钮中心离散 ${spread}px`).toBeLessThanOrEqual(1)
      // 折行会让这一行高度翻倍（32px 行 → 两个 32px 行）
      expect(m.rowHeight, `${path} 按钮行高度`).toBeLessThan(60)
      expect(m.lastRight, `${path} 按钮组右边界`).toBeLessThanOrEqual(m.colRight + 0.5)
    }
  })

  test('用户管理左侧部门树卡片高度撑满所在列', async ({ page }) => {
    await login(page)
    await page.goto('/system/user')
    await expect(page.locator('.wb-user__tree .el-tree-node')).toHaveCount(6, { timeout: 10000 })

    const m = await page.evaluate(() => {
      const card = document.querySelector('.wb-user .wb-card') as HTMLElement
      const col = document.querySelector('.wb-user .el-row > .el-col') as HTMLElement
      const tree = document.querySelector('.wb-user__tree') as HTMLElement
      return {
        cardH: card.getBoundingClientRect().height,
        colH: col.getBoundingClientRect().height,
        cardDisplay: getComputedStyle(card).display,
        cardBg: getComputedStyle(card).backgroundColor,
        treeH: tree.getBoundingClientRect().height,
        treeOverflowY: getComputedStyle(tree).overflowY
      }
    })

    // 卡片高度 = 所在列高度（背景块撑满，不再是内容高度）
    expect(m.cardH).toBeGreaterThanOrEqual(m.colH - 1)
    expect(m.cardDisplay).toBe('flex')
    // 树区占满卡片剩余空间并在内部滚动
    expect(m.treeOverflowY).toBe('auto')
    expect(m.treeH).toBeGreaterThan(200)
    // 背景块得是不透明底色，否则"撑满"看不出来
    expect(m.cardBg).not.toMatch(/rgba?\(0,\s*0,\s*0,\s*0\)/)
  })
})
