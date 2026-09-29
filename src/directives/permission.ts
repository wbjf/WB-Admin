import type { Directive, DirectiveBinding } from 'vue'
import { useUserStore } from '@/stores/modules/user'
import { ElMessage } from 'element-plus'
import { t } from '@/locales'

function check(el: HTMLElement, binding: DirectiveBinding, source: string[]): void {
  const value = binding.value as string | string[] | undefined
  const showNotFound = binding.modifiers.notFound !== false
  if (!value || (Array.isArray(value) && value.length === 0)) return
  const list = Array.isArray(value) ? value : [value]
  const user = useUserStore()
  const passed = user.isSuperAdmin || list.some((item) => source.includes(item))
  if (!passed) {
    el.style.display = 'none'
    el.setAttribute('data-no-auth', '1')
    if (showNotFound && !binding.modifiers.silent) {
      el.addEventListener('click', stop, true)
    }
  } else {
    el.removeEventListener('click', stop, true)
    el.removeAttribute('data-no-auth')
  }
}

function stop(e: Event) {
  e.stopPropagation()
  e.preventDefault()
  ElMessage.warning(t('permission.noAccess'))
}

/** v-hasPermi="['system:user:add']" */
export const hasPermi: Directive = {
  mounted(el, binding) {
    const user = useUserStore()
    check(el, binding, user.permissions)
  },
  updated(el, binding) {
    const user = useUserStore()
    check(el, binding, user.permissions)
  }
}

/** v-hasRole="['admin']" */
export const hasRole: Directive = {
  mounted(el, binding) {
    const user = useUserStore()
    check(el, binding, user.roleKeys)
  },
  updated(el, binding) {
    const user = useUserStore()
    check(el, binding, user.roleKeys)
  }
}
