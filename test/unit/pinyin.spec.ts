import { beforeEach, describe, expect, it } from 'vitest'
import {
  compareName,
  getInitial,
  INITIAL_OTHER,
  isPinyinSupported,
  setInitialResolver
} from '@/utils/pinyin'

describe('getInitial', () => {
  it('英文取首字符并转大写', () => {
    expect(getInitial('Assembly Robot')).toBe('A')
    expect(getInitial('screw feeder')).toBe('S')
  })

  it('数字与其它符号归入 # 桶', () => {
    expect(getInitial('1 号行车')).toBe(INITIAL_OTHER)
    expect(getInitial('###')).toBe(INITIAL_OTHER)
    expect(getInitial('')).toBe(INITIAL_OTHER)
    expect(getInitial(undefined)).toBe(INITIAL_OTHER)
  })

  it('前导空白 / 标点不影响取字', () => {
    expect(getInitial('  注塑机')).toBe('Z')
    // 只跳过符号、不跳过汉字：这里取到的是「备」而不是「空」
    expect(getInitial('（备用）空压机')).toBe('B')
  })

  // 依赖运行环境的 ICU 是否带中文拼音排序规则。
  // 没有的话整个探测会降级到 '#'，此时这条用例不成立 —— 先确认能力再断言，
  // 免得换个环境就假红。
  it('中文取拼音首字母', () => {
    if (!isPinyinSupported()) return
    expect(getInitial('注塑机')).toBe('Z')
    expect(getInitial('冷水机组')).toBe('L')
    expect(getInitial('压铸机')).toBe('Y')
    expect(getInitial('磨床')).toBe('M')
    expect(getInitial('  中央空调')).toBe('Z')
  })

  it('一个字母段内的边界字都判定正确', () => {
    if (!isPinyinSupported()) return
    const cases: Array<[string, string]> = [
      ['按摩椅', 'A'],
      ['冰箱', 'B'],
      ['传送带', 'C'],
      ['打包机', 'D'],
      ['二次除尘', 'E'],
      ['风机', 'F'],
      ['给料机', 'G'],
      ['烘干机', 'H'],
      ['加氢反应器', 'J'],
      ['空压机', 'K'],
      ['冷水机', 'L'],
      ['磨床', 'M'],
      ['暖通主机', 'N'],
      ['耦合器', 'O'],
      ['皮带机', 'P'],
      ['起重机', 'Q'],
      ['热轧线', 'R'],
      ['输送泵', 'S'],
      ['提升机', 'T'],
      ['外循环泵', 'W'],
      ['铣床', 'X'],
      ['液压站', 'Y'],
      // 刻意避开多音字（如「轧」zhá/yà，ICU 取 yà）—— 多音字必须靠 resolver 订正
      ['闸阀', 'Z']
    ]
    cases.forEach(([name, letter]) => {
      expect(getInitial(name), name).toBe(letter)
    })
  })
})

describe('compareName', () => {
  it('按拼音升序', () => {
    if (!isPinyinSupported()) return
    const names = ['注塑机', '烤箱', '冰箱', '压铸机', '铣床', '钻床']
    expect([...names].sort(compareName)).toEqual([
      '冰箱',
      '烤箱',
      '铣床',
      '压铸机',
      '注塑机',
      '钻床'
    ])
  })

  it('数字走自然序：2 排在 10 前面', () => {
    const names = ['装配机器人-10', '装配机器人-2', '装配机器人-1']
    expect([...names].sort(compareName)).toEqual(['装配机器人-1', '装配机器人-2', '装配机器人-10'])
  })

  it('空值不抛错', () => {
    expect(() => compareName(undefined, 'abc')).not.toThrow()
    expect(() => compareName(null, undefined)).not.toThrow()
  })
})

describe('setInitialResolver', () => {
  beforeEach(() => setInitialResolver(null))

  it('可以整体接管首字母计算（多音字订正）', () => {
    setInitialResolver((text, fallback) => (text.startsWith('重庆') ? 'C' : fallback))
    if (!isPinyinSupported()) return
    expect(getInitial('冷水机')).toBe('L')
    expect(getInitial('重庆分厂冷机')).toBe('C')
  })

  it('钩子抛错时回退到内置结果，不能让调用方崩掉', () => {
    setInitialResolver(() => {
      throw new Error('boom')
    })
    expect(getInitial('ABC')).toBe('A')
  })
})
