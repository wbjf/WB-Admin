<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useSettingsStore } from '@/stores/modules/settings'
import { useAppStore } from '@/stores/modules/app'
import Sidebar from './components/Sidebar/index.vue'
import Navbar from './components/Navbar/index.vue'
import TagsView from './components/TagsView.vue'
import AppMain from './components/AppMain.vue'
import LayoutFooter from './components/Footer.vue'
import SettingsPanel from './components/Settings/index.vue'
import SearchMenu from './components/SearchMenu.vue'
import LockScreen from './components/LockScreen.vue'

const settings = useSettingsStore()
const appStore = useAppStore()

const drawerVisible = ref(false)
const searchVisible = ref(false)

const layoutClass = computed(() => `wb-layout--${settings.layout}`)

const isMobile = computed(() => appStore.isMobile)

/** 移动端点击遮罩收起菜单 */
const maskVisible = computed(() => isMobile.value && settings.sidebarOpened)

function closeSidebar() {
  if (isMobile.value) settings.toggleSidebar(false)
}

/** 移动端默认收起 */
function syncResponsive() {
  if (isMobile.value) {
    settings.toggleSidebar(false)
  } else {
    settings.toggleSidebar(true)
  }
}

watch(isMobile, syncResponsive, { immediate: true })

/** Ctrl + K 唤起菜单搜索 */
function onKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    searchVisible.value = !searchVisible.value
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
    e.preventDefault()
    appStore.lockScreen()
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  settings.apply()
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})

defineExpose({ openSearch: () => (searchVisible.value = true) })
</script>

<template>
  <div class="wb-layout" :class="[layoutClass, { 'is-mobile': isMobile }]">
    <Sidebar v-if="settings.layout !== 'top'" class="wb-layout__sidebar" />

    <div class="wb-layout__main" :class="{ 'is-fixed': settings.fixedHeader }">
      <Navbar @open-settings="drawerVisible = true" @open-search="searchVisible = true">
        <template #left>
          <slot name="navbar-left" />
        </template>
      </Navbar>

      <TagsView v-if="settings.tagsView" />

      <AppMain />

      <LayoutFooter v-if="settings.footer" />
    </div>

    <div v-if="maskVisible" class="wb-layout__mask" @click="closeSidebar" />

    <SettingsPanel v-model="drawerVisible" />
    <SearchMenu v-model="searchVisible" />
    <LockScreen />
  </div>
</template>

<style scoped lang="scss">
.wb-layout {
  display: flex;
  height: 100%;
  position: relative;
  background: var(--wb-bg-page);

  &__sidebar {
    flex: none;
    height: 100%;
    z-index: 1002;
    transition: width 0.28s;
  }

  &__main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;

    &.is-fixed {
      overflow: auto;
    }
  }

  &__mask {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: 1001;
  }

  &.is-mobile .wb-layout__sidebar {
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
  }

  &.wb-layout--top {
    flex-direction: column;
  }
}
</style>
