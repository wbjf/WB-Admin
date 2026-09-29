<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import type { EChartsOption } from 'echarts'
import EChart from '@/components/EChart/index.vue'
import { serverApi, type ServerInfo } from '@/api/monitor'
import { useI18n } from 'vue-i18n'

defineOptions({ name: 'MonitorServer' })

const { t } = useI18n()

/** ---------- 数据 ---------- */
const MAX_POINTS = 20
const loading = ref(false)

const emptyInfo = (): ServerInfo => ({
  cpu: { used: 0, sys: 0, user: 0, wait: 0, free: 0 },
  mem: { total: 0, used: 0, free: 0, usage: 0 },
  disks: [],
  jvm: { name: '', version: '', home: '', startTime: '', runTime: '', used: 0, usage: 0 },
  sys: { computerName: '', osName: '', computerIp: '', osArch: '', userDir: '' }
})

const info = ref<ServerInfo>(emptyInfo())
const cpuSeries = ref<number[]>([])
const memSeries = ref<number[]>([])
const timeSeries = ref<string[]>([])

function nowLabel(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function pushPoint(used: number, usage: number): void {
  cpuSeries.value.push(Number(used) || 0)
  memSeries.value.push(Number(usage) || 0)
  timeSeries.value.push(nowLabel())
  if (cpuSeries.value.length > MAX_POINTS) cpuSeries.value.shift()
  if (memSeries.value.length > MAX_POINTS) memSeries.value.shift()
  if (timeSeries.value.length > MAX_POINTS) timeSeries.value.shift()
}

/** ---------- 指标卡 ---------- */
function colorOf(v: number): string {
  if (v >= 85) return '#f56c6c'
  if (v >= 60) return '#e6a23c'
  return '#67c23a'
}

const diskUsage = computed(() => {
  const disks = info.value.disks ?? []
  if (!disks.length) return 0
  const sum = disks.reduce((acc, d) => acc + (Number(d.usage) || 0), 0)
  return Number((sum / disks.length).toFixed(1))
})

const metrics = computed(() => [
  { key: 'cpu', label: t('monitor.server.cpu'), value: Number(info.value.cpu?.used ?? 0) },
  { key: 'mem', label: t('monitor.server.memory'), value: Number(info.value.mem?.usage ?? 0) },
  { key: 'disk', label: t('monitor.server.disk'), value: diskUsage.value },
  { key: 'jvm', label: t('monitor.server.jvm'), value: Number(info.value.jvm?.usage ?? 0) }
])

/** ---------- 趋势图 ---------- */
const trendOption = computed<EChartsOption>(() => ({
  tooltip: { trigger: 'axis' },
  legend: { bottom: 0, data: [t('monitor.server.cpu'), t('monitor.server.memory')] },
  grid: { left: 45, right: 20, top: 24, bottom: 44 },
  xAxis: { type: 'category', boundaryGap: false, data: timeSeries.value },
  yAxis: { type: 'value', max: 100, axisLabel: { formatter: '{value}%' } },
  series: [
    {
      name: t('monitor.server.cpu'),
      type: 'line',
      smooth: true,
      symbolSize: 6,
      areaStyle: { opacity: 0.15 },
      itemStyle: { color: '#409eff' },
      data: cpuSeries.value
    },
    {
      name: t('monitor.server.memory'),
      type: 'line',
      smooth: true,
      symbolSize: 6,
      areaStyle: { opacity: 0.15 },
      itemStyle: { color: '#67c23a' },
      data: memSeries.value
    }
  ]
}))

/** ---------- 详情表格 / 描述 ---------- */
const sysItems = computed(() => [
  { label: '服务器名称', value: info.value.sys?.computerName },
  { label: '操作系统', value: info.value.sys?.osName },
  { label: '服务器 IP', value: info.value.sys?.computerIp },
  { label: '系统架构', value: info.value.sys?.osArch },
  { label: '安装路径', value: info.value.sys?.userDir }
])

const jvmItems = computed(() => [
  { label: 'JVM 名称', value: info.value.jvm?.name },
  { label: 'Java 版本', value: info.value.jvm?.version },
  { label: '安装路径', value: info.value.jvm?.home },
  { label: '启动时间', value: info.value.jvm?.startTime },
  { label: '运行时长', value: info.value.jvm?.runTime },
  { label: '已用内存', value: `${info.value.jvm?.used ?? 0} MB` },
  { label: '使用率', value: `${info.value.jvm?.usage ?? 0}%` }
])

const disks = computed(() => info.value.disks ?? [])

/** ---------- 请求 ---------- */
async function loadMonitor(): Promise<void> {
  loading.value = true
  try {
    const res = await serverApi.monitor()
    info.value = { ...emptyInfo(), ...(res ?? {}) }
    pushPoint(info.value.cpu?.used ?? 0, info.value.mem?.usage ?? 0)
  } catch (e: any) {
    ElMessage.error(e?.message || t('common.failed'))
  } finally {
    loading.value = false
  }
}

let timer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  void loadMonitor()
  timer = setInterval(() => {
    void loadMonitor()
  }, 1000)
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
  timer = null
})
</script>

<template>
  <div v-loading="loading" class="wb-page wb-monitor-server">
    <!-- 顶部指标卡 -->
    <el-row :gutter="12">
      <el-col v-for="item in metrics" :key="item.key" :xs="24" :sm="12" :lg="6">
        <div class="wb-card wb-monitor-server__metric">
          <div class="wb-flex-between">
            <span class="wb-text-muted">{{ item.label }}{{ t('monitor.server.usage') }}</span>
            <span class="wb-monitor-server__value">{{ item.value }}%</span>
          </div>
          <el-progress
            :percentage="item.value"
            :stroke-width="10"
            :color="colorOf(item.value)"
            striped
            striped-flow
          />
        </div>
      </el-col>
    </el-row>

    <!-- 中部趋势图 -->
    <div class="wb-card wb-mt12">
      <div class="wb-flex-between wb-monitor-server__header">
        <span class="wb-monitor-server__title">资源监控趋势</span>
        <el-button v-hasPermi="['monitor:server:list']" plain size="small" @click="loadMonitor">
          <el-icon><Refresh /></el-icon>{{ t('monitor.server.refresh') }}
        </el-button>
      </div>
      <EChart :option="trendOption" height="300px" :loading="loading" />
    </div>

    <!-- 下部描述信息 -->
    <el-row :gutter="12" class="wb-mt12">
      <el-col :xs="24" :lg="12">
        <div class="wb-card">
          <div class="wb-monitor-server__title">{{ t('monitor.server.systemInfo') }}</div>
          <el-descriptions :column="1" border>
            <el-descriptions-item v-for="it in sysItems" :key="it.label" :label="it.label">
              {{ it.value || '-' }}
            </el-descriptions-item>
          </el-descriptions>
        </div>
      </el-col>
      <el-col :xs="24" :lg="12">
        <div class="wb-card">
          <div class="wb-monitor-server__title">{{ t('monitor.server.jvm') }}</div>
          <el-descriptions :column="1" border>
            <el-descriptions-item v-for="it in jvmItems" :key="it.label" :label="it.label">
              {{ it.value || '-' }}
            </el-descriptions-item>
          </el-descriptions>
        </div>
      </el-col>
    </el-row>

    <!-- 磁盘状态 -->
    <div class="wb-card wb-mt12">
      <div class="wb-monitor-server__title">{{ t('monitor.server.disk') }}</div>
      <el-table :data="disks" border stripe size="small">
        <el-table-column prop="path" label="盘符路径" min-width="120" />
        <el-table-column prop="total" :label="t('monitor.server.diskTotal')" min-width="110" />
        <el-table-column prop="used" label="已用空间" min-width="110" />
        <el-table-column prop="free" :label="t('monitor.server.diskFree')" min-width="110" />
        <el-table-column :label="t('monitor.server.diskUsage')" min-width="180">
          <template #default="{ row }">
            <el-progress
              :percentage="Number(row.usage) || 0"
              :stroke-width="12"
              :color="colorOf(Number(row.usage) || 0)"
              striped
            />
          </template>
        </el-table-column>
        <template #empty>
          <el-empty :description="t('common.noData')" :image-size="80" />
        </template>
      </el-table>
    </div>
  </div>
</template>

<style scoped lang="scss">
.wb-monitor-server {
  &__metric {
    .wb-text-muted {
      font-size: 13px;
    }
  }

  &__value {
    font-size: 20px;
    font-weight: 600;
  }

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
