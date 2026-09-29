<script setup lang="ts">
import { computed } from 'vue'
import { useTagsViewStore } from '@/stores/modules/tagsView'
import { useSettingsStore } from '@/stores/modules/settings'

defineOptions({ name: 'AppMain' })

const tagsStore = useTagsViewStore()
const settings = useSettingsStore()

const cached = computed(() => tagsStore.cachedViews)
</script>

<template>
  <section class="wb-app-main">
    <router-view v-slot="{ Component, route }">
      <transition :name="settings.animation ? 'fade-transform' : ''" mode="out-in">
        <keep-alive :include="cached">
          <component :is="Component" :key="route.path" />
        </keep-alive>
      </transition>
    </router-view>
  </section>
</template>

<style scoped lang="scss">
/**
 * 内容区：全站留白的唯一来源。
 * overflow: hidden —— 窗口与内容区都不出现滚动条，
 * 纵向滚动交给 .wb-page（页面容器）或模块内部处理。
 */
.wb-app-main {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding: var(--wb-content-padding);
  position: relative;
}
</style>
