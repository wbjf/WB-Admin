import type { App, Directive } from 'vue'
import { hasPermi, hasRole } from './permission'
import { copy, debounce, drag, longpress } from './common'
import { watermark } from './watermark'

const directives: Record<string, Directive> = {
  hasPermi,
  hasRole,
  copy,
  debounce,
  longpress,
  drag,
  watermark
}

export function registerDirectives(app: App): void {
  Object.entries(directives).forEach(([name, directive]) => {
    app.directive(name, directive)
  })
}

export default directives
