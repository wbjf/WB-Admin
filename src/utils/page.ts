import type { RouteLocationNormalized } from 'vue-router'
import { t } from '@/locales'

const APP_TITLE = import.meta.env.VITE_APP_TITLE || 'WB-Admin'

/** meta.title 支持 i18n key（menu.xxx / route.xxx / error.xxx） */
export function resolveTitle(title?: string): string {
  if (!title) return ''
  if (/^(menu|route|error|common)\./.test(title)) {
    const val = t(title as any)
    return val === title ? title.split('.').pop() || title : val
  }
  return title
}

export function setPageTitle(route: RouteLocationNormalized): void {
  const meta = route.meta as Record<string, any>
  const title = resolveTitle(meta?.title as string)
  document.title = title ? `${title} - ${APP_TITLE}` : APP_TITLE
}
