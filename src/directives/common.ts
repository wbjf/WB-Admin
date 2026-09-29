import type { Directive, DirectiveBinding } from 'vue'
import { ElMessage } from 'element-plus'
import { t } from '@/locales'

async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

/** v-copy="'文本内容'" / v-copy:callback */
export const copy: Directive = {
  mounted(el: HTMLElement, binding: DirectiveBinding) {
    el.dataset.copyText = String(binding.value ?? '')
    el.style.cursor = 'pointer'
    el.addEventListener('click', handler)
    function handler() {
      const text = el.dataset.copyText || el.textContent || ''
      writeClipboard(text).then((ok) => {
        ElMessage[ok ? 'success' : 'error'](ok ? t('common.copied') : t('common.failed'))
        if (typeof binding.arg === 'function') binding.arg(text)
      })
    }
    ;(el as any).__copyHandler = handler
  },
  updated(el: HTMLElement, binding: DirectiveBinding) {
    el.dataset.copyText = String(binding.value ?? '')
  },
  unmounted(el: HTMLElement) {
    if ((el as any).__copyHandler) el.removeEventListener('click', (el as any).__copyHandler)
  }
}

/** v-debounce="fn" 可加 arg 为延时，默认 300ms */
export const debounce: Directive = {
  mounted(el: HTMLElement, binding: DirectiveBinding) {
    if (typeof binding.value !== 'function') return
    let timer: ReturnType<typeof setTimeout> | null = null
    const delay = Number(binding.arg) || 300
    const handler = (...args: any[]) => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => binding.value(...args), delay)
    }
    el.addEventListener('click', handler)
    ;(el as any).__debounceHandler = handler
  },
  unmounted(el: HTMLElement) {
    if ((el as any).__debounceHandler) {
      el.removeEventListener('click', (el as any).__debounceHandler)
    }
  }
}

/** v-longpress="fn" 长按 700ms 触发 */
export const longpress: Directive = {
  mounted(el: HTMLElement, binding: DirectiveBinding) {
    if (typeof binding.value !== 'function') return
    let timer: ReturnType<typeof setTimeout> | null = null
    const start = () => {
      timer = setTimeout(() => binding.value(), 700)
    }
    const cancel = () => {
      if (timer) clearTimeout(timer)
      timer = null
    }
    el.addEventListener('mousedown', start)
    el.addEventListener('touchstart', start)
    el.addEventListener('mouseup', cancel)
    el.addEventListener('mouseleave', cancel)
    el.addEventListener('touchend', cancel)
    ;(el as any).__longpressCancel = cancel
  },
  unmounted(el: HTMLElement) {
    ;(el as any).__longpressCancel?.()
  }
}

/** v-drag 使浮层可拖动 */
export const drag: Directive = {
  mounted(el: HTMLElement, binding: DirectiveBinding) {
    const handle = binding.arg
      ? (el.querySelector(binding.arg) as HTMLElement | null) || el
      : el
    handle.style.cursor = 'move'
    handle.addEventListener('mousedown', onMouseDown)
    ;(el as any).__dragHandle = handle

    function onMouseDown(e: MouseEvent) {
      if (e.button !== 0) return
      const rect = el.getBoundingClientRect()
      const startX = e.clientX
      const startY = e.clientY
      const originLeft = rect.left
      const originTop = rect.top
      el.style.position = 'fixed'
      el.style.left = `${originLeft}px`
      el.style.top = `${originTop}px`
      el.style.margin = '0'
      const move = (ev: MouseEvent) => {
        let nextLeft = originLeft + ev.clientX - startX
        let nextTop = originTop + ev.clientY - startY
        nextLeft = Math.max(0, Math.min(nextLeft, window.innerWidth - rect.width))
        nextTop = Math.max(0, Math.min(nextTop, window.innerHeight - rect.height))
        el.style.left = `${nextLeft}px`
        el.style.top = `${nextTop}px`
      }
      const up = () => {
        document.removeEventListener('mousemove', move)
        document.removeEventListener('mouseup', up)
      }
      document.addEventListener('mousemove', move)
      document.addEventListener('mouseup', up)
    }
    ;(handle as any).__dragMouseDown = onMouseDown
  },
  unmounted(el: HTMLElement) {
    const handle = (el as any).__dragHandle as HTMLElement | undefined
    if (handle && (handle as any).__dragMouseDown) {
      handle.removeEventListener('mousedown', (handle as any).__dragMouseDown)
    }
  }
}
