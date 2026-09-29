import { expect, test, type Page } from '@playwright/test'

/**
 * 控件尺寸 / 间距回归 —— 两处都只有真实渲染才暴露，单测覆盖不到。
 *
 * 1. 顶栏图标按钮被压扁。
 *    el-icon 自身是 `width: 1em; height: 1em`，全局又是 `box-sizing: border-box`，
 *    所以用 padding 撑热区是「从 1em 里扣」：`font-size:17px + padding:5px` 只剩 7×7 内容盒，
 *    里面的 svg（同样 1em）在主轴被 flex-shrink 压成 7px 宽、副轴因 align-items: center
 *    不收缩仍是 17px —— 实测渲染成 7×17，横向压到 41%。断言按「svg 必须正方形且不小于 16px」写。
 *
 * 2. 工具条里「列设置」按钮与其它按钮间距不一致。
 *    .wb-toolbar__left/__right 曾经没有任何布局样式（display: block），组内按钮是 inline 排列，
 *    间距来自 EP 的 `.el-button + .el-button { margin-left: 12px }`；该规则只认直接相邻的两个
 *    el-button，而列设置的触发元素外面包了一层 span，于是左边距为 0（实测 [12,12,12,0]）。
 */
async function login(page: Page): Promise<void> {
  await page.goto('/login')
  await page.locator('input[type="text"]').first().fill('admin')
  await page.locator('input[type="password"]').first().fill('admin123')
  await page.getByRole('button', { name: /登\s*录/ }).click()
  await page.waitForURL(/\/(index)?/, { timeout: 15000 })
}

test.describe('控件尺寸与间距', () => {
  test('顶栏图标按钮为正方形、不被压扁，且有足够点击热区', async ({ page }) => {
    await login(page)
    await page.goto('/system/role')
    await expect(page.locator('.wb-navbar')).toBeVisible({ timeout: 10000 })

    const m = await page.evaluate(() => {
      const nav = document.querySelector('.wb-navbar') as HTMLElement
      const pick = (sel: string) =>
        [...document.querySelectorAll(sel)].map((el) => {
          const e = el as HTMLElement
          const svg = e.querySelector('svg')
          const box = e.getBoundingClientRect()
          const sr = svg ? svg.getBoundingClientRect() : null
          const cs = getComputedStyle(e)
          return {
            boxW: +box.width.toFixed(2),
            boxH: +box.height.toFixed(2),
            svgW: sr ? +sr.width.toFixed(2) : 0,
            svgH: sr ? +sr.height.toFixed(2) : 0,
            // 内容盒宽度：padding 是 border-box 内部扣的，svg 不该被压到比它更窄
            contentW: e.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight),
            font: cs.fontSize,
            padding: cs.padding,
            left: +box.left.toFixed(2),
            right: +box.right.toFixed(2)
          }
        })
      const right = pick('.wb-navbar__right .wb-icon-btn')
      /*
       * 右侧一栏里图标之间还夹着租户下拉、头像等非图标元素，直接按「所有相邻图标」算间距
       * 会把「隔着下拉框」的两段距离（实测 146px）也算进来,断言必然误报。
       * 所以先按直接子元素切成若干「连续图标段」，段内才是真正的相邻间距。
       */
      const kids = [...(document.querySelector('.wb-navbar__right') as HTMLElement).children]
      const runs: HTMLElement[][] = []
      let run: HTMLElement[] = []
      for (const el of kids) {
        if (el.classList.contains('wb-icon-btn')) run.push(el as HTMLElement)
        else {
          if (run.length) runs.push(run)
          run = []
        }
      }
      if (run.length) runs.push(run)

      const runGaps = runs.map((seg) => {
        const gaps: number[] = []
        for (let i = 1; i < seg.length; i++) {
          const a = seg[i - 1].getBoundingClientRect()
          const b = seg[i].getBoundingClientRect()
          gaps.push(+(b.left - a.right).toFixed(2))
        }
        return gaps
      })
      return {
        toggle: pick('.wb-navbar__left .wb-icon-btn'),
        right,
        runs: runs.map((s) => s.length),
        runGaps,
        navOverflow: nav.scrollWidth - nav.clientWidth,
        docOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
      }
    })

    // 折叠按钮 + 右侧一组图标
    expect(m.toggle.length, '折叠按钮').toBe(1)
    expect(m.right.length, '右侧图标数量').toBeGreaterThanOrEqual(6)

    for (const [label, list] of [
      ['折叠按钮', m.toggle],
      ['右侧图标', m.right]
    ] as const) {
      list.forEach((ic, i) => {
        const where = `${label}[${i}]`
        // 关键断言：svg 必须是正方形 —— 被压扁时是 7×17
        expect(ic.svgW, `${where} svg 宽度`).toBeGreaterThanOrEqual(16)
        expect(ic.svgH, `${where} svg 高度`).toBeGreaterThanOrEqual(16)
        const ratio = ic.svgW / ic.svgH
        expect(Math.abs(ratio - 1), `${where} svg 宽高比 ${ratio.toFixed(3)}（1=未压扁）`).toBeLessThan(0.1)
        // svg 不能宽于内容盒（说明被 flex-shrink 挤过）
        expect(ic.svgW, `${where} svg 超出内容盒 ${ic.contentW}`).toBeLessThanOrEqual(ic.contentW + 0.5)
        // 点击热区不小于 28px
        expect(ic.boxW, `${where} 热区宽`).toBeGreaterThanOrEqual(28)
        expect(ic.boxH, `${where} 热区高`).toBeGreaterThanOrEqual(28)
      })
    }

    // 段内间距必须一致（曾经因热区靠 padding 撑，间距被 padding 吃掉一截），
    // 且各段用的是同一个间距值
    const allGaps = m.runGaps.flat()
    expect(allGaps.length, `图标相邻间距样本 ${JSON.stringify(m.runGaps)}`).toBeGreaterThanOrEqual(4)
    expect(Math.max(...allGaps) - Math.min(...allGaps), `间距不一致 ${JSON.stringify(allGaps)}`).toBeLessThanOrEqual(
      0.5
    )
    expect(allGaps[0], '图标间距').toBeGreaterThan(0)

    // 图标变大后顶栏不应溢出
    expect(m.navOverflow, '顶栏横向溢出').toBeLessThanOrEqual(0)
    expect(m.docOverflow, '文档横向溢出').toBeLessThanOrEqual(0)
  })

  test('表格工具条内按钮间距一致（列设置按钮与其它按钮同距）', async ({ page }) => {
    await login(page)
    for (const path of ['/system/role', '/system/user', '/monitor/operlog']) {
      await page.goto(path)
      await expect(page.locator('.wb-toolbar').first()).toBeVisible({ timeout: 10000 })

      const m = await page.evaluate(() => {
        const right = document.querySelector('.wb-toolbar__right') as HTMLElement
        const left = document.querySelector('.wb-toolbar__left') as HTMLElement
        const cs = getComputedStyle(right)
        const box = (el: Element) => el.getBoundingClientRect()
        const btns = [...right.querySelectorAll('.el-button')].map((el) => {
          const r = box(el)
          return { left: +r.left.toFixed(2), right: +r.right.toFixed(2), cls: el.className.slice(0, 40) }
        })
        const gaps: number[] = []
        for (let i = 1; i < btns.length; i++) {
          gaps.push(+(btns[i].left - btns[i - 1].right).toFixed(2))
        }
        // 左右两组之间不能叠在一起（分栏布局的前提）
        return {
          display: cs.display,
          gap: cs.gap,
          btnCount: btns.length,
          gaps,
          leftDisplay: getComputedStyle(left).display,
          overlap: +(box(left).right - box(right).left).toFixed(2)
        }
      })

      expect(m.display, `${path} 右侧容器 display`).toBe('flex')
      expect(m.leftDisplay, `${path} 左侧容器 display`).toBe('flex')
      expect(m.btnCount, `${path} 右侧按钮数量`).toBeGreaterThanOrEqual(3)

      // 核心断言：所有相邻间距相同 —— 列设置曾经是 0，其余是 12
      const first = m.gaps[0]
      for (let i = 1; i < m.gaps.length; i++) {
        expect(
          Math.abs(m.gaps[i] - first),
          `${path} 第 ${i + 1} 个间距 ${m.gaps[i]} 与第 1 个 ${first} 不一致（全部：${JSON.stringify(m.gaps)}）`
        ).toBeLessThanOrEqual(0.5)
      }
      expect(first, `${path} 按钮间距`).toBeGreaterThan(0)
      // 左右两组不能重叠
      expect(m.overlap, `${path} 左右分组重叠 ${m.overlap}px`).toBeLessThanOrEqual(0)
    }
  })

  /*
   * 3. 文件管理工具条里「上传文件」比同排其它按钮高 5px。
   *    EP 给 .el-upload-list 写死了 margin: 10px 0 0（dist 里的固定值，不是主题变量）。
   *    list-type 是 text 且还没上传任何文件时，那个空的 <ul> 依然渲染，
   *    于是 ProUpload 的外层 .wb-upload 被撑成「按钮 32 + 空列表 10 = 42px」。
   *    放进 align-items: center 的一行后，外层 42px 的盒子被居中、里面的按钮却贴着盒子顶部，
   *    结果按钮高出 (42 - 32) / 2 = 5px。
   *    断言按「行内每个元素的垂直中心都与行中心重合」写，修复前必然失败。
   */
  test('文件管理工具条：同一行内的按钮与视图切换垂直居中对齐', async ({ page }) => {
    await login(page)
    await page.goto('/tool/file')
    await expect(page.locator('.wb-tool-file__bar')).toBeVisible({ timeout: 10000 })

    const m = await page.evaluate(() => {
      const box = (el: Element) => {
        const r = el.getBoundingClientRect()
        return {
          top: +r.top.toFixed(2),
          h: +r.height.toFixed(2),
          cy: +(r.top + r.height / 2).toFixed(2)
        }
      }
      const bar = document.querySelector('.wb-tool-file__bar') as HTMLElement
      const barBox = box(bar)
      const items = [...bar.querySelectorAll('.el-button, .el-radio-group')].map((el) => {
        const b = box(el)
        return {
          label: (el.textContent || '').replace(/\s+/g, '').slice(0, 8),
          ...b,
          delta: +(b.cy - barBox.cy).toFixed(2)
        }
      })
      const upload = document.querySelector('.wb-upload') as HTMLElement | null
      const trigger = upload?.querySelector('.el-button') as HTMLElement | null
      const list = document.querySelector('.wb-upload .el-upload-list') as HTMLElement | null
      return {
        barH: barBox.h,
        items,
        uploadH: upload ? box(upload).h : -1,
        triggerH: trigger ? box(trigger).h : -1,
        listMarginTop: list ? getComputedStyle(list).marginTop : 'n/a',
        listLi: list ? list.querySelectorAll('li').length : -1
      }
    })

    expect(m.items.length, '这一行的元素数量').toBeGreaterThanOrEqual(4)

    // 核心断言：行内每个元素都落在同一条水平中心线上
    for (const it of m.items) {
      expect(Math.abs(it.delta), `「${it.label}」相对行中心偏差 ${it.delta}px`).toBeLessThanOrEqual(0.5)
    }
    // 同一行的元素顶边也应一致（不只是中心线，高度也要相同）
    const tops = [...new Set(m.items.map((i) => i.top))]
    expect(tops.length, `行内元素 top 不一致 ${JSON.stringify(tops)}`).toBe(1)

    /*
     * 场景自检：必须真的处于「空文件列表」状态，否则上面的断言测不到东西
     * （有了已上传文件时这个 <ul> 本来就有内容，那段 10px 间距是合理的）。
     */
    expect(m.listLi, '自检：应处于没有已上传文件的状态').toBe(0)
    expect(m.listMarginTop, '空文件列表的 margin-top').toBe('0px')
    // 上传组件外层盒子不能凭空高出触发按钮，否则它就会在居中行里向上错位
    expect(m.uploadH, `上传组件外层高度 ${m.uploadH} vs 触发按钮 ${m.triggerH}`).toBeCloseTo(m.triggerH, 0)
  })
})
