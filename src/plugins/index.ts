import { ElNotification } from 'element-plus'
import type { App, Component } from 'vue'
import dict from '@/components/Dict/index'

const globalComponents: Record<string, Component> = {
  DictTag: dict.DictTag,
  DictSelect: dict.DictSelect
}

/** 注册使用频率极高的全局组件 */
export function registerGlobalComponents(app: App): void {
  Object.entries(globalComponents).forEach(([name, comp]) => {
    if (comp) app.component(name, comp)
  })
}

/** 全局错误处理 + 未捕获 Promise 上报位 */
export function setupErrorHandler(app: App): void {
  app.config.errorHandler = (err, _vm, info) => {
    console.error('[WB-Admin] runtime error:', err, info)
    if (import.meta.env.PROD) {
      ElNotification.error({
        title: '运行时错误',
        message: (err as Error)?.message || '未知错误',
        duration: 5000
      })
    }
  }

  window.addEventListener('unhandledrejection', (event) => {
    // 路由切换时的主动取消是预期行为，不算异常，静默掉避免刷控制台
    if (isCanceled(event.reason)) {
      event.preventDefault()
      return
    }
    console.error('[WB-Admin] unhandled rejection:', event.reason)
    event.preventDefault()
  })
}

/** axios 主动取消 / AbortController 中断，都是预期内的，不算错误 */
function isCanceled(reason: unknown): boolean {
  const e = reason as { name?: string; code?: string; message?: string } | null
  if (!e) return false
  return (
    e.name === 'CanceledError' ||
    e.name === 'AbortError' ||
    e.code === 'ERR_CANCELED' ||
    e.message === 'canceled' ||
    String(e.message ?? '').includes('canceled')
  )
}

export default { registerGlobalComponents, setupErrorHandler }
