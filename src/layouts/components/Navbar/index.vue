<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import screenfull from 'screenfull'
import {
  Bell,
  Expand,
  Fold,
  FullScreen,
  Grid,
  Lock,
  Refresh,
  Search,
  Setting
} from '@element-plus/icons-vue'
import { useSettingsStore } from '@/stores/modules/settings'
import { useUserStore } from '@/stores/modules/user'
import { useAppStore } from '@/stores/modules/app'
import { useTenantStore } from '@/stores/modules/tenant'
import { useI18n } from 'vue-i18n'
import { getCurrentLocale, setLocale, type LocaleKey } from '@/locales'
import Breadcrumb from '../Breadcrumb.vue'
import TopMenu from '../TopMenu.vue'

defineOptions({ name: 'Navbar' })

const emit = defineEmits(['openSettings', 'openSearch'])
const router = useRouter()
const { t } = useI18n()

const settings = useSettingsStore()
const userStore = useUserStore()
const appStore = useAppStore()
const tenantStore = useTenantStore()

/**
 * 租户下拉选项。
 * 归一化（分页对象 / 历史脏数据 / 缺 tenantId）统一收口在 store 的 options getter 里，
 * 组件侧只负责取用 —— 否则每个用到租户列表的地方都要各自防御一遍。
 */
const tenantOptions = computed(() => tenantStore.options)

const fullscreen = ref(false)
const noticeVisible = ref(false)
const localeKey = ref<LocaleKey>(getCurrentLocale())

function toggleSidebar() {
  settings.toggleSidebar()
}

function toggleFullscreen() {
  if (!screenfull.isEnabled) return
  screenfull.toggle()
  fullscreen.value = !fullscreen.value
}

function refreshCurrent() {
  appStore.setGlobalLoading(true)
  const { fullPath } = router.currentRoute.value
  router.replace({ path: '/redirect' + fullPath })
  setTimeout(() => appStore.setGlobalLoading(false), 400)
}

function switchLanguage(key: LocaleKey) {
  localeKey.value = key
  setLocale(key)
}

async function handleCommand(command: string) {
  if (command === 'profile') {
    router.push('/profile')
    return
  }
  if (command === 'logout') {
    try {
      await ElMessageBox.confirm('确定注销并退出系统吗？', '提示', {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      })
      await userStore.logout()
      router.push(`/login?redirect=${encodeURIComponent(router.currentRoute.value.fullPath)}`)
    } catch {
      /* cancel */
    }
  }
}

async function switchTenant(tenantId: string) {
  await tenantStore.setCurrent(tenantId)
}

if (tenantStore.enabled) {
  void tenantStore.loadTenants()
}
</script>

<template>
  <div class="wb-navbar" :class="{ 'is-fixed': settings.fixedHeader }">
    <div class="wb-navbar__left">
      <el-icon v-if="settings.layout !== 'top'" class="wb-icon-btn" @click="toggleSidebar">
        <component :is="settings.sidebarOpened ? Fold : Expand" />
      </el-icon>
      <!--
        左侧布局用面包屑定位；顶部布局与混合布局用一级菜单条。
        混合布局的侧边栏由 Sidebar 的 mixChildren 只渲染「当前一级」的子菜单，
        所以顶部必须给出切换一级模块的入口 —— 之前这里只判了 'top'，混合布局等于没有一级入口。
      -->
      <Breadcrumb v-if="settings.layout === 'left'" />
      <TopMenu v-if="settings.layout !== 'left'" />
    </div>

    <div class="wb-navbar__right">
      <el-tooltip :content="t('common.search')" placement="bottom">
        <el-icon class="wb-icon-btn" @click="emit('openSearch')"><Search /></el-icon>
      </el-tooltip>

      <el-tooltip :content="t('common.refresh')" placement="bottom">
        <el-icon class="wb-icon-btn" @click="refreshCurrent"><Refresh /></el-icon>
      </el-tooltip>

      <el-tooltip
        :content="fullscreen ? t('common.exitFullscreen') : t('common.fullscreen')"
        placement="bottom"
      >
        <el-icon class="wb-icon-btn" @click="toggleFullscreen"><FullScreen /></el-icon>
      </el-tooltip>

      <el-dropdown trigger="click" @command="switchLanguage">
        <el-icon class="wb-icon-btn"><Grid /></el-icon>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="zh-CN" :disabled="localeKey === 'zh-CN'">简体中文</el-dropdown-item>
            <el-dropdown-item command="en-US" :disabled="localeKey === 'en-US'">English</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>

      <el-select
        v-if="tenantStore.enabled"
        v-model="tenantStore.currentId"
        size="small"
        class="wb-navbar__tenant"
        placeholder="租户"
        @change="switchTenant"
      >
        <el-option v-for="item in tenantOptions" :key="item.tenantId" :label="item.tenantName" :value="item.tenantId" />
      </el-select>

      <el-tooltip :content="t('common.lock')" placement="bottom">
        <el-icon class="wb-icon-btn" @click="appStore.lockScreen()"><Lock /></el-icon>
      </el-tooltip>

      <el-popover trigger="click" placement="bottom" width="300" :visible="noticeVisible">
        <template #reference>
          <el-icon class="wb-icon-btn" @click="noticeVisible = !noticeVisible">
            <el-badge :value="3" :max="99"><Bell /></el-badge>
          </el-icon>
        </template>
        <div class="wb-notice">
          <div class="wb-notice__title">系统公告</div>
          <div class="wb-notice__item">关于 2026 年国庆放假安排的通知</div>
          <div class="wb-notice__item">系统将于本周六凌晨进行例行维护</div>
          <div class="wb-notice__item">新版数据看板已上线，欢迎试用</div>
        </div>
      </el-popover>

      <el-tooltip :content="t('common.theme')" placement="bottom">
        <el-icon class="wb-icon-btn" @click="emit('openSettings')"><Setting /></el-icon>
      </el-tooltip>

      <el-dropdown trigger="click" @command="handleCommand">
        <div class="wb-navbar__avatar">
          <el-avatar :size="26" :src="userStore.avatar || undefined">
            {{ userStore.displayName.slice(0, 1) }}
          </el-avatar>
          <span class="wb-navbar__name">{{ userStore.displayName }}</span>
        </div>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="profile">{{ t('common.personal') }}</el-dropdown-item>
            <el-dropdown-item command="logout" divided>{{ t('common.logout') }}</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </div>
</template>

<style scoped lang="scss">
.wb-navbar {
  height: var(--wb-navbar-height);
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  background: var(--wb-bg-card);
  border-bottom: 1px solid var(--wb-border);

  &__left,
  &__right {
    display: flex;
    align-items: center;
    /* 图标热区从 17px 提到 30px，间距相应收一点，右侧按钮组整体不至于明显变宽 */
    gap: 8px;
    min-width: 0;
  }

  &__tenant {
    width: 130px;
  }

  &__avatar {
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    outline: none;
  }

  &__name {
    font-size: 13px;
    max-width: 96px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
}

/**
 * 顶栏图标按钮。
 *
 * 坑：不要用 padding 去撑热区。el-icon 自身是 `width: 1em; height: 1em`，
 * 而 Element Plus 全局设了 `box-sizing: border-box`，于是 padding 是从这 1em 里
 * **扣**出来的 —— 原来 `font-size: 17px + padding: 5px` 内容盒只剩 7×7：
 * 里面的 svg（也是 1em）在主轴被 flex-shrink 压成 7px 宽、副轴因 `align-items: center`
 * 不收缩仍是 17px，实测渲染成 **7×17**（横向压到 41%），看起来又细又小。
 * 正解是给固定方形尺寸再居中，svg 自然按 1em 正常显示。
 *
 * 尺寸：18px 图标 ≈ 侧边栏菜单图标（EP 菜单项 .el-icon 默认 18px），
 * 30px 热区 ≈ 两倍图标宽，鼠标目标不小于 24px，符合可点击区域的经验下限。
 */
.wb-icon-btn {
  width: 30px;
  height: 30px;
  font-size: 18px;
  padding: 0;
  border-radius: 4px;
  flex: none;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: var(--el-fill-color-light);
  }
}

.wb-notice {
  &__title {
    font-weight: 500;
    margin-bottom: 8px;
  }

  &__item {
    font-size: 13px;
    padding: 6px 0;
    border-bottom: 1px dashed var(--wb-border);
    cursor: pointer;

    &:last-child {
      border-bottom: none;
    }
  }
}
</style>
