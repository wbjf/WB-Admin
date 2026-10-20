import { describe, expect, it } from 'vitest'
import { compareDeviceName, deviceGroupKey, groupWeight, nameGroupOf } from '@/utils/device-sort'

/**
 * 回归来源：需求口径「偏好 → 数字开头 → 字母开头，数字按 0-9、字母按 A-Z」。
 * 最容易错的两点单独拎出来测：
 *   1. 数字部分要按数值比（A9 在 A10 之前，10 在 9 之后），字符串序会把 A10 排到 A9 前面
 *   2. 数字开头的必须整体排在字母开头之前
 */

const sorted = (list: string[]) => [...list].sort(compareDeviceName)

describe('nameGroupOf 分档', () => {
  it('按首字符分成 数字 / 字母 / 其它', () => {
    expect(nameGroupOf('A1')).toBe('letter')
    expect(nameGroupOf('a1')).toBe('letter')
    expect(nameGroupOf('1号机')).toBe('digit')
    expect(nameGroupOf('10号机')).toBe('digit')
    expect(nameGroupOf('冷水机组')).toBe('other')
    expect(nameGroupOf('')).toBe('other')
    expect(nameGroupOf(null)).toBe('other')
  })

  it('前导空格不影响分档', () => {
    expect(nameGroupOf(' A1')).toBe('letter')
    expect(nameGroupOf(' 2号线')).toBe('digit')
  })
})

describe('compareDeviceName 排序', () => {
  it('需求给的样例：A1,A2,A3,A6,A9,A4 → A1,A2,A3,A4,A6,A9', () => {
    expect(sorted(['A1', 'A2', 'A3', 'A6', 'A9', 'A4'])).toEqual([
      'A1',
      'A2',
      'A3',
      'A4',
      'A6',
      'A9'
    ])
  })

  it('数字部分按数值比，A9 排在 A10 之前', () => {
    expect(sorted(['A10', 'A9', 'A1'])).toEqual(['A1', 'A9', 'A10'])
    expect(compareDeviceName('A9', 'A10')).toBeLessThan(0)
  })

  it('数字开头的整体排在字母开头之前', () => {
    expect(sorted(['A1', 'B2', '1号机', '3号线'])).toEqual(['1号机', '3号线', 'A1', 'B2'])
    expect(compareDeviceName('9号机', 'A1')).toBeLessThan(0)
    expect(compareDeviceName('A1', '9号机')).toBeGreaterThan(0)
  })

  it('数字内部按 0-9 数值排，1 < 2 < 10', () => {
    expect(sorted(['10号机', '2号线', '1号行车'])).toEqual(['1号行车', '2号线', '10号机'])
  })

  it('字母按 A-Z；大小写不敏感但顺序稳定', () => {
    expect(sorted(['C1', 'A1', 'b1', 'B1'])).toEqual(['A1', 'B1', 'b1', 'C1'])
  })

  it('中文等「其它」档垫底', () => {
    const list = ['冷水机组', 'A1', '1号线']
    expect(sorted(list)).toEqual(['1号线', 'A1', '冷水机组'])
  })

  it('空值不会抛错', () => {
    expect(() => sorted(['', 'A1', undefined as unknown as string])).not.toThrow()
  })
})

describe('deviceGroupKey / groupWeight', () => {
  it('数字开头取该数字、字母开头取大写字母，其余走拼音', () => {
    expect(deviceGroupKey('10号机')).toBe('1')
    expect(deviceGroupKey('2号线')).toBe('2')
    expect(deviceGroupKey('a1')).toBe('A')
    expect(deviceGroupKey('B10')).toBe('B')
    expect(deviceGroupKey('冷水机组')).toBe('L')
    expect(deviceGroupKey('')).toBe('#')
  })

  it('分组权重：数字档 → 字母档 → 其它档', () => {
    expect(groupWeight('9') < groupWeight('A')).toBe(true)
    expect(groupWeight('A') < groupWeight('Z')).toBe(true)
    expect(groupWeight('Z') < groupWeight('#')).toBe(true)
    expect(groupWeight('') < groupWeight('0')).toBe(false)
  })
})
