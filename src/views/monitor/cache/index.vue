<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import type { EChartsOption } from 'echarts'
import EChart from '@/components/EChart/index.vue'
import { serverApi } from '@/api/monitor'
import { useI18n } from 'vue-i18n'

defineOptions({ name: 'MonitorCache' })

const { t } = useI18n()

interface CacheInfo {
  commandStats: { name: string; value: string }[]
  info: Record<string, any>
  dbSize: number
}

const emptyCache = (): CacheInfo => ({ commandStats: [], info: {}, dbSize: 0 })

const loading = ref(false)
const cache = ref<CacheInfo>(emptyCache())

/** ---------- 基本信息 ---------- */
const baseItems = computed(() => [
  { label: 'Redis 版本', value: cache.value.info?.version },
  { label: '运行模式', value: cache.value.info?.mode },
  { label: '连接数', value: cache.value.info?.clients },
  { label: '占用内存', value: cache.value.info?.memory },
  { label: 'Key 数量', value: cache.value.info?.keys ?? cache.value.dbSize }
])

/** ---------- 命令统计 ---------- */
const commandOption = computed<EChartsOption>(() => {
  const stats = cache.value.commandStats ?? []
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 60, right: 20, top: 24, bottom: 40 },
    xAxis: {
      type: 'category',
      data: stats.map((i) => i.name)
    },
    yAxis: { type: 'value' },
    series: [
      {
        name: '命令统计',
        type: 'bar',
        barWidth: '45%',
        itemStyle: { borderRadius: [4, 4, 0, 0], color: '#409eff' },
        data: stats.map((i) => Number(i.value) || 0)
      }
    ]
  }
})

const infoEntries = computed(() => Object.entries(cache.value.info ?? {}))

async function loadCache(): Promise<void> {
  loading.value = true
  try {
    const res = await serverApi.cache()
    cache.value = { ...emptyCache(), ...(res ?? {}) }
  } catch (e: any) {
    cache.value = emptyCache()
    ElMessage.error(e?.message || t('common.failed'))
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void loadCache()
})
</script>

<template>
  <div v-loading="loading" class="wb-page wb-monitor-cache">
    <div class="wb-card">
      <div class="wb-flex-between wb-monitor-cache__header">
        <span class="wb-monitor-cache__title">基本信息</span>
        <el-button v-hasPermi="['monitor:cache:list']" plain size="small" @click="loadCache">
          <el-icon><Refresh /></el-icon>{{ t('common.refresh') }}
        </el-button>
      </div>
      <el-descriptions :column="2" border>
        <el-descriptions-item v-for="item in baseItems" :key="item.label" :label="item.label">
          {{ item.value === undefined || item.value === null || item.value === '' ? '-' : item.value }}
        </el-descriptions-item>
      </el-descriptions>
    </div>

    <div class="wb-card wb-mt12">
      <div class="wb-monitor-cache__title">命令统计</div>
      <EChart :option="commandOption" height="300px" :loading="loading" />
    </div>

    <div class="wb-card wb-mt12">
      <div class="wb-monitor-cache__title">详细信息</div>
      <el-descriptions :column="2" border>
        <el-descriptions-item v-for="[key, value] in infoEntries" :key="key" :label="key">
          {{ value === undefined || value === null || value === '' ? '-' : String(value) }}
        </el-descriptions-item>
      </el-descriptions>
      <el-empty v-if="!infoEntries.length" :description="t('common.noData')" :image-size="80" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.wb-monitor-cache {
  &__header {
    align-items: center;
    margin-bottom: 10px;
  }

  &__title {
    font-size: 15px;
    font-weight: 600;
    margin-bottom: 10px;
  }
}
</style>
