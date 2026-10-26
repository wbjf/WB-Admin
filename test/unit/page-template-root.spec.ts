/**
 * 页面模板的根节点必须唯一。
 *
 * 回归：曾在编辑页 `<template>` 下先写了一行 HTML 注释再写 `.wb-page`，
 * 组件于是变成多根节点；`.wb-app-main` 里是
 * `<transition mode="out-in"> + <keep-alive>`，多根子节点拿不到单一子元素，
 * dev 下注释又不会被剥离 —— 结果是「一旦离开该页，之后所有页面都空白」，
 * 且没有任何报错（URL 变了、路由也匹配了，只是渲染不出来）。
 *
 * 这类问题在生产构建里自动消失（注释被剥离），所以只能在源码层面挡住。
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function vueFiles(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...vueFiles(p))
    else if (name.endsWith('.vue')) out.push(p)
  }
  return out
}

/**
 * 取模板区第一个「有意义」的节点：注释也算，这正是要查的东西。
 * 模板起始标签按行首匹配，避免命中 script 注释里出现的同名文本。
 */
function firstTemplateNode(src: string): string | null {
  const m = src.match(/^\s*<template[^>]*>\s*$/m)
  if (!m || m.index === undefined) return null
  const body = src.slice(m.index + m[0].length)
  const rest = body.replace(/^\s+/, '')
  const node = rest.match(/^<!--[\s\S]*?-->|^<\/?[a-zA-Z][^>\s]*/)
  return node ? node[0].slice(0, 40) : null
}

describe('页面模板根节点', () => {
  const files = vueFiles(join(process.cwd(), 'src/views'))

  it('扫到了页面文件（路径不对会让下面的断言变成假绿）', () => {
    expect(files.length).toBeGreaterThan(10)
  })

  it('每个页面的模板都以元素开头，而不是注释', () => {
    const bad = files
      .map((f) => ({ f, node: firstTemplateNode(readFileSync(f, 'utf8')) }))
      .filter((x) => x.node === null || x.node.startsWith('<!--'))
      .map((x) => `${x.f} -> ${x.node}`)
    expect(bad, bad.join('\n')).toEqual([])
  })
})
