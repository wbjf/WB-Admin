<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import * as echarts from 'echarts'
import type { EChartsOption } from 'echarts'
import { useSettingsStore } from '@/stores/modules/settings'

defineOptions({ name: 'EChart' })

const props = withDefaults(
  defineProps<{
    option: EChartsOption
    height?: string
    width?: string
    /** 是否跟随主题自动切换明暗 */
    autoTheme?: boolean
    loading?: boolean
  }>(),
  {
    height: '320px',
    width: '100%',
    autoTheme: true
  }
)

const settings = useSettingsStore()
const el = ref<HTMLDivElement>()
const chart = shallowRef<echarts.ECharts>()

function resize() {
  chart.value?.resize()
}

function init() {
  if (!el.value) return
  chart.value = echarts.init(el.value, props.autoTheme && settings.isDark ? 'dark' : undefined)
  chart.value.setOption(props.option)
}

watch(
  () => props.option,
  (v) => {
    chart.value?.setOption(v, true)
  },
  { deep: true }
)

watch(
  () => [settings.isDark, props.autoTheme],
  () => {
    chart.value?.dispose()
    init()
  }
)

watch(() => props.loading, (v) => (v ? chart.value?.showLoading() : chart.value?.hideLoading()))

let observer: ResizeObserver | null = null

onMounted(() => {
  init()
  window.addEventListener('resize', resize)
  if (el.value && 'ResizeObserver' in window) {
    observer = new ResizeObserver(resize)
    observer.observe(el.value)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
  observer?.disconnect()
  chart.value?.dispose()
})

defineExpose({ resize, getInstance: () => chart.value })
</script>

<template>
  <div ref="el" class="wb-chart" :style="{ height, width }" />
</template>

<style scoped>
.wb-chart {
  width: 100%;
}
</style>
