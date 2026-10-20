import { expect, test, type Page } from '@playwright/test'

/**
 * 全局 AI 对话面板。
 *
 * 只断言「用户能看见什么」：弹窗能开、发出去有回复、附件真的进了消息、
 * 选的模型真的落到消息上、刷新后历史还在。
 * 字符流的具体节奏属于实现细节，不做断言。
 */
async function login(page: Page): Promise<void> {
  await page.goto('/login')
  await page.locator('input[type="text"]').first().fill('admin')
  await page.locator('input[type="password"]').first().fill('admin123')
  await page.getByRole('button', { name: /登\s*录/ }).click()
  await page.waitForURL(/\/(index)?/, { timeout: 15000 })
}

async function openPanel(page: Page) {
  await page.locator('[data-test="ai-entry"]').click()
  const dialog = page.locator('.wb-ai')
  await expect(dialog).toBeVisible({ timeout: 10000 })
  return dialog
}

/** 等发送按钮重新出现 = 本轮生成结束 */
async function waitIdle(dialog: ReturnType<Page['locator']>): Promise<void> {
  await expect(dialog.locator('[data-test="ai-send"]')).toBeVisible({ timeout: 30000 })
}

/** 按住拖动条竖向拖 dy 像素（负数 = 往上拖 = 变高） */
async function dragResizer(
  page: Page,
  handle: ReturnType<Page['locator']>,
  dy: number
): Promise<void> {
  const box = (await handle.boundingBox())!
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x, y + dy, { steps: 10 })
  await page.mouse.up()
  await page.waitForTimeout(120)
}

test.describe('AI 对话面板', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('顶栏图标打开弹窗，发送后收到回复', async ({ page }) => {
    const dialog = await openPanel(page)
    await expect(dialog.locator('.wb-ai__empty-title')).toBeVisible()

    await dialog.locator('textarea').fill('帮我理一下设备树的排序规则')
    await dialog.locator('[data-test="ai-send"]').click()

    // 用户消息立刻上屏
    await expect(dialog.locator('.wb-ai__row.is-user')).toHaveCount(1)
    // 生成中按钮变成「停止」
    await expect(dialog.locator('[data-test="ai-stop"]')).toHaveCount(1)

    await waitIdle(dialog)
    await expect(dialog.locator('.wb-ai__row.is-assistant')).toHaveCount(1)
    await expect(dialog.locator('[data-test="ai-msg-md"]')).toContainText('设备树的排序规则')
  })

  test('全屏切换后铺满视口，退出后恢复原尺寸', async ({ page }) => {
    const dialog = await openPanel(page)
    const normal = await dialog.boundingBox()
    const normalBody = await dialog.locator('.wb-ai__body').boundingBox()
    const viewport = page.viewportSize()

    await dialog.locator('[data-test="ai-fullscreen"]').click()
    await page.waitForTimeout(400)
    const full = await dialog.boundingBox()
    expect(full!.width).toBeGreaterThan(normal!.width)
    // 全屏就是铺满：允许 1px 的边框误差
    expect(full!.width).toBeGreaterThanOrEqual(viewport!.width - 2)
    expect(full!.height).toBeGreaterThanOrEqual(viewport!.height - 2)

    /*
     * 曾经对话区固定 58vh，全屏后 footer 之下空出一大半屏（window 模式没问题，
     * 因为弹窗高度本来就是内容撑的）。这里量两个真位置：
     * ① 对话区被拉高；② footer 贴着弹窗底边。
     */
    const fullBody = await dialog.locator('.wb-ai__body').boundingBox()
    expect(fullBody!.height).toBeGreaterThan(normalBody!.height + 40)

    const footer = await dialog.locator('.el-dialog__footer').boundingBox()
    // 弹窗自身有 16px 内边距，所以贴底也是差 16px 左右
    const bottomGap = full!.y + full!.height - (footer!.y + footer!.height)
    expect(bottomGap).toBeLessThanOrEqual(20)

    await dialog.locator('[data-test="ai-fullscreen"]').click()
    await page.waitForTimeout(400)
    const restored = await dialog.boundingBox()
    expect(Math.round(restored!.width)).toBe(Math.round(normal!.width))
    expect(Math.round(restored!.height)).toBe(Math.round(normal!.height))
  })

  test('拖动输入区上沿可调输入框高度，双击复位', async ({ page }) => {
    const dialog = await openPanel(page)
    const ta = dialog.locator('textarea')
    const handle = dialog.locator('[data-test="ai-resizer"]')
    await expect(handle).toBeVisible()

    const before = (await ta.boundingBox())!
    await dragResizer(page, handle, -80)
    const taller = (await ta.boundingBox())!
    // 往上拖 80 就应该真的高 80 左右（留点容差，别把断言绑死在像素上）
    expect(taller.height).toBeGreaterThan(before.height + 50)

    // 固定高度之后，输入很多行也不会把框撑高（改为框内滚动）
    await ta.fill('第 1 行\n第 2 行\n第 3 行\n第 4 行\n第 5 行\n第 6 行\n第 7 行\n第 8 行')
    const typed = (await ta.boundingBox())!
    expect(Math.round(typed.height)).toBe(Math.round(taller.height))

    // 往下拖到底：收回到下限，且比默认的 2 行不会更矮
    await dragResizer(page, handle, 320)
    const shortest = (await ta.boundingBox())!
    expect(shortest.height).toBeLessThanOrEqual(before.height + 1)
    expect(shortest.height).toBeGreaterThan(before.height - 6)

    // 双击复位：回到「跟随内容自动增高」，空内容就是 2 行
    await ta.fill('')
    await handle.dblclick()
    await page.waitForTimeout(150)
    const reset = (await ta.boundingBox())!
    expect(reset.height).toBeCloseTo(before.height, 0)
  })

  test('切换模型 + 附件随消息一起发出', async ({ page }) => {
    const dialog = await openPanel(page)

    // 切模型
    await dialog.locator('.wb-ai__model').click()
    const dropdown = page.locator('.el-select-dropdown:visible').last()
    await dropdown.locator('.el-select-dropdown__item').filter({ hasText: '通义千问 Max' }).click()
    await expect(dialog.locator('.wb-ai__title .el-tag')).toContainText('通义千问 Max')

    // 加附件（直接往 el-upload 的隐藏 input 里塞）
    await dialog.locator('.wb-ai__upload input[type="file"]').setInputFiles({
      name: '需求说明.md',
      mimeType: 'text/markdown',
      buffer: Buffer.from('# 需求\n\n设备树要支持收藏置顶。')
    })
    await expect(dialog.locator('.wb-ai__pending-item')).toHaveCount(1)
    await expect(dialog.locator('.wb-ai__pending-name')).toHaveText('需求说明.md')

    await dialog.locator('textarea').fill('看下这个需求有没有坑')
    await dialog.locator('[data-test="ai-send"]').click()

    // 附件跟着用户气泡走，并且发送后待发送区清空
    const userRow = dialog.locator('.wb-ai__row.is-user').last()
    await expect(userRow.locator('.wb-ai__file-name')).toHaveText('需求说明.md')
    await expect(dialog.locator('.wb-ai__pending-item')).toHaveCount(0)

    await waitIdle(dialog)
    // 消息上的模型是切换后的那个，不是默认的 gpt-4o
    await expect(dialog.locator('.wb-ai__meta-model').last()).toHaveText('qwen-max')
    // 模拟回复里会复述附件名，能反向证明附件真的传到了传输层
    await expect(dialog.locator('[data-test="ai-msg-md"]')).toContainText('需求说明.md')
  })

  test('刷新后历史仍在，且可一键清空', async ({ page }) => {
    const dialog = await openPanel(page)
    await dialog.locator('textarea').fill('这条消息要活过刷新')
    await dialog.locator('[data-test="ai-send"]').click()
    await waitIdle(dialog)

    await page.reload()
    const again = await openPanel(page)
    await expect(again.locator('.wb-ai__row')).toHaveCount(2)
    await expect(again.locator('.wb-ai__row.is-user')).toContainText('这条消息要活过刷新')

    // 清空会话（顶部删除图标 → 确认）
    await again.locator('[data-test="ai-clear"]').click()
    await page.getByRole('button', { name: /确\s*定/ }).click()
    await expect(again.locator('.wb-ai__row')).toHaveCount(0)
    await expect(again.locator('.wb-ai__empty-title')).toBeVisible()
  })

  test('Enter 发送、Shift + Enter 只换行', async ({ page }) => {
    const dialog = await openPanel(page)
    const input = dialog.locator('textarea')
    await input.fill('第一行')
    await input.press('Shift+Enter')
    await input.type('第二行')

    // 还没有发出去
    await expect(dialog.locator('.wb-ai__row')).toHaveCount(0)
    await expect(input).toHaveValue('第一行\n第二行')

    await input.press('Enter')
    await expect(dialog.locator('.wb-ai__row.is-user')).toHaveCount(1)
    await expect(dialog.locator('.wb-ai__row.is-user')).toContainText('第一行')
  })

  test('输入法上屏那一下的回车不发送，停手后回车仍能发送', async ({ page }) => {
    const dialog = await openPanel(page)
    const input = dialog.locator('textarea')
    await input.click()

    /*
     * 用 CDP 制造真实的输入法时序，而不是派发一个 hand-made KeyboardEvent：
     * 要复现的是「compositionend 先触发、随后的 keydown 里 isComposing 已是 false」，
     * 合成事件永远给不出这个状态（那正是这个 bug 一直没被测出来的原因）。
     */
    const cdp = await page.context().newCDPSession(page)
    const pressEnter = () =>
      cdp.send('Input.dispatchKeyEvent', {
        type: 'keyDown',
        key: 'Enter',
        code: 'Enter',
        windowsVirtualKeyCode: 13,
        nativeVirtualKeyCode: 13
      })

    // 1) 拼音还在候选框里就按回车：不能发送
    await cdp.send('Input.imeSetComposition', {
      text: 'nihao',
      selectionStart: 5,
      selectionEnd: 5
    })
    await pressEnter()
    await expect(dialog.locator('.wb-ai__row')).toHaveCount(0)

    // 2) 上屏（compositionend）紧跟同一发回车：这正是「打两个字就自动发送」的场景
    await cdp.send('Input.insertText', { text: '你好' })
    await pressEnter()
    await expect(input).toHaveValue('你好')
    await expect(dialog.locator('.wb-ai__row')).toHaveCount(0)

    // 3) 停手之后再按回车：必须照常发送，不能把发送功能一起废掉
    await page.waitForTimeout(300)
    await input.press('Enter')
    await expect(dialog.locator('.wb-ai__row.is-user')).toHaveCount(1)
    await expect(dialog.locator('.wb-ai__row.is-user')).toContainText('你好')
  })

  test('会话分组：新建对话互不干扰，建组后移动、可折叠，刷新后保持', async ({ page }) => {
    const dialog = await openPanel(page)

    // 第一条对话，标题取首条消息
    await dialog.locator('textarea').fill('第一个会话')
    await dialog.locator('[data-test="ai-send"]').click()
    await waitIdle(dialog)
    await expect(dialog.locator('[data-test="ai-session"]')).toHaveCount(1)
    await expect(dialog.locator('.wb-ai__session-title').first()).toHaveText('第一个会话')

    // 新建对话：消息区清空，旧会话仍在列表里
    await dialog.locator('[data-test="ai-new-chat"]').click()
    await expect(dialog.locator('[data-test="ai-session"]')).toHaveCount(2)
    await expect(dialog.locator('.wb-ai__row')).toHaveCount(0)

    await dialog.locator('textarea').fill('第二个会话')
    await dialog.locator('[data-test="ai-send"]').click()
    await waitIdle(dialog)

    // 建分组，把当前会话移进去
    await dialog.locator('[data-test="ai-new-group"]').click()
    await page.locator('.el-message-box__input input').fill('需求整理')
    await page.locator('.el-message-box__btns .el-button--primary').click()
    await expect(dialog.locator('[data-test="ai-group"]')).toHaveCount(1)

    await dialog
      .locator('[data-test="ai-session"]')
      .first()
      .locator('[data-test="ai-session-more"]')
      .click()
    await page.locator('.el-dropdown-menu__item:visible', { hasText: '需求整理' }).first().click()
    await expect(dialog.locator('.wb-ai__group-count')).toHaveText('1')

    // 折叠分组：组内会话从 DOM 消失，未分组那条还在
    await dialog.locator('[data-test="ai-group"]').click()
    await expect(dialog.locator('[data-test="ai-session"]')).toHaveCount(1)
    await dialog.locator('[data-test="ai-group"]').click()
    await expect(dialog.locator('[data-test="ai-session"]')).toHaveCount(2)

    // 刷新后分组与会话都还在
    await page.reload()
    const again = await openPanel(page)
    await expect(again.locator('[data-test="ai-group"]')).toHaveCount(1)
    await expect(again.locator('[data-test="ai-session"]')).toHaveCount(2)
    // 组内按最近使用排序（「未分组」桶固定排在最前，所以不能取全局第一条）
    const groupBox = again
      .locator('.wb-ai__group')
      .filter({ has: page.locator('[data-test="ai-group"]') })
    await expect(groupBox.locator('.wb-ai__session-title').first()).toHaveText('第二个会话')

    /*
     * 当前会话就在分组里，此时点「新建对话」：必须落在「未分组」，不能继承分组。
     * 这是用户报过的场景 —— 手动把对话都归组之后，之后新建的全都自动跑进那个组。
     */
    await again.locator('[data-test="ai-new-chat"]').click()
    await expect(again.locator('[data-test="ai-session"]')).toHaveCount(3)
    await expect(again.locator('.wb-ai__group-count')).toHaveText('1')
    // 「未分组」桶里应当是两条（原来的第一条 + 新建这条）
    const ungrouped = again
      .locator('.wb-ai__group')
      .filter({ has: page.locator('.wb-ai__group-head.is-plain') })
    await expect(ungrouped.locator('[data-test="ai-session"]')).toHaveCount(2)
  })
})
