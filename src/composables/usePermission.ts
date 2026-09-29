import { computed } from 'vue'
import { useUserStore } from '@/stores/modules/user'
import { hasPermi, hasRole } from '@/utils/permission'

/** 组合式权限判断 */
export function usePermission() {
  const user = useUserStore()
  const permissions = computed(() => user.permissions)
  const roles = computed(() => user.roleKeys)
  const isSuperAdmin = computed(() => user.isSuperAdmin)

  return { permissions, roles, isSuperAdmin, hasPermi, hasRole }
}

export default usePermission
