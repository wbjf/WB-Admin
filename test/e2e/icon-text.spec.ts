import { expect, test, type Page } from '@playwright/test'

/**
 * 「图标 + 文字」的排版规范回归 —— 两处缺陷都源自 Element Plus 的**相邻兄弟选择器**
 * 在当前 DOM 结构下不匹配，静态看代码看不出来，只有真实渲染量几何才暴露。
 *
 * 1. 按钮内图标与文字贴在一起（间距 0）。
 *    EP 给这段间距写的是 `.el-button [class*=el-icon] + span { margin-left: 6px }`，
 *    它要求图标是那层 `<span>` 的**兄弟**。用 `:icon` prop 时确实如此；
 *    但用 slot 手写图标时，图标落在 EP 自动包的 `<span>` 内部，相邻兄弟成了文本节点，
 *    于是规则不匹配 —— 同一条工具条上「上传文件」6px、「新建文件夹」「删除」0px。
 *    修法是给那层本就 inline-flex 的 span 加 gap。
 *
 * 2. 单选按钮（列表/网格）里的图标偏高、且与文字贴在一起。
 *    EP 对这里的图标间距写的是 `[class*=el-icon-] + span`，选择器末尾多了个短横线，
 *    只匹配 `el-icon-xxx` 形式的 class，而图标渲染出来的 class 就是 `el-icon` → 恒不生效。
 *    垂直方向则因为图标是 inline-flex 且 vertical-align 默认 baseline，
 *    1em 方盒底边贴在文字基线上，而中文字形视觉中心在基线上方约 0.44em → 整体偏高 1.5px。
 *
 * 断言口径：
 *   - 水平：图标**右边缘**到文字**左边缘**的实测间隙（用 Range.getClientRects 取文字渲染盒，
 *     不是元素盒 —— inline-flex 容器里文字不是整个内容盒）。
 *   - 垂直：图标中心与文字渲染盒中心的偏差，|差值| ≤ 1px。
 *   - 兜底：容器高度不得改变（曾经用 inline-flex 居中把单选按钮从 32px 压成 30px）。
 */

async function login(page: Page): Promise<void> {
  await page.goto('/login')
  await page.locator('input[type="text"]').first().fill('admin')
  await page.locator('input[type="password"]').first().fill('admin123')
  await page.getByRole('button', { name: /登\s*录/ }).click()
  await page.waitForURL(/\/(index)?/, { timeout: 15000 })
}

test.describe('图标与文字的排版', () => {
  test('按钮内「图标 → 文字」的间距处处一致，且按钮高度不受影响', async ({ page }) => {
    await login(page)
    await page.goto('/tool/file')
    await expect(page.locator('.wb-tool-file__bar')).toBeVisible({ timeout: 10000 })
    await page.waitForTimeout(600)

    const m = await page.evaluate(() => {
      const textBox = (el: Element) => {
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
        const rects: DOMRect[] = []
        let n: Node | null
        while ((n = walker.nextNode())) {
          if (!(n.textContent || '').trim()) continue
          const range = document.createRange()
          range.selectNodeContents(n)
          for (const r of range.getClientRects()) if (r.width > 0) rects.push(r as DOMRect)
        }
        if (!rects.length) return null
        return {
          left: Math.min(...rects.map((r) => r.left)),
          right: Math.max(...rects.map((r) => r.right))
        }
      }
      const pick = (label: string) => {
        const btn = [...document.querySelectorAll('.el-button')].find((b) =>
          (b.textContent || '').replace(/\s+/g, '').includes(label)
        )
        if (!btn) return { label, missing: true }
        const raw = btn.querySelector('.el-icon, svg')
        if (!raw) return { label, noIcon: true }
        const icon = raw.tagName.toLowerCase() === 'svg' ? raw.closest('.el-icon')! : raw
        const ir = icon.getBoundingClientRect()
        const t = textBox(btn)
        const br = btn.getBoundingClientRect()
        return {
          label,
          gap: t ? +(t.left - ir.right).toFixed(2) : null,
          iconW: +ir.width.toFixed(2),
          iconH: +ir.height.toFixed(2),
          btnH: +br.height.toFixed(2)
        }
      }
      return ['上传文件', '新建文件夹', '删除'].map(pick)
    })

    const found = m.filter((x) => !('missing' in x) && !('noIcon' in x))
    expect(found.length, `三个按钮都应找到图标：${JSON.stringify(m)}`).toBe(3)

    // 图标必须是正方形（曾出现过顶栏图标被压成 7×17 的情况，这里一并守住）
    for (const x of found as { label: string; iconW: number; iconH: number; btnH: number }[]) {
      expect(Math.abs(x.iconW - x.iconH), `${x.label} 图标非正方形 ${x.iconW}x${x.iconH}`).toBeLessThanOrEqual(1)
    }

    /*
     * 核心断言：三个按钮的 gap 必须一致。
     * 缺陷版本是 [6, 0, 0] —— 用 `:icon` prop 的那个有间距、slot 写法的两个没有。
     */
    const gaps = (found as { label: string; gap: number }[]).map((x) => x.gap)
    expect(gaps.every((g) => g !== null), `gap 未能测出：${JSON.stringify(found)}`).toBe(true)
    for (const x of found as { label: string; gap: number }[]) {
      expect(x.gap, `「${x.label}」图标与文字间距 ${x.gap}px（应为 6px 上下）`).toBeGreaterThanOrEqual(5)
      expect(x.gap, `「${x.label}」图标与文字间距 ${x.gap}px（应为 6px 上下）`).toBeLessThanOrEqual(7)
    }
    const uniq = [...new Set(gaps.map((g) => Math.round(g as number)))]
    expect(uniq.length, `三个按钮间距取值不唯一：${JSON.stringify(gaps)}`).toBe(1)

    // 高度不能因为加了 gap 而变（按钮都是 default 档 = 32px）
    const heights = [...new Set((found as { btnH: number }[]).map((x) => Math.round(x.btnH)))]
    expect(heights.length, `按钮高度参差：${JSON.stringify(heights)}`).toBe(1)
  })

  test('单选按钮里图标与文字垂直居中、有间距，且按钮高度不变', async ({ page }) => {
    await login(page)
    await page.goto('/tool/file')
    await expect(page.locator('.el-radio-group').first()).toBeVisible({ timeout: 10000 })
    await page.waitForTimeout(600)

    const m = await page.evaluate(() => {
      const textBox = (el: Element) => {
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
        const rects: DOMRect[] = []
        let n: Node | null
        while ((n = walker.nextNode())) {
          if (!(n.textContent || '').trim()) continue
          const range = document.createRange()
          range.selectNodeContents(n)
          for (const r of range.getClientRects()) if (r.width > 0) rects.push(r as DOMRect)
        }
        if (!rects.length) return null
        const left = Math.min(...rects.map((r) => r.left))
        const right = Math.max(...rects.map((r) => r.right))
        const top = Math.min(...rects.map((r) => r.top))
        const bottom = Math.max(...rects.map((r) => r.bottom))
        return { left, right, top, bottom, cy: (top + bottom) / 2 }
      }
      return [...document.querySelectorAll('.el-radio-button')].map((label) => {
        const inner = label.querySelector('.el-radio-button__inner') as HTMLElement
        if (!inner) return { missing: true }
        const raw = inner.querySelector('.el-icon, svg')
        const icon = raw
          ? raw.tagName.toLowerCase() === 'svg'
            ? raw.closest('.el-icon')!
            : raw
          : null
        const ir = icon ? icon.getBoundingClientRect() : null
        const t = textBox(inner)
        const br = inner.getBoundingClientRect()
        return {
          text: (inner.textContent || '').trim(),
          innerH: +br.height.toFixed(2),
          iconH: ir ? +ir.height.toFixed(2) : 0,
          gap: ir && t ? +(t.left - ir.right).toFixed(2) : null,
          dyCenter: ir && t ? +((ir.top + ir.bottom) / 2 - t.cy).toFixed(2) : null
        }
      })
    })

    const found = m.filter((x) => !('missing' in x)) as {
      text: string
      innerH: number
      iconH: number
      gap: number
      dyCenter: number
    }[]
    expect(found.length, '未找到单选按钮').toBeGreaterThanOrEqual(2)

    for (const x of found) {
      expect(x.iconH, `「${x.text}」应有图标`).toBeGreaterThan(8)
      // 间距：EP 那条失效选择器给的是 5px
      expect(x.gap, `「${x.text}」图标与文字间距 ${x.gap}px`).toBeGreaterThanOrEqual(4)
      expect(x.gap, `「${x.text}」图标与文字间距 ${x.gap}px`).toBeLessThanOrEqual(6)
      /*
       * 垂直居中：缺陷版本是 -1.5px（图标偏高 —— 图标 1em 方盒底边贴文字基线所致）。
       * 容差 1px 足以区分「已居中（约 -0.1）」与「偏高（约 -1.5）」，
       * 又不会因为字体渲染的亚像素抖动而误报。
       */
      expect(
        Math.abs(x.dyCenter),
        `「${x.text}」图标相对文字中心偏差 ${x.dyCenter}px（已居中应≈0，偏高缺陷约 -1.5）`
      ).toBeLessThanOrEqual(1)
    }

    /*
     * 兜底：单选按钮高度必须仍是 32px。
     * 曾经试过用 `display: inline-flex; align-items: center` 来居中，
     * 结果是 inner 高度从 32 掉到 30（inline-block 时期那 2px 是字体 descent
     * 在基线下方撑出来的行盒空白），同行的普通按钮还是 32px，视觉上矮一截。
     */
    for (const x of found) {
      expect(x.innerH, `「${x.text}」按钮高度 ${x.innerH}px 应为 32px`).toBeGreaterThanOrEqual(31)
      expect(x.innerH, `「${x.text}」按钮高度 ${x.innerH}px 应为 32px`).toBeLessThanOrEqual(33)
    }
    const hs = [...new Set(found.map((x) => Math.round(x.innerH)))]
    expect(hs.length, `单选按钮高度参差：${JSON.stringify(hs)}`).toBe(1)
  })
})
