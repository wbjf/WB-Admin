import { createI18n } from 'vue-i18n'
import zhCN from './lang/zh-CN'
import enUS from './lang/en-US'
import elementZhCn from 'element-plus/es/locale/lang/zh-cn'
import elementEn from 'element-plus/es/locale/lang/en'

export type LocaleKey = 'zh-CN' | 'en-US'
export const LOCALE_STORAGE_KEY = 'wb-admin-locale'

export const messages = {
  'zh-CN': zhCN,
  'en-US': enUS
} as const

export const elementLocales = {
  'zh-CN': elementZhCn,
  'en-US': elementEn
}

export function getCurrentLocale(): LocaleKey {
  return (localStorage.getItem(LOCALE_STORAGE_KEY) as LocaleKey) || 'zh-CN'
}

export function setCurrentLocale(locale: LocaleKey): void {
  localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  document.documentElement.setAttribute('lang', locale)
}

export const LOCALE_CHANGE_EVENT = 'wb-locale-change'

export function setLocale(locale: LocaleKey): void {
  ;(i18n.global.locale as any).value = locale
  localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  document.documentElement.setAttribute('lang', locale)
  window.dispatchEvent(new CustomEvent(LOCALE_CHANGE_EVENT, { detail: locale }))
}

export function getNextLocale(): LocaleKey {
  return getCurrentLocale() === 'zh-CN' ? 'en-US' : 'zh-CN'
}

const i18n = createI18n({
  legacy: false,
  locale: getCurrentLocale(),
  fallbackLocale: 'zh-CN',
  messages
})

/** 非组件环境可用的翻译函数 */
export const t = i18n.global.t as unknown as (key: string, ...args: any[]) => string

export default i18n
