<script setup lang="ts">
import { computed, onMounted } from 'vue'
import type { DictData } from '@/types'
import { useDictStore } from '@/stores/modules/dict'

defineOptions({ name: 'DictSelect' })

const props = withDefaults(
  defineProps<{
    modelValue?: string | number | string[] | number[]
    dictType: string
    placeholder?: string
    disabled?: boolean
    clearable?: boolean
    multiple?: boolean
    size?: 'large' | 'default' | 'small'
    valueType?: 'string' | 'number'
  }>(),
  { clearable: true }
)

const emit = defineEmits<{
  (e: 'update:modelValue', v: any): void
  (e: 'change', v: any, item?: DictData): void
}>()

const dictStore = useDictStore()

const value = computed({
  get: () => props.modelValue as any,
  set: (v) => {
    emit('update:modelValue', v)
    emit('change', v, dictStore.getDict(props.dictType).find((i) => String(i.dictValue) === String(v)))
  }
})

const options = computed(() => dictStore.getDict(props.dictType))

onMounted(() => {
  void dictStore.loadDict(props.dictType)
})
</script>

<template>
  <el-select
    v-model="value"
    :placeholder="placeholder"
    :disabled="disabled"
    :clearable="clearable"
    :multiple="multiple"
    :size="size"
    filterable
  >
    <el-option
      v-for="item in options"
      :key="item.dictCode"
      :label="item.dictLabel"
      :value="valueType === 'number' ? Number(item.dictValue) : item.dictValue"
    />
  </el-select>
</template>
