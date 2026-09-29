<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Bell,
  DataLine,
  Money,
  Notification,
  ShoppingCart,
  User,
  View
} from '@element-plus/icons-vue'
import type { EChartsOption } from 'echarts'
import * as Icons from '@element-plus/icons-vue'
import EChart from '@/components/EChart/index.vue'
import { dashboardApi, type DashboardOverview } from '@/api/dashboard'
import { formatTime, toThousands } from '@/utils'
import { useUserStore } from '@/stores/modules/user'
import { useI18n } from 'vue-i18n'

defineOptions({ name: 'Dashboard' })

const { t } = useI18n()
const userStore = useUserStore()

const loading = ref(true)

const emptyOverview = (): DashboardOverview => ({
  visit: 0,
  order: 0,
  amount: 0,
  userCount: 0,
  weekTrend: [],
  category: [],
  funnel: [],
  todos: [],
  notices: []
})

const overview = ref<DashboardOverview>(emptyOverview())

/** ---------- 指标卡片 ---------- */
const metrics = computed(() => [
  {
    key: 'visit',
    label: t('dashboard.visit'),
    value: toThousands(overview.value.visit, 0),
    icon: View,
    color: '#409eff'
  },
  {
    key: 'order',
    label: t('dashboard.order'),
    value: toThousands(overview.value.order, 0),
    icon: ShoppingCart,
    color: '#67c23a'
  },
  {
    key: 'amount',
    label: t('dashboard.amount'),
    value: toThousands(overview.value.amount),
    icon: Money,
    color: '#e6a23c'
  },
  {
    key: 'userCount',
    label: t('dashboard.user'),
    value: toThousands(overview.value.userCount, 0),
    icon: User,
    color: '#f56c6c'
  }
])

/** ---------- 近七日趋势 ---------- */
const trendOption = computed<EChartsOption>(() => {
  const trend = overview.value.weekTrend ?? []
  return {
    tooltip: { trigger: 'axis' },
    grid: { left: 40, right: 20, top: 30, bottom: 40 },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: trend.map((i) => i.date)
    },
    yAxis: { type: 'value' },
    series: [
      {
        name: t('dashboard.visit'),
        type: 'line',
        smooth: true,
        symbolSize: 6,
        areaStyle: { opacity: 0.2 },
        itemStyle: { color: '#409eff' },
        data: trend.map((i) => i.value)
      }
    ]
  }
})

/** ---------- 分类占比 ---------- */
const categoryOption = computed<EChartsOption>(() => {
  const category = overview.value.category ?? []
  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: 0 },
    series: [
      {
        name: t('dashboard.category'),
        type: 'pie',
        radius: ['42%', '68%'],
        center: ['50%', '44%'],
        avoidLabelOverlap: true,
        label: { formatter: '{b} {d}%' },
        data: category.map((i) => ({ name: i.name, value: i.value }))
      }
    ]
  }
})

const todos = computed(() => overview.value.todos ?? [])
const notices = computed(() => overview.value.notices ?? [])
const today = formatTime(new Date(), 'YYYY-MM-DD')

/** 待办 icon：兜底为 Bell，避免后端返回未知图标名导致渲染失败 */
function todoIcon(name?: string) {
  return (Icons as Record<string, any>)[name ?? ''] ?? Bell
}

async function loadOverview(): Promise<void> {
  loading.value = true
  try {
    const res = await dashboardApi.overview()
    overview.value = { ...emptyOverview(), ...(res ?? {}) }
  } catch (e: any) {
    overview.value = emptyOverview()
    ElMessage.error(e?.message || t('common.failed'))
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void loadOverview()
})
</script>

<template>
  <div v-loading="loading" class="wb-page wb-dashboard">
    <!-- 欢迎卡片 -->
    <div class="wb-card wb-dashboard__welcome wb-flex-between">
      <div>
        <div class="wb-dashboard__hello">
          {{ t('dashboard.welcome', { name: userStore.displayName }) }}
        </div>
        <div class="wb-text-muted wb-mt12">{{ t('dashboard.todayTip', { date: today }) }}</div>
      </div>
      <el-button plain @click="loadOverview">
        <el-icon><DataLine /></el-icon>{{ t('common.refresh') }}
      </el-button>
    </div>

    <!-- 指标卡片 -->
    <el-row :gutter="12" class="wb-mt12">
      <el-col v-for="item in metrics" :key="item.key" :xs="24" :sm="12" :lg="6">
        <div class="wb-card wb-dashboard__metric">
          <div class="wb-dashboard__metric-icon" :style="{ background: item.color }">
            <el-icon :size="22"><component :is="item.icon" /></el-icon>
          </div>
          <div>
            <div class="wb-text-muted">{{ item.label }}</div>
            <div class="wb-dashboard__metric-value">{{ item.value }}</div>
          </div>
        </div>
      </el-col>
    </el-row>

    <!-- 图表：这一行吃掉剩余高度，图表跟随卡片尺寸自动缩放 -->
    <el-row :gutter="12" class="wb-mt12 wb-dashboard__charts">
      <el-col :xs="24" :lg="14">
        <div class="wb-card wb-card--fill">
          <div class="wb-dashboard__title">{{ t('dashboard.weekTrend') }}</div>
          <div class="wb-dashboard__chart">
            <EChart :option="trendOption" height="100%" :loading="loading" />
          </div>
        </div>
      </el-col>
      <el-col :xs="24" :lg="10">
        <div class="wb-card wb-card--fill">
          <div class="wb-dashboard__title">{{ t('dashboard.category') }}</div>
          <div class="wb-dashboard__chart">
            <EChart :option="categoryOption" height="100%" :loading="loading" />
          </div>
        </div>
      </el-col>
    </el-row>

    <!-- 待办 / 公告 -->
    <el-row :gutter="12" class="wb-mt12">
      <el-col :xs="24" :lg="12">
        <div class="wb-card">
          <div class="wb-dashboard__title wb-flex-between">
            <span>{{ t('dashboard.todo') }}</span>
            <span class="wb-text-muted">{{ t('common.total', { total: todos.length }) }}</span>
          </div>
          <el-skeleton v-if="loading" :rows="4" animated />
          <template v-else>
            <div v-for="item in todos" :key="item.title" class="wb-dashboard__todo">
              <div class="wb-dashboard__todo-icon" :style="{ color: item.color }">
                <el-icon :size="18"><component :is="todoIcon(item.icon)" /></el-icon>
              </div>
              <span class="wb-dashboard__todo-title">{{ item.title }}</span>
              <el-tag type="info" size="small" disable-transitions>{{ item.count }}</el-tag>
            </div>
            <el-empty v-if="!todos.length" :description="t('common.noData')" :image-size="60" />
          </template>
        </div>
      </el-col>

      <el-col :xs="24" :lg="12">
        <div class="wb-card">
          <div class="wb-dashboard__title">{{ t('dashboard.notice') }}</div>
          <el-skeleton v-if="loading" :rows="4" animated />
          <template v-else>
            <div v-for="item in notices" :key="item.title" class="wb-dashboard__notice">
              <el-icon :size="16" class="wb-dashboard__notice-icon"><Notification /></el-icon>
              <span class="wb-dashboard__notice-title wb-ellipsis">{{ item.title }}</span>
              <span class="wb-text-muted">{{ item.date }}</span>
            </div>
            <el-empty v-if="!notices.length" :description="t('common.noData')" :image-size="60" />
          </template>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<style scoped lang="scss">
.wb-dashboard {
  &__welcome {
    background: linear-gradient(90deg, rgba(64, 158, 255, 0.12), var(--wb-bg-card));
  }

  &__hello {
    font-size: 20px;
    font-weight: 600;
  }

  &__metric {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  &__metric-icon {
    width: 48px;
    height: 48px;
    border-radius: 10px;
    color: #fff;
    @include flex-center;
    flex-shrink: 0;
  }

  &__metric-value {
    font-size: 22px;
    font-weight: 600;
    margin-top: 4px;
  }

  /**
   * 图表行吃掉剩余高度（其余行高由内容决定），图表随之缩放 ——
   * 这样整页刚好铺满内容区，不产生滚动条；窗口变矮时图表先变小，
   * 到 min-height 后才由页面容器接管滚动。
   */
  &__charts {
    flex: 1 1 0;
    min-height: 0;
  }

  &__chart {
    flex: 1 1 0;
    /* 图表容器要能收缩，否则内容会把卡片顶高；下限兜住极小窗口 */
    min-height: 140px;
  }

  &__title {
    font-size: 15px;
    font-weight: 600;
    margin-bottom: 10px;
    flex: none;
  }

  &__todo,
  &__notice {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 0;
    border-bottom: 1px dashed var(--wb-border);

    &:last-of-type {
      border-bottom: none;
    }
  }

  &__todo-title,
  &__notice-title {
    flex: 1;
    min-width: 0;
  }

  &__todo-icon,
  &__notice-icon {
    flex-shrink: 0;
  }

  &__notice-title {
    font-size: 13px;
  }
}
</style>
