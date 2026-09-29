<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

defineOptions({ name: 'ProDialog' })

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    title?: string
    width?: string | number
    fullscreen?: boolean
    confirmText?: string
    cancelText?: string
    loading?: boolean
    showFooter?: boolean
    closeOnClickModal?: boolean
    appendToBody?: boolean
  }>(),
  {
    width: '640px',
    showFooter: true,
    closeOnClickModal: false,
    appendToBody: true
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'confirm'): void
  (e: 'opened'): void
  (e: 'closed'): void
}>()

const { t } = useI18n()

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="title"
    :width="width"
    :fullscreen="fullscreen"
    :close-on-click-modal="closeOnClickModal"
    :append-to-body="appendToBody"
    destroy-on-close
    @opened="emit('opened')"
    @closed="emit('closed')"
  >
    <el-scrollbar max-height="calc(85vh - 140px)">
      <slot />
    </el-scrollbar>

    <template v-if="showFooter" #footer>
      <slot name="footer">
        <el-button @click="visible = false">{{ cancelText || t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="loading" @click="emit('confirm')">
          {{ confirmText || t('common.confirm') }}
        </el-button>
      </slot>
    </template>
  </el-dialog>
</template>
