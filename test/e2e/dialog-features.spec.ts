import { expect, test, type Locator, type Page } from '@playwright/test'

/**
 * ProDialog 四项能力（全屏 / 拖动 / 多弹窗 / 最大化最小化）的端到端回归。
 *
 * 这些能力的开关都是 `default: undefined` 的布尔 prop，回退到 `src/config/dialog.ts`
 * 的全局默认。这里除了验行为，也守两条容易被悄悄改坏的性质：
 *   1. 「不传 prop」要能拿到全局默认（Vue 对布尔 prop 的默认转换会把「不传」变成 false，
 *      真踩了的话所有既有弹窗会一个按钮都没有）；
 *   2. 只开一个弹窗时，行为必须和改造前一致（带遮罩、锁背景）。
 */

const DLG = '.el-dialog.pro-dialog'

test.use({ viewport: { width: 1440, height: 900 } })

const visDlg = (page: Page) => page.locator(`${DLG}:visible`)
const actBtn = (dlg: Locator, label: string) =>
  dlg.locator(`.pro-dialog__act[aria-label="${label}"]`)

async function login(page: Page): Promise<void> {
  await page.goto('/login')
  await page.locator('input[type="text"]').first().fill('admin')
  await page.locator('input[type="password"]').first().fill('admin123')
  await page.getByRole('button', { name: /登\s*录/ }).click()
  await page.waitForURL(/\/(index)?/, { timeout: 15000 })
}

async function gotoDemo(page: Page): Promise<void> {
  await page.goto('/demo/dialog')
  await expect(page.locator('.wb-demo-dialog')).toBeVisible({ timeout: 15000 })
  await page.waitForTimeout(500)
}

async function openBasic(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: '按上面配置打开' }).click()
  const dlg = visDlg(page).first()
  await dlg.waitFor({ state: 'visible', timeout: 10000 })
  await page.waitForTimeout(400)
  return dlg
}

async function closeAll(page: Page): Promise<void> {
  for (let i = 0; i < 6; i++) {
    if (!(await visDlg(page).count())) break
    await page.keyboard.press('Escape')
    await page.waitForTimeout(350)
  }
}

/** 按标题取弹窗（多个同时开着时不能靠 nth） */
const dlgByTitle = (page: Page, title: string) =>
  page.locator(`${DLG}:visible`).filter({ hasText: title })

/** 取某个弹窗自己那层遮罩 —— 关闭的弹窗遮罩仍留在 DOM 里，不能全页计数 */
function overlayClassOf(page: Page, title: string): Promise<string | null> {
  return page.evaluate((t) => {
    const dlg = Array.from(document.querySelectorAll('.el-dialog.pro-dialog')).find(
      (el) => ((el.querySelector('.el-dialog__title') || {}).textContent || '').trim() === t
    )
    if (!dlg) return null
    return dlg.parentElement?.parentElement?.className ?? null
  }, title)
}

test.describe('ProDialog 四项能力', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await gotoDemo(page)
  })

  test('既有的业务弹窗不改一行代码就拿到了操作区（证明「不传 prop」能落到全局默认）', async ({
    page
  }) => {
    // /system/post 的弹窗是一个纯粹的既有用法：只传 v-model / title / width
    await page.goto('/system/post')
    await expect(page.locator('.wb-page')).toBeVisible({ timeout: 15000 })
    await page.waitForTimeout(900)
    await page.locator('.wb-card button:visible').filter({ hasText: /新增/ }).first().click()
    await page.waitForTimeout(1100)

    const dlg = visDlg(page).first()
    await expect(dlg).toBeVisible()
    // 这一条就是「布尔 prop 被默认转换」的哨兵：踩了的话这里是 0
    await expect(dlg.locator('.pro-dialog__acts .pro-dialog__act')).toHaveCount(3)
    await expect(dlg).toHaveClass(/is-draggable/)
  })

  test('标题栏拖动：跟手移动，且默认不会把弹窗拖出视口', async ({ page }) => {
    const dlg = await openBasic(page)
    const header = dlg.locator('.el-dialog__header').first()
    const hb = (await header.boundingBox())!
    const before = (await dlg.boundingBox())!

    await page.mouse.move(hb.x + 40, hb.y + hb.height / 2)
    await page.mouse.down()
    await page.mouse.move(hb.x + 160, hb.y + hb.height / 2 + 90, { steps: 12 })
    await page.mouse.up()
    await page.waitForTimeout(250)
    const after = (await dlg.boundingBox())!

    // 横向应当跟手走足 120px
    expect(Math.round(after.x - before.x)).toBeGreaterThan(100)
    // 纵向：弹窗高 745 / 视口 900，EP 会把位移夹在「底边不出视口」的范围内，
    // 能走的距离 = 视口高 − 弹窗高，这里只有 20px 左右。
    // 写死「跟手 90px」是错的断言（曾因此误报失败），要按实时几何算上界。
    const maxDown = 900 - before.y - before.height
    const movedY = after.y - before.y
    expect(movedY).toBeGreaterThan(0)
    expect(movedY).toBeLessThanOrEqual(maxDown + 2)
    // 真的越过了视口下边界就该判失败
    expect(after.y + after.height).toBeLessThanOrEqual(900 + 2)
  })

  test('最大化 / 还原：铺满视口且保留留白，表头与底部按钮钉住', async ({ page }) => {
    const dlg = await openBasic(page)
    await actBtn(dlg, '最大化').click()
    await page.waitForTimeout(400)

    await expect(dlg).toHaveClass(/is-maximized/)
    const box = (await dlg.boundingBox())!
    expect(Math.round(box.x)).toBe(16)
    expect(Math.round(box.y)).toBe(16)
    expect(Math.round(box.width)).toBe(1440 - 32)
    expect(Math.round(box.height)).toBe(900 - 32)

    // 正文内部滚动，且滚到底之后表头还钉在视口内
    const body = dlg.locator('.el-dialog__body .el-scrollbar__wrap').first()
    const sizes = await body.evaluate((el) => ({ sw: el.scrollHeight, ch: el.clientHeight }))
    expect(sizes.sw, '正文应确实超出一屏，否则这个用例测不到东西').toBeGreaterThan(sizes.ch)
    await body.evaluate((el) => {
      el.scrollTop = el.scrollHeight
    })
    await page.waitForTimeout(300)
    const headerBox = (await dlg.locator('.el-dialog__header').first().boundingBox())!
    const footerBox = (await dlg.locator('.el-dialog__footer').first().boundingBox())!
    expect(headerBox.y).toBeGreaterThanOrEqual(0)
    expect(footerBox.y + footerBox.height).toBeLessThanOrEqual(900)

    await actBtn(dlg, '还原').click()
    await page.waitForTimeout(400)
    await expect(dlg).not.toHaveClass(/is-maximized/)
    expect((await dlg.boundingBox())!.width).toBeLessThan(1440)
  })

  test('全屏 / 退出全屏：铺满视口且正文内部滚动', async ({ page }) => {
    const dlg = await openBasic(page)
    await actBtn(dlg, '全屏').click()
    await page.waitForTimeout(400)

    await expect(dlg).toHaveClass(/is-fullscreen/)
    const box = (await dlg.boundingBox())!
    expect(Math.round(box.x)).toBe(0)
    expect(Math.round(box.y)).toBe(0)
    expect(Math.round(box.width)).toBe(1440)
    expect(Math.round(box.height)).toBe(900)

    // 「整块弹窗滚」是反例：正文必须自己滚，弹窗本身不动
    const dlgScroll = await dlg.evaluate((el) => ({
      sh: el.scrollHeight,
      ch: el.clientHeight
    }))
    expect(dlgScroll.sh).toBeLessThanOrEqual(dlgScroll.ch + 2)
    const body = dlg.locator('.el-dialog__body .el-scrollbar__wrap').first()
    const sizes = await body.evaluate((el) => ({ sw: el.scrollHeight, ch: el.clientHeight }))
    expect(sizes.sw).toBeGreaterThan(sizes.ch)

    await actBtn(dlg, '退出全屏').click()
    await page.waitForTimeout(400)
    await expect(dlg).not.toHaveClass(/is-fullscreen/)
  })

  test('最小化：收成右下角横条、正文隐藏、遮罩撤掉，点横条即可还原', async ({ page }) => {
    const dlg = await openBasic(page)
    await actBtn(dlg, '最小化').click()
    await page.waitForTimeout(400)

    await expect(dlg).toHaveClass(/is-minimized/)
    const box = (await dlg.boundingBox())!
    expect(Math.round(box.width)).toBe(280)
    expect(Math.round(box.x + box.width)).toBe(1440 - 24)
    expect(Math.round(box.y + box.height)).toBe(900)
    await expect(dlg.locator('.el-dialog__body')).toBeHidden()

    // 收起来的横条不能再压着页面
    expect(
      await overlayClassOf(page, await dlg.locator('.el-dialog__title').innerText())
    ).toContain('is-penetrable')

    // 点横条还原
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    await page.waitForTimeout(400)
    await expect(dlg).not.toHaveClass(/is-minimized/)
  })

  test('多弹窗：只开一个仍有遮罩，开多个自动撤遮罩 + 错位 + 点击置顶', async ({ page }) => {
    // 先只开一个：行为必须和改造前一致
    await page.getByRole('button', { name: '打开弹窗 A' }).click()
    await page.waitForTimeout(500)
    const a1 = await overlayClassOf(page, '弹窗 A')
    expect(a1, '只开一个弹窗时仍应有遮罩').toContain('el-modal-dialog')
    expect(a1).not.toContain('is-penetrable')
    await closeAll(page)

    // 三个一起开（单独开会先挡住页面，按钮就点不到了）
    await page.getByRole('button', { name: '三个一起打开' }).click()
    await page.waitForTimeout(800)
    expect(await visDlg(page).count()).toBe(3)

    // 层叠错位：相邻两层各错开 24px，否则同尺寸弹窗会完全重叠、看不出开了两个
    const boxA = (await dlgByTitle(page, '弹窗 A').boundingBox())!
    const boxB = (await dlgByTitle(page, '弹窗 B').boundingBox())!
    const boxC = (await dlgByTitle(page, '弹窗 C').boundingBox())!
    expect(Math.round(boxB.x - boxA.x)).toBe(24)
    expect(Math.round(boxC.x - boxB.x)).toBe(24)

    // 多个一起开着时遮罩要撤掉，否则后开的那个连着把先开的盖住，两个都动不了
    expect(await overlayClassOf(page, '弹窗 B')).toContain('is-penetrable')

    // 点一下被压在下面的 A，它应当到最前
    const target = { x: boxA.x + boxA.width / 2, y: boxA.y + 12 }
    await page.mouse.click(target.x, target.y)
    await page.waitForTimeout(400)
    const hit = await page.evaluate(
      ([x, y]) => {
        const el = document.elementFromPoint(x, y)
        const t = el?.closest('.el-dialog')?.querySelector('.el-dialog__title')
        return (t?.textContent || '').trim()
      },
      [target.x, target.y]
    )
    expect(hit).toBe('弹窗 A')
  })

  test('能力可关：关掉整个操作区后回到原生表头，且表头高度不变', async ({ page }) => {
    const dlg = await openBasic(page)
    const withActs = (await dlg.locator('.el-dialog__header').first().boundingBox())!.height
    await closeAll(page)

    // 必须精确匹配：下面「全局默认」那张卡里还有一个「所有弹窗显示操作区」，
    // 用子串匹配会同时命中两个，strict mode 直接报错。
    // 另外 Element Plus 把原生 input 藏了（.el-checkbox__original 不可见），
    // 只能点外层 label。
    await page
      .locator('label.el-checkbox')
      .filter({ hasText: /^显示操作区$/ })
      .click()
    const dlg2 = await openBasic(page)

    await expect(dlg2.locator('.pro-dialog__acts')).toHaveCount(0)
    await expect(dlg2.locator('.pro-dialog__header')).toHaveCount(0)
    // 沿用 EP 默认表头
    await expect(dlg2.locator('.el-dialog__title')).toHaveCount(1)
    // 关键：自定义表头不能把弹窗撑高
    const nativeH = (await dlg2.locator('.el-dialog__header').first().boundingBox())!.height
    expect(Math.round(nativeH)).toBe(Math.round(withActs))
  })
})
