import { expect, test, type Page } from '@playwright/test'

/**
 * 侧边栏菜单动效回归。
 *
 * 两个缺陷都只在「动画过程中」才暴露，静态量几何量不出来，所以统一用
 * requestAnimationFrame 逐帧采样：
 *
 * 1. 子菜单展开/收起没有过渡——EP 的折叠过渡走 max-height，而它作用在
 *    子菜单的 ul 上；样式里给 .el-menu 写的 `transition: padding .28s`
 *    会以更高优先级盖掉 EP 给 .el-collapse-transition-*-active 设的过渡，
 *    于是高度一帧跳到位（实测 410 → 12）；同时 ul 的垂直 padding 会被
 *    EP 的过渡先归零再拿去量 scrollHeight，量出的目标高度比真实高度小 16px，
 *    动画收尾 max-height 归位 auto 时内容一下子弹出来。
 * 2. 折叠侧边栏时菜单内容先缩、外框后缩——外框宽度是 0.28s 过渡的，
 *    而 EP 给 .el-menu--collapse 设了固定 64px 宽，内容会在一帧内跳到终态，
 *    动画中途菜单和外框能错开 90px 以上。
 */
async function login(page: Page): Promise<void> {
  await page.goto('/login')
  await page.locator('input[type="text"]').first().fill('admin')
  await page.locator('input[type="password"]').first().fill('admin123')
  await page.getByRole('button', { name: /登\s*录/ }).click()
  await page.waitForURL(/\/(index)?/, { timeout: 15000 })
}

interface SubProbe {
  before: number
  final: number
  settled: number
  frames: { t: number; h: number }[]
  maxStepRatio: number
  stuckFrames: number
  movingFrames: number
}

/**
 * 点一次侧边栏里第一个子菜单的标题，并逐帧采样它的高度。
 *
 * 采样起点在点击之前，所以先记下点击时刻，分析时只用点击之后的帧 ——
 * 点击前的帧高度恒定，会被「停滞」检测误判。
 */
async function probeSubMenu(page: Page): Promise<SubProbe> {
  return await page.evaluate(async () => {
    const sub = document.querySelector('.wb-sidebar .el-sub-menu') as HTMLElement
    const title = sub.querySelector(':scope > .el-sub-menu__title') as HTMLElement
    const inline = sub.querySelector(':scope > .el-menu') as HTMLElement

    const frames: { t: number; h: number }[] = []
    let stop = false
    const t0 = performance.now()
    const tick = () => {
      frames.push({
        t: +(performance.now() - t0).toFixed(1),
        h: +inline.getBoundingClientRect().height.toFixed(2)
      })
      if (!stop) requestAnimationFrame(tick)
    }

    const before = +inline.getBoundingClientRect().height.toFixed(2)
    requestAnimationFrame(tick)
    await new Promise((r) => setTimeout(r, 60))
    const clickAt = +(performance.now() - t0).toFixed(1)
    title.click()
    await new Promise((r) => setTimeout(r, 700))
    stop = true
    const final = +inline.getBoundingClientRect().height.toFixed(2)
    // 动画早已结束，再等一会儿看高度会不会又变（收尾弹跳的特征就是"结束后再跳一次"）
    await new Promise((r) => setTimeout(r, 400))
    const settled = +inline.getBoundingClientRect().height.toFixed(2)

    const after = frames.filter((f) => f.t >= clickAt)
    const hs = after.map((f) => f.h)

    // 跳变特征：单帧变化量接近总变化量（旧版 410 → 12 一帧完成，比值 0.97）
    let maxStep = 0
    for (let i = 1; i < hs.length; i++) {
      maxStep = Math.max(maxStep, Math.abs(hs[i] - hs[i - 1]))
    }
    const total = Math.abs(before - final)

    // 停滞帧：连续保持同一高度、而这个高度又不是最终高度的帧。
    // 旧版过渡的目标高度是 scrollHeight（少了 padding 与首尾 margin），
    // 走完过渡后会在这个偏小的值上停住，直到 max-height 归位 auto 才补跳一下。
    let stuckFrames = 0
    let runLen = 0
    let runVal: number | null = null
    for (const h of hs) {
      if (runVal !== null && Math.abs(h - runVal) < 0.5) {
        runLen++
      } else {
        runVal = h
        runLen = 1
      }
      if (Math.abs(runVal - settled) > 2) {
        stuckFrames = Math.max(stuckFrames, runLen)
      }
    }

    // 真正在「渐变」的证据：处于起始值与终值之间、且相对上一帧确实变了的帧数。
    // 旧版要么一帧跳完、要么停在某个错值上，这个数会接近 0。
    const lo = Math.min(before, final) + 2
    const hi = Math.max(before, final) - 2
    let movingFrames = 0
    for (let i = 1; i < hs.length; i++) {
      if (hs[i] > lo && hs[i] < hi && Math.abs(hs[i] - hs[i - 1]) >= 0.5) movingFrames++
    }

    return {
      before,
      final,
      settled,
      frames: after,
      maxStepRatio: total > 0 ? +(maxStep / total).toFixed(3) : 0,
      stuckFrames,
      movingFrames
    }
  })
}

test.describe('侧边栏菜单动效', () => {
  test('子菜单展开/收起是渐变过渡，不在中途停住', async ({ page }) => {
    await login(page)
    await page.goto('/system/user')
    await expect(page.locator('.wb-sidebar .el-sub-menu').first()).toBeVisible({ timeout: 10000 })
    // 当前路由的用户管理在「系统管理」下，默认是展开的
    await page.waitForTimeout(600)

    // 收起
    const closing = await probeSubMenu(page)
    expect(closing.before, '子菜单初始应为展开态').toBeGreaterThan(100)
    expect(closing.final, '收起后高度应归零').toBeLessThanOrEqual(1)

    // 展开
    const opening = await probeSubMenu(page)
    expect(opening.before, '上一步收起后应为 0').toBeLessThanOrEqual(1)
    expect(opening.final, '展开后应恢复原高度').toBeCloseTo(closing.before, 0)

    for (const [label, r] of [
      ['收起', closing],
      ['展开', opening]
    ] as const) {
      // 跳变特征：单帧变化量接近总变化量（旧版一帧走完，比值 0.96；
      // ease 过渡的最大单帧步长约 0.1，取决于采样帧率）
      expect(r.maxStepRatio, `${label}单帧最大跳变占比 ${r.maxStepRatio}`).toBeLessThan(0.4)
      // 真正在渐变的证据：中途确实有一批处于中间高度、且逐帧在变的帧
      expect(r.movingFrames, `${label}过渡中渐变的帧只有 ${r.movingFrames} 帧`).toBeGreaterThanOrEqual(5)
      // 不应停在某个错值上等收尾补跳（旧版会停 17~19 帧）
      expect(r.stuckFrames, `${label}过程中停滞 ${r.stuckFrames} 帧`).toBeLessThanOrEqual(3)
    }
  })

  test('折叠侧边栏时菜单内容宽度与外框同步收窄', async ({ page }) => {
    await login(page)
    await page.goto('/system/user')
    await expect(page.locator('.wb-sidebar')).toBeVisible({ timeout: 10000 })
    await page.waitForTimeout(600)

    // 把宽度过渡放慢到 6s，才能在动画中途稳定取样（正常只有 0.28s）
    await page.addStyleTag({
      content: '.wb-sidebar { transition-duration: 6s !important; }'
    })
    const dur = await page.evaluate(
      () => getComputedStyle(document.querySelector('.wb-sidebar') as HTMLElement).transitionDuration
    )
    expect(dur, '慢放样式未生效，本用例结果不可信').toBe('6s')

    await page.evaluate(() =>
      (document.querySelector('.wb-navbar .wb-icon-btn') as HTMLElement)?.click()
    )
    await page.waitForTimeout(1500)

    const m = await page.evaluate(() => {
      const sb = document.querySelector('.wb-sidebar') as HTMLElement
      const menu = document.querySelector('.wb-sidebar .el-menu') as HTMLElement
      return {
        sbW: +sb.getBoundingClientRect().width.toFixed(2),
        mW: +menu.getBoundingClientRect().width.toFixed(2)
      }
    })

    // 动画中途外框应明显宽于终态 64px（否则取样时刻没落在动画里，断言无意义）
    expect(m.sbW, `取样时外框宽度 ${m.sbW}px，不在动画中途`).toBeGreaterThan(100)
    // 菜单宽度差一个 1px 边框属正常；旧版此时菜单已经跳到 64px，能差 90px 以上
    expect(m.sbW - m.mW, `外框 ${m.sbW}px 与菜单 ${m.mW}px 错位`).toBeLessThanOrEqual(6)

    await page.waitForTimeout(5000)
  })
})
