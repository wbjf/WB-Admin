<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePermissionStore } from '@/stores/modules/permission'
import type { MenuInfo } from '@/types'

defineOptions({ name: 'TopMenu' })

const permission = usePermissionStore()
const router = useRouter()
const route = useRoute()

const activePath = computed(() => route.path)

function indexPath(parent: MenuInfo, child?: MenuInfo): string {
  const base = String(parent.path ?? '').replace(/\/$/, '')
  if (!child) return base || parent.id
  const sub = String(child.path ?? '')
  if (sub.startsWith('/')) return sub
  return `${base}/${sub}`.replace(/\/+/g, '/')
}

function go(menu: MenuInfo) {
  if (menu.type === 'L') {
    window.open(menu.path, '_blank')
    return
  }
  router.push(String(menu.path ?? '/'))
}
</script>

<template>
  <el-menu
    mode="horizontal"
    :ellipsis="false"
    class="wb-top-menu"
    :default-active="activePath"
    router
  >
    <template v-for="menu in permission.visibleMenus" :key="menu.id">
      <el-sub-menu v-if="menu.children?.length" :index="menu.id" teleported>
        <template #title>{{ menu.title }}</template>
        <el-menu-item
          v-for="child in menu.children"
          :key="child.id"
          :index="indexPath(menu, child)"
        >
          {{ child.title }}
        </el-menu-item>
      </el-sub-menu>
      <el-menu-item v-else :index="indexPath(menu)" @click="go(menu)">
        {{ menu.title }}
      </el-menu-item>
    </template>
  </el-menu>
</template>

<style scoped lang="scss">
.wb-top-menu {
  /* 与侧边栏共用一套菜单配色，避免两种布局下观感不一致 */
  --el-menu-bg-color: transparent;
  --el-menu-text-color: var(--el-text-color-regular);
  --el-menu-hover-text-color: var(--el-text-color-primary);
  --el-menu-hover-bg-color: var(--el-fill-color-light);
  --el-menu-active-color: var(--el-color-primary);
  /* EP 横向菜单默认 60px，比 56px 的导航栏还高，会顶出容器 */
  --el-menu-horizontal-height: var(--wb-navbar-height);

  border-bottom: none;
  flex: 1;
  min-width: 0;
  height: var(--wb-navbar-height);

  :deep(.el-menu-item),
  :deep(.el-sub-menu__title) {
    border-bottom: none;
    transition:
      background-color 0.2s,
      color 0.2s;
  }

  /* 激活态改用主色下划线，与 EP 默认行为一致但下划线更细更稳 */
  :deep(.el-menu-item.is-active) {
    border-bottom: 2px solid var(--el-menu-active-color);
    font-weight: 500;
  }
}
</style>
