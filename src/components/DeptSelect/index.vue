<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { deptApi } from '@/api/dept'
import { buildTree, toArray } from '@/utils'
import type { DeptInfo } from '@/types'

defineOptions({ name: 'DeptSelect' })

const props = defineProps<{
  modelValue?: string
  placeholder?: string
  disabled?: boolean
  clearable?: boolean
  /** 是否返回父节点 key 也可以被选择 */
  checkStrictly?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: string): void
  (e: 'change', v: string, node?: DeptInfo): void
}>()

const depts = ref<DeptInfo[]>([])
const loading = ref(false)

const tree = computed(() => buildTree(depts.value, { id: 'deptId', parentId: 'parentId', rootValue: '0' }))

const value = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v as string)
})

async function load() {
  loading.value = true
  try {
    depts.value = toArray<DeptInfo>(await deptApi.list({}))
  } finally {
    loading.value = false
  }
}

onMounted(load)

defineExpose({ load })
</script>

<template>
  <el-tree-select
    v-model="value"
    :data="tree as any"
    :props="{ label: 'deptName', children: 'children' }"
    node-key="deptId"
    check-strictly
    :placeholder="placeholder || '请选择部门'"
    :disabled="disabled"
    :clearable="clearable !== false"
    :loading="loading"
    filterable
    @change="(v: any) => emit('change', v)"
  />
</template>
