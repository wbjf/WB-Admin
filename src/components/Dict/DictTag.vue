<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useDictStore } from '@/stores/modules/dict'

defineOptions({ name: 'DictTag' })

const props = withDefaults(
  defineProps<{
    /** 字典值，多个以逗号分隔 */
    value?: string | number | (string | number)[]
    dictType: string
    size?: 'large' | 'default' | 'small'
    showValue?: boolean
  }>(),
  { showValue: false }
)

const dictStore = useDictStore()

const items = computed(() => {
  const raw = Array.isArray(props.value) ? props.value : String(props.value ?? '').split(',')
  return raw
    .filter((v) => v !== '' && v !== null && v !== undefined)
    .map((v) => {
      const hit = dictStore.getDict(props.dictType).find((d) => String(d.dictValue) === String(v))
      return {
        label: hit?.dictLabel ?? String(v),
        value: v,
        type: (hit?.listClass as any) ?? 'primary'
      }
    })
})

onMounted(() => {
  void dictStore.loadDict(props.dictType)
})
</script>

<template>
  <template v-for="item in items" :key="String(item.value)">
    <el-tag :type="item.type" :size="size" disable-transitions style="margin-right: 4px">
      {{ item.label }}<span v-if="showValue" class="wb-dict-tag__value">{{ item.value }}</span>
    </el-tag>
    <span v-if="!items.length">-</span>
  </template>
</template>

<style scoped lang="scss">
.wb-dict-tag__value {
  margin-left: 4px;
  opacity: 0.6;
  font-size: 11px;
}
</style>
