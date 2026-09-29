import { describe, expect, it } from 'vitest'
import { buildTree, flattenTree, findTreeNode, findTreePath, formatSize, addDateRange, pruneParams, toThousands } from '@/utils'

const list: any[] = [
  { id: '1', parentId: '0', name: 'root' },
  { id: '2', parentId: '1', name: 'a' },
  { id: '3', parentId: '1', name: 'b' },
  { id: '4', parentId: '2', name: 'a-1' }
]

describe('buildTree', () => {
  it('把扁平数组转成树', () => {
    const tree = buildTree(list, { id: 'id', parentId: 'parentId', rootValue: '0' })
    expect(tree).toHaveLength(1)
    expect(tree[0].children).toHaveLength(2)
    expect(tree[0].children![0].children![0].name).toBe('a-1')
  })

  it('无子节点时不保留 children 字段', () => {
    const tree = buildTree(list, { id: 'id', parentId: 'parentId', rootValue: '0' })
    expect(tree[0].children![0].children![0].children).toBeUndefined()
  })

  it('flattenTree 可还原扁平结构', () => {
    const tree = buildTree(list, { id: 'id', parentId: 'parentId', rootValue: '0' })
    expect(flattenTree(tree)).toHaveLength(4)
  })

  it('findTreeNode 能定位深层节点', () => {
    const tree = buildTree(list, { id: 'id', parentId: 'parentId', rootValue: '0' })
    const hit = findTreeNode(tree, (n: any) => n.name === 'a-1')
    expect(hit?.id).toBe('4')
  })

  it('findTreePath 返回父链', () => {
    const tree = buildTree(list, { id: 'id', parentId: 'parentId', rootValue: '0' })
    const path = findTreePath(tree, (n: any) => n.id === '4')
    expect(path.map((p: any) => p.id)).toEqual(['1', '2', '4'])
  })
})

describe('格式化工具', () => {
  it('formatSize 按量级换算', () => {
    expect(formatSize(0)).toBe('0.0 B')
    expect(formatSize(1024)).toBe('1.0 KB')
    expect(formatSize(1024 * 1024 * 3)).toBe('3.0 MB')
    expect(formatSize()).toBe('-')
  })

  it('toThousands 加千分位', () => {
    expect(toThousands(1234567.891, 2)).toContain('1,234,567')
  })

  it('addDateRange 注入起止时间', () => {
    const params: any = addDateRange({ pageNum: 1 }, ['2026-01-01', '2026-01-31'])
    expect(params.beginTime).toBe('2026-01-01')
    expect(params.endTime).toBe('2026-01-31')
  })

  it('pruneParams 去掉空值', () => {
    expect(pruneParams({ a: 1, b: '', c: undefined, d: null })).toEqual({ a: 1 })
  })
})
