import { expect, test, type Page } from '@playwright/test'

/**
 * 设备树回归：父/子节点自动排序 + 收藏置顶。
 *
 * 排序规则在单测里验证的是「函数返回值顺序」，这里验证的是「用户实际看到的树」，
 * 两者都跑才算数——组件里少传一个参数就会只绿一半。
 *
 * 口径：
 *   父节点（区域）按名称首字母 A-Z（中文取拼音首字母）；
 *   子节点 偏好 → 数字开头（0-9 按数值）→ 字母开头（A-Z，数字部分按数值，A9 在 A10 前）→ 其它。
 */

async function login(page: Page): Promise<void> {
  await page.goto('/login')
  await page.locator('input[type="text"]').first().fill('admin')
  await page.locator('input[type="password"]').first().fill('admin123')
  await page.getByRole('button', { name: /登\s*录/ }).click()
  await page.waitForURL(/\/(index)?/, { timeout: 15000 })
}

interface Row {
  name: string
  /** 区域节点用加粗样式，据此把父子行区分开（不能靠缩进层级猜） */
  isArea: boolean
}

/** el-tree 的 DOM 是深度优先的，按文档顺序取文本就等于用户看到的顺序 */
async function visibleRows(page: Page): Promise<Row[]> {
  return page.locator('.el-tree-node__content').evaluateAll((els) =>
    els.map((el) => ({
      name: String(
        (el.querySelector('.wb-device-tree__name') as HTMLElement | null)?.textContent ?? ''
      ).trim(),
      isArea: !!el.querySelector('.wb-device-tree__name--strong')
    }))
  )
}

/** 取某个区域下的设备名：从该区域那一行开始，遇到下一个区域行就停 */
function childrenOf(rows: Row[], area: string): string[] {
  const start = rows.findIndex((r) => r.name === area)
  expect(start, `没找到区域节点「${area}」`).toBeGreaterThanOrEqual(0)
  const out: string[] = []
  for (let i = start + 1; i < rows.length; i += 1) {
    if (rows[i].isArea) break
    out.push(rows[i].name)
  }
  return out
}

async function openDevicePage(page: Page): Promise<void> {
  await login(page)
  await page.goto('/demo/device')
  await expect(page.locator('.el-tree')).toBeVisible({ timeout: 10000 })
}

const AREA_1 = '一号生产车间'
const AREA_2 = '二号装配车间'

/** 父节点按首字母排序后的期望顺序：E(二) → S(三号/室外) → Y(研发/一号) */
const AREA_ORDER = ['二号装配车间', '三号原料仓', '室外场区', '研发办公楼', '一号生产车间']

/** mock 数据的原始顺序是乱的，这里是排序后的期望结果 */
const AREA_1_SORTED = [
  '1号行车',
  '2号线',
  '10号机',
  'A1',
  'A2',
  'A3',
  'A4',
  'A6',
  'A9',
  'A10',
  'B1',
  'B2',
  'B10',
  'C1'
]

test.describe('设备树：自动排序与收藏置顶', () => {
  test('父节点按名称首字母 A-Z 排序', async ({ page }) => {
    await openDevicePage(page)
    const rows = await visibleRows(page)
    expect(rows.filter((r) => r.isArea).map((r) => r.name)).toEqual(AREA_ORDER)
  })

  test('子节点：数字开头在前并按数值排，字母开头在后（A9 在 A10 之前）', async ({ page }) => {
    await openDevicePage(page)
    expect(childrenOf(await visibleRows(page), AREA_1)).toEqual(AREA_1_SORTED)
  })

  test('子节点：数字档整体在前，字母档内部按 A-Z 且数字部分按数值', async ({ page }) => {
    await openDevicePage(page)
    expect(childrenOf(await visibleRows(page), AREA_2)).toEqual([
      '3号压铸机',
      '11号叉车',
      'AGV-01',
      'D1',
      'D2',
      'D12',
      'E1',
      'E5',
      'F3',
      'F10'
    ])
  })

  test('没有「我的偏好」节点，收藏的设备被顶到所在区域最前且星标高亮', async ({ page }) => {
    await openDevicePage(page)
    // 「我的偏好」这个虚拟根节点已经按需求去掉了
    expect((await visibleRows(page)).map((r) => r.name)).not.toContain('我的偏好')

    const row = page.locator('.el-tree-node__content').filter({ hasText: 'A9' }).first()
    await row.hover()
    await row.locator('.wb-device-tree__star').click()

    // A9 原本排在第 9 位，收藏后必须跳到本区域第一条
    const children = childrenOf(await visibleRows(page), AREA_1)
    expect(children[0]).toBe('A9')
    expect(children.slice(1)).toEqual(AREA_1_SORTED.filter((n) => n !== 'A9'))

    // 收藏标识高亮：is-active 的星标常驻
    await expect(
      page
        .locator('.el-tree-node__content')
        .filter({ hasText: 'A9' })
        .first()
        .locator('.wb-device-tree__star.is-active')
    ).toBeVisible()
  })

  test('刷新后收藏仍在且依旧置顶', async ({ page }) => {
    await openDevicePage(page)

    const row = page.locator('.el-tree-node__content').filter({ hasText: 'A9' }).first()
    await row.hover()
    await row.locator('.wb-device-tree__star').click()
    await expect(
      page
        .locator('.el-tree-node__content')
        .filter({ hasText: 'A9' })
        .first()
        .locator('.wb-device-tree__star.is-active')
    ).toBeVisible()

    await page.reload()
    await expect(page.locator('.el-tree')).toBeVisible({ timeout: 10000 })
    expect(childrenOf(await visibleRows(page), AREA_1)[0]).toBe('A9')
  })

  test('偏好按登录人隔离：别人的收藏不会串进来', async ({ page }) => {
    await openDevicePage(page)

    const row = page.locator('.el-tree-node__content').filter({ hasText: 'A9' }).first()
    await row.hover()
    await row.locator('.wb-device-tree__star').click()
    await expect(
      page
        .locator('.el-tree-node__content')
        .filter({ hasText: 'A9' })
        .first()
        .locator('.wb-device-tree__star.is-active')
    ).toBeVisible()

    // 落盘有 300ms 防抖，这里要等它写下去，不能点完立刻断言
    await page.waitForFunction(
      () =>
        Object.keys(window.localStorage).filter((k) => k.startsWith('wb-admin:device-favorite'))
          .length === 1
    )
    const keys = await page.evaluate(() =>
      Object.keys(window.localStorage).filter((k) => k.startsWith('wb-admin:device-favorite'))
    )

    // 页面顶部写了「当前登录人：xxx（userId）」，从界面上取，不硬编码 id
    const ownerId = await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll('.wb-demo-device__tip div')).find((d) =>
        String(d.textContent ?? '').includes('当前登录人')
      )
      return String(el?.textContent ?? '').match(/（([^）]+)）/)?.[1] ?? ''
    })
    expect(ownerId, '页面上没读到当前登录人 id').toBeTruthy()
    expect(keys[0]).toBe(`wb-admin:device-favorite:${ownerId}`)

    // 手动塞一份「别人」的收藏，刷新后它不应该出现在我的树里
    await page.evaluate(() => {
      localStorage.setItem(
        'wb-admin:device-favorite:someone-else',
        JSON.stringify({
          version: 1,
          favorites: [{ id: 'AR9-999', name: '别人的设备', addedAt: Date.now() }]
        })
      )
    })
    await page.reload()
    await expect(page.locator('.el-tree')).toBeVisible({ timeout: 10000 })
    await expect(
      page.locator('.el-tree-node__content').filter({ hasText: '别人的设备' })
    ).toHaveCount(0)
    // 自己的收藏不受影响
    expect(childrenOf(await visibleRows(page), AREA_1)[0]).toBe('A9')
  })

  test('折叠的区域不会因为点收藏重排而被重新展开', async ({ page }) => {
    await openDevicePage(page)
    const AREA_FOLD = '研发办公楼'

    /** 只认本节点的内容行（:scope > ），否则会命中后代的同名元素 */
    const isExpanded = () =>
      page.evaluate((areaName) => {
        const node = Array.from(document.querySelectorAll('.el-tree-node')).find((n) => {
          const label = n.querySelector(
            ':scope > .el-tree-node__content .wb-device-tree__name--strong'
          )
          return label?.textContent?.trim() === areaName
        })
        return node?.classList.contains('is-expanded') ?? false
      }, AREA_FOLD)

    expect(await isExpanded()).toBe(true)

    // expand-on-click-node=false，折叠只能点那个箭头
    await page
      .locator('.el-tree-node__content')
      .filter({ hasText: AREA_FOLD })
      .locator('.el-tree-node__expand-icon')
      .click()
    await expect.poll(isExpanded).toBe(false)

    // 点收藏：treeData 换新引用 → el-tree 会整棵树重建，
    // 展开态必须由 default-expanded-keys 恢复，不能被 defaultExpandAll 重新灌成展开
    const row = page.locator('.el-tree-node__content').filter({ hasText: 'A9' }).first()
    await row.hover()
    await row.locator('.wb-device-tree__star').click()
    await expect(row.locator('.wb-device-tree__star.is-active')).toBeVisible()
    await expect.poll(isExpanded).toBe(false)
  })
})
