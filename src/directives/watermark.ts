import type { Directive, DirectiveBinding } from 'vue'

interface WatermarkOptions {
  text: string
  fontSize?: number
  color?: string
  rotate?: number
  gap?: number
  opacity?: number
}

function createBase64(options: WatermarkOptions): string {
  const { text, fontSize = 14, color = 'rgba(0,0,0,0.15)', rotate = -22, gap = 120 } = options
  const canvas = document.createElement('canvas')
  const width = gap * 2
  const height = gap
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, width, height)
  ctx.font = `${fontSize}px -apple-system, "Microsoft YaHei", sans-serif`
  ctx.fillStyle = color
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.translate(width / 2, height / 2)
  ctx.rotate((rotate * Math.PI) / 180)
  const lines = String(text).split('|')
  lines.forEach((line, i) => {
    ctx.fillText(line, -ctx.measureText(line).width / 2, (i - (lines.length - 1) / 2) * (fontSize + 6))
  })
  return canvas.toDataURL('image/png')
}

function apply(el: HTMLElement, options: WatermarkOptions): void {
  remove(el)
  const wrap = document.createElement('div')
  wrap.className = 'wb-watermark-layer'
  Object.assign(wrap.style, {
    position: 'absolute',
    inset: '0',
    pointerEvents: 'none',
    zIndex: '9999',
    backgroundImage: `url(${createBase64(options)})`,
    backgroundRepeat: 'repeat',
    opacity: String(options.opacity ?? 1)
  })
  el.appendChild(wrap)
  const prev = getComputedStyle(el).position
  if (prev === 'static') el.style.position = 'relative'
  ;(el as any).__watermark = wrap
}

function remove(el: HTMLElement): void {
  const exist = el.querySelector('.wb-watermark-layer')
  if (exist) exist.remove()
  ;(el as any).__watermark = null
}

/** v-watermark="用户信息 + 时间" */
export const watermark: Directive = {
  mounted(el: HTMLElement, binding: DirectiveBinding) {
    const value = binding.value
    const options: WatermarkOptions =
      typeof value === 'string' ? { text: value } : { text: 'WB-Admin', ...(value ?? {}) }
    if (!options.text) return
    apply(el, options)
  },
  updated(el: HTMLElement, binding: DirectiveBinding) {
    if (binding.value === binding.oldValue) return
    const value = binding.value
    const options: WatermarkOptions =
      typeof value === 'string' ? { text: value } : { text: 'WB-Admin', ...(value ?? {}) }
    options.text ? apply(el, options) : remove(el)
  },
  unmounted(el: HTMLElement) {
    remove(el)
  }
}
