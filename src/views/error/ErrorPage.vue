<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

defineOptions({ name: 'ErrorPage' })

const props = defineProps<{ code: '403' | '404' | '500' }>()
const { t } = useI18n()
const router = useRouter()

const config = computed(() => {
  const map = {
    '403': { title: '403', desc: t('error.403') },
    '404': { title: '404', desc: t('error.404') },
    '500': { title: '500', desc: t('error.500') }
  }
  return map[props.code]
})
</script>

<template>
  <div class="wb-error">
    <div class="wb-error__code">{{ config.title }}</div>
    <p class="wb-error__desc">{{ config.desc }}</p>
    <div class="wb-error__actions">
      <el-button type="primary" @click="router.push('/index')">{{ t('error.backHome') }}</el-button>
      <el-button @click="router.back()">{{ t('error.back') }}</el-button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.wb-error {
  height: 100%;
  min-height: 60vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: var(--wb-bg-card);
  border-radius: 10px;

  &__code {
    font-size: 84px;
    font-weight: 600;
    color: var(--el-color-primary);
    line-height: 1;
  }

  &__desc {
    margin: 0;
    color: var(--el-text-color-secondary);
  }

  &__actions {
    margin-top: 12px;
    display: flex;
    gap: 10px;
  }
}
</style>
