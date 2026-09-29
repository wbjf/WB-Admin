<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useSettingsStore } from '@/stores/modules/settings'
import { usePermissionStore } from '@/stores/modules/permission'
import SidebarItem from './SidebarItem.vue'

const route = useRoute()
const settings = useSettingsStore()
const permission = usePermissionStore()

const menus = computed(() => permission.visibleMenus)

const appTitle = import.meta.env.VITE_APP_TITLE || 'WB-Admin'

const activeMenu = computed(() => {
  const { meta, path } = route
  return (meta.activeMenu as string) || path
})

/** 混合布局：顶部一级菜单，侧边显示当前一级的子菜单 */
const mixChildren = computed(() => {
  if (settings.layout !== 'mix') return menus.value
  const root = menus.value.find((m) => `/${String(m.path).replace(/^\//, '')}` === `/${activeMenu.value.split('/')[1]}`)
  return root?.children ?? []
})
</script>

<template>
  <div class="wb-sidebar" :class="{ 'is-collapsed': !settings.sidebarOpened }">
    <div class="wb-sidebar__logo">
      <img src="/favicon.svg" alt="logo" width="24" height="24" />
      <span v-if="settings.sidebarOpened" class="wb-sidebar__title">
        {{ appTitle }}
      </span>
    </div>

    <el-scrollbar class="wb-sidebar__scroll">
      <el-menu
        :default-active="activeMenu"
        :collapse="!settings.sidebarOpened"
        :collapse-transition="false"
        :unique-opened="settings.layout === 'mix'"
        router
      >
        <SidebarItem
          v-for="menu in mixChildren"
          :key="menu.id"
          :item="menu"
          :base-path="settings.layout === 'mix' ? `/${String(menu.path).replace(/^\//, '')}` : ''"
        />
      </el-menu>
    </el-scrollbar>
  </div>
</template>

<style scoped lang="scss">
.wb-sidebar {
  width: var(--wb-sidebar-width);
  height: 100%;
  background: var(--wb-bg-card);
  border-right: 1px solid var(--wb-border);
  display: flex;
  flex-direction: column;
  transition: width 0.28s;

  &.is-collapsed {
    width: var(--wb-sidebar-collapsed-width);
  }

  &__logo {
    height: var(--wb-navbar-height);
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 16px;
    font-weight: 500;
    font-size: 15px;
    flex: none;
    overflow: hidden;
  }

  &__title {
    white-space: nowrap;
  }

  &__scroll {
    flex: 1;
    min-height: 0;
    /* 菜单区的上下留白放这里。
     * 不能放到 .el-menu 的 padding 里：EP 的折叠过渡会先把 paddingTop/Bottom
     * 归零、再读 scrollHeight 当动画目标高度，带垂直 padding 的容器必然少测
     * 一个 padding，动画收尾 max-height 归位 auto 时就会「弹」一下。 */
    padding: 6px 0;
  }

  /*
   * 菜单配色只能在这里定义，不能走 el-menu 的 background-color / text-color 属性。
   * 原因：EP 用 useMenuColor() 对 background-color 做 TinyColor().shade(20) 来推导
   * --el-menu-hover-bg-color；传入 "var(--wb-sidebar-bg, #fff)" 这类 CSS 变量表达式时
   * TinyColor 解析失败会兜底成 #000，hover 背景直接变纯黑，浅色文字系下菜单名不可读。
   * 且 EP 是把这些变量内联写在元素上的，内联优先级高于任意选择器，事后覆盖不掉。
   */
  :deep(.el-menu) {
    --el-menu-bg-color: transparent;
    --el-menu-text-color: var(--el-text-color-regular);
    --el-menu-hover-text-color: var(--el-text-color-primary);
    --el-menu-hover-bg-color: var(--el-fill-color-light);
    --el-menu-active-color: var(--el-color-primary);
    --el-menu-item-height: 42px;
    --el-menu-sub-item-height: 38px;

    border-right: none;
    /*
     * 垂直内边距必须为 0（留白交给 .wb-sidebar__scroll），且这里绝对不能写
     * transition —— 两个坑叠在一起会让子菜单的展开/收起彻底没有动画：
     *   1) EP 的折叠过渡是 max-height 方案：beforeEnter 先把 paddingTop/Bottom
     *      归零，再读 el.scrollHeight 作为动画目标。带垂直 padding 时量出的
     *      目标高度比真实高度小一个 padding（实测 394 vs 410），动画收尾
     *      max-height 归位 auto 时内容一下子「弹」出来。
     *   2) transition 写在 .el-menu 上会命中子菜单的 ul：作用在同一个元素上，
     *      且 (0,2,0) 的优先级高于 EP 给 .el-collapse-transition-*-active 设的
     *      `transition: max-height .3s`（(0,1,0)），直接把过渡覆盖掉 ——
     *      结果 max-height 变化变成瞬时跳变，只剩 padding 在慢慢蠕动。
     */
    padding: 0 8px;
  }

  :deep(.el-menu-item),
  :deep(.el-sub-menu__title) {
    height: var(--el-menu-item-height);
    line-height: var(--el-menu-item-height);
    margin: 2px 0;
    border-radius: 6px;
    transition:
      background-color 0.2s,
      color 0.2s;
  }

  /* 激活项：主色浅底 + 主色文字 */
  :deep(.el-menu-item.is-active) {
    background-color: var(--wb-menu-active-bg);
    color: var(--el-menu-active-color);
    font-weight: 500;
  }

  /* 含激活子项的父级标题也跟随主色 */
  :deep(.el-sub-menu.is-active > .el-sub-menu__title) {
    color: var(--el-menu-active-color);
  }

  /*
   * 子菜单 ul 的首尾项去掉外边距。
   * EP 的折叠过渡用 scrollHeight 算动画目标高度，而 scrollHeight 不含子元素的
   * 外边距，首尾各 2px 会让展开动画在收尾时「弹」4px。
   */
  :deep(.el-menu--inline) {
    > .el-menu-item:first-child,
    > .el-sub-menu:first-child {
      margin-top: 0;
    }

    > .el-menu-item:last-child,
    > .el-sub-menu:last-child {
      margin-bottom: 0;
    }
  }

  /* 折叠态：图标居中，去掉横向内缩留白 */
  :deep(.el-menu--collapse) {
    /*
     * 宽度改成跟随容器，不用 EP 给的固定 64px。
     * 折叠动画期间 .wb-sidebar 的宽度是 0.28s 过渡的，而 EP 的
     * .el-menu--collapse{width:calc(...)} 会让菜单内容在一帧内跳到终态宽度，
     * 出现「内容先缩、外框后缩」的错位（实测一帧内 219 → 64）。
     * 设成 100% 后菜单宽度始终等于容器宽度，两者同步收窄。
     * 折叠完成时容器宽 64px，与 EP 的计算值一致，外观不变。
     */
    width: 100%;
    /* 与展开态保持一致，避免切换瞬间内缩量变化 */
    padding: 0 8px;

    .el-menu-item,
    .el-sub-menu__title {
      padding: 0 !important;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  }
}
</style>
