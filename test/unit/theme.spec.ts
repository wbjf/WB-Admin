import { describe, expect, it } from 'vitest'
import { generatePrimaryPalette, applyPrimaryColor } from '@/utils/theme'
import { isEmail, isPhone, passwordLevel, isExternal, isIdCard } from '@/utils/validate'
import { resolveTitle } from '@/utils/page'

describe('theme', () => {
  it('主色生成 6 级色阶', () => {
    const palette = generatePrimaryPalette('#409eff')
    expect(Object.keys(palette).sort()).toEqual([
      'dark2',
      'light3',
      'light5',
      'light7',
      'light8',
      'light9'
    ])
    palette.light9.toLowerCase()
    expect(palette.light9).toMatch(/^#[0-9a-f]{6}$/i)
  })

  it('色阶混合方向正确：light9 更接近白色', () => {
    const p = generatePrimaryPalette('#409eff')
    const brightness = (hex: string) =>
      parseInt(hex.slice(1, 3), 16) + parseInt(hex.slice(3, 5), 16) + parseInt(hex.slice(5, 7), 16)
    expect(brightness(p.light9)).toBeGreaterThan(brightness(p.dark2))
  })
})

describe('validate', () => {
  it('邮箱与手机号', () => {
    expect(isEmail('a@b.com')).toBe(true)
    expect(isEmail('a@b')).toBe(false)
    expect(isPhone('13800138000')).toBe(true)
    expect(isPhone('12345')).toBe(false)
  })

  it('身份证', () => {
    expect(isIdCard('11010519491231002X')).toBe(true)
    expect(isIdCard('123')).toBe(false)
  })

  it('外链识别', () => {
    expect(isExternal('https://example.com')).toBe(true)
    expect(isExternal('/system/user')).toBe(false)
  })

  it('密码强度', () => {
    expect(passwordLevel('123')).toBe(0)
    expect(passwordLevel('Abcd1234')).toBe(1)
    expect(passwordLevel('Abcd1234!')).toBe(2)
  })
})

describe('page title', () => {
  it('普通标题原样返回', () => {
    expect(resolveTitle('用户管理')).toBe('用户管理')
  })

  it('未命中 i18n 时降级为最后一段', () => {
    expect(resolveTitle('menu.notExistKey')).toBe('notExistKey')
  })
})
