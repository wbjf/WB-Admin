<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { ElConfigProvider } from 'element-plus'
import { breakpointsTailwind, useBreakpoints } from '@vueuse/core'
import { elementLocales, getCurrentLocale, LOCALE_CHANGE_EVENT, type LocaleKey } from '@/locales'
import { useSettingsStore } from '@/stores/modules/settings'
import { useAppStore } from '@/stores/modules/app'
import { useUserStore } from '@/stores/modules/user'

const settings = useSettingsStore()
const appStore = useAppStore()
const userStore = useUserStore()

const localeKey = ref<LocaleKey>(getCurrentLocale())
const elementLocale = computed(() => elementLocales[localeKey.value])

const breakpoints = useBreakpoints(breakpointsTailwind)
const breakpointState = computed(() => {
  if (breakpoints.smallerOrEqual('md').value) return 'mobile'
  if (breakpoints.smallerOrEqual('lg').value) return 'tablet'
  return 'desktop'
})

const onLocaleChange = (e: Event) => {
  localeKey.value = (e as CustomEvent<LocaleKey>).detail
}

const watermarkText = computed(() =>
  settings.allowWatermark ? `${userStore.displayName}` : ''
)

watch(
  breakpointState,
  (val) => appStore.setDevice(val as 'mobile' | 'tablet' | 'desktop'),
  { immediate: true }
)

onMounted(() => {
  document.getElementById('app-loading')?.remove()
  window.addEventListener(LOCALE_CHANGE_EVENT, onLocaleChange)
})

onUnmounted(() => {
  window.removeEventListener(LOCALE_CHANGE_EVENT, onLocaleChange)
})
</script>

<template>
  <el-config-provider :locale="elementLocale" :size="settings.size" :z-index="3000">
    <div class="wb-root" v-watermark="watermarkText">
      <router-view />
    </div>
  </el-config-provider>
</template>

<style>
.wb-root {
  height: 100%;
}
</style>
