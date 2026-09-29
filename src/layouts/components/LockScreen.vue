<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import dayjs from 'dayjs'
import { Lock } from '@element-plus/icons-vue'
import { useAppStore } from '@/stores/modules/app'
import { useUserStore } from '@/stores/modules/user'
import { getRemember } from '@/utils/auth'
import { useI18n } from 'vue-i18n'

defineOptions({ name: 'LockScreen' })

const { t } = useI18n()
const appStore = useAppStore()
const userStore = useUserStore()

const password = ref('')
const now = ref(dayjs())

let timer: ReturnType<typeof setInterval> | null = null

const visible = computed(() => appStore.screenLocked)

watch(visible, (v) => {
  if (v) {
    password.value = ''
    now.value = dayjs()
    timer = setInterval(() => (now.value = dayjs()), 1000)
  } else if (timer) {
    clearInterval(timer)
    timer = null
  }
})

function unlock() {
  const remembered = getRemember()
  const validTarget = remembered?.password || '123456'
  if (!password.value) {
    ElMessage.warning(t('lock.placeholder'))
    return
  }
  if (password.value !== validTarget) {
    ElMessage.error(t('lock.wrongPassword'))
    return
  }
  appStore.unlockScreen()
  ElMessage.success(t('common.success'))
}
</script>

<template>
  <transition name="fade">
    <div v-if="visible" class="wb-lock">
      <div class="wb-lock__time">{{ now.format('HH:mm:ss') }}</div>
      <div class="wb-lock__date">{{ now.format('YYYY 年 MM 月 DD 日 dddd') }}</div>

      <el-avatar :size="72" class="wb-lock__avatar">
        {{ userStore.displayName.slice(0, 1) }}
      </el-avatar>
      <div class="wb-lock__name">{{ userStore.displayName }}</div>

      <div class="wb-lock__box">
        <el-input
          v-model="password"
          type="password"
          show-password
          :prefix-icon="Lock"
          :placeholder="t('lock.placeholder')"
          @keyup.enter="unlock"
        />
        <el-button type="primary" style="margin-top: 12px; width: 100%" @click="unlock">
          {{ t('lock.unlock') }}
        </el-button>
      </div>
    </div>
  </transition>
</template>

<style scoped lang="scss">
.wb-lock {
  position: fixed;
  inset: 0;
  z-index: 4000;
  background: rgba(0, 0, 0, 0.78);
  backdrop-filter: blur(4px);
  color: #fff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;

  &__time {
    font-size: 46px;
    font-weight: 300;
    letter-spacing: 2px;
  }

  &__date {
    font-size: 14px;
    opacity: 0.75;
    margin-bottom: 12px;
  }

  &__avatar {
    margin-bottom: 6px;
    background: var(--el-color-primary);
  }

  &__name {
    font-size: 15px;
    margin-bottom: 16px;
  }

  &__box {
    width: 260px;
  }
}
</style>
