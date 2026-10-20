<script setup lang="ts">
defineOptions({ name: 'DemoDevice' })

import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import DeviceTree from '@/components/DeviceTree/index.vue'
import type { DeviceTreeNode } from '@/components/DeviceTree/useDeviceTree'
import { deviceApi } from '@/api/device'
import { useDevicePreference } from '@/composables/useDevicePreference'
import { useUserStore } from '@/stores/modules/user'
import { useI18n } from 'vue-i18n'
import type { DeviceArea } from '@/types'

const { t } = useI18n()
const userStore = useUserStore()
const preference = useDevicePreference()

const areas = ref<DeviceArea[]>([])
const loading = ref(false)
const lastClicked = ref('')

async function loadTree(): Promise<void> {
  loading.value = true
  try {
    // mock 接口返回的可能不是纯数组，api 层已经用泛型约定 + 兜底处理
    areas.value = await deviceApi.areaTreeSafe()
  } catch (e: any) {
    ElMessage.error(e?.message || t('common.failed'))
    areas.value = []
  } finally {
    loading.value = false
  }
}

onMounted(loadTree)

function onDeviceClick(node: DeviceTreeNode): void {
  lastClicked.value = `${node.name}（${node.status ? t(`device.status${capitalize(node.status)}`) : '-'}）`
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function onFavoriteChange(payload: { id: string; favorited: boolean }): void {
  ElMessage.success(payload.favorited ? t('device.favoriteAdded') : t('device.favoriteRemoved'))
}

/** 偏好是按登录人隔离的，页面上把「当前存在哪个桶」显式写出来，方便验证切换账号的效果 */
const ownerText = computed(() => `${userStore.displayName}（${preference.owner.value}）`)
</script>

<template>
  <div class="wb-page wb-demo-device">
    <el-alert type="info" show-icon :closable="false" class="wb-mb12">
      <div class="wb-demo-device__tip">
        <div>{{ t('device.designNote') }}</div>
        <div>
          偏好数据当前存在 localStorage，key 为
          <code>wb-admin:device-favorite:{{ '{userId}' }}</code>
          ，接后端时替换 adapter 即可。
        </div>
        <div>当前登录人：{{ ownerText }}；收藏 {{ preference.count.value }} 台。</div>
      </div>
    </el-alert>

    <div class="wb-demo-device__body">
      <div class="wb-card wb-demo-device__tree">
        <div class="wb-demo-device__title">{{ t('menu.deviceDemo') }}</div>
        <DeviceTree
          :areas="areas"
          :loading="loading"
          height="520px"
          :group-by-initial="false"
          @device-click="onDeviceClick"
          @favorite-change="onFavoriteChange"
        />
      </div>

      <div class="wb-card wb-demo-device__side">
        <div class="wb-demo-device__title">{{ t('device.lastDevice') }}</div>
        <div class="wb-demo-device__last">{{ lastClicked || '-' }}</div>
        <el-divider />
        <el-descriptions :column="1" size="small" border>
          <el-descriptions-item :label="t('device.statusAvailable')">
            <span class="wb-demo-device__dot" style="background: var(--el-color-success)" />
            绿点
          </el-descriptions-item>
          <el-descriptions-item :label="t('device.statusUnavailable')">
            <span class="wb-demo-device__dot" style="background: var(--el-color-warning)" />
            黄点
          </el-descriptions-item>
          <el-descriptions-item :label="t('device.statusOffline')">
            <span class="wb-demo-device__dot" style="background: var(--el-color-info)" />
            灰点
          </el-descriptions-item>
        </el-descriptions>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.wb-demo-device {
  &__tip {
    font-size: 13px;
    line-height: 1.8;
  }

  &__title {
    margin-bottom: 10px;
    font-size: 14px;
    font-weight: 600;
  }

  &__body {
    display: flex;
    gap: 12px;
    align-items: flex-start;

    @media (max-width: 992px) {
      flex-direction: column;
    }
  }

  &__tree {
    flex: 1 1 auto;
    min-width: 0;
  }

  &__side {
    flex: none;
    width: 320px;

    @media (max-width: 992px) {
      width: 100%;
    }
  }

  &__last {
    min-height: 22px;
    font-size: 13px;
  }

  &__dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    margin-right: 6px;
    border-radius: 50%;
    vertical-align: middle;
  }
}
</style>
