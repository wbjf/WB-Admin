import { useUserStore } from '@/stores/modules/user'

function includesAny(source: string[], target: string | string[]): boolean {
  if (!target) return true
  const list = Array.isArray(target) ? target : [target]
  if (!list.length) return true
  return list.some((item) => source.includes(item))
}

/** 是否拥有某按钮权限 */
export function hasPermi(perm?: string | string[]): boolean {
  if (!perm) return true
  const user = useUserStore()
  if (user.isSuperAdmin) return true
  return includesAny(user.permissions, perm)
}

/** 是否拥有某角色 */
export function hasRole(role?: string | string[]): boolean {
  if (!role) return true
  const user = useUserStore()
  if (user.isSuperAdmin) return true
  return includesAny(user.roleKeys, role)
}

/** 任一满足即可（指令 any 模式） */
export function hasAnyPermi(perms: string[]): boolean {
  const user = useUserStore()
  if (user.isSuperAdmin) return true
  return perms.some((p) => user.permissions.includes(p))
}
