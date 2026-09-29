<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowDown, ArrowUp, Refresh, Search } from '@element-plus/icons-vue'
import type { FormSchema } from '@/components/ProForm/types'
import DictSelect from '@/components/Dict/DictSelect.vue'
import { useDictStore } from '@/stores/modules/dict'
import { useI18n } from 'vue-i18n'

defineOptions({ name: 'SearchForm' })

const props = withDefaults(
  defineProps<{
    modelValue: Record<string, any>
    schemas: FormSchema[]
    /** 每行显示的字段数 */
    cols?: number
    /** 是否可折叠 */
    collapsible?: boolean
    loading?: boolean
    labelWidth?: string
  }>(),
  { cols: 4, collapsible: true, labelWidth: '80px' }
)

const emit = defineEmits<{
  (e: 'update:modelValue', v: Record<string, any>): void
  (e: 'search'): void
  (e: 'reset'): void
}>()

const { t } = useI18n()
const dictStore = useDictStore()
const expanded = ref(false)

const model = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})

const visibleCount = computed(() => {
  if (!props.collapsible || expanded.value) return props.schemas.length
  return props.schemas.length > props.cols ? props.cols - 1 : props.schemas.length
})

const visibleSchemas = computed(() => props.schemas.slice(0, visibleCount.value))

const canCollapse = computed(() => props.collapsible && props.schemas.length > props.cols - 1)

const span = computed(() => Math.floor(24 / props.cols))

function options(schema: FormSchema) {
  if (schema.options?.length) return schema.options
  if (schema.dictType) return dictStore.getOptions(schema.dictType)
  return []
}

props.schemas.forEach((s) => {
  if (s.dictType) void dictStore.loadDict(s.dictType)
})

function reset() {
  Object.keys(model.value).forEach((k) => {
    model.value[k] = undefined
  })
  emit('reset')
  emit('search')
}
</script>

<template>
  <el-form :model="model" :label-width="labelWidth" class="wb-search-form wb-card" @submit.prevent>
    <el-row :gutter="12">
      <el-col v-for="schema in visibleSchemas" :key="schema.prop" :span="span">
        <el-form-item :label="schema.label">
          <slot v-if="schema.type === 'slot'" :name="schema.slot || schema.prop" />

          <DictSelect
            v-else-if="schema.type === 'dict'"
            v-model="model[schema.prop]"
            :dict-type="schema.dictType!"
            size="default"
            style="width: 100%"
          />

          <el-select
            v-else-if="schema.type === 'select'"
            v-model="model[schema.prop]"
            :placeholder="`请选择${schema.label}`"
            clearable
            style="width: 100%"
          >
            <el-option v-for="opt in options(schema)" :key="String(opt.value)" :label="opt.label" :value="opt.value" />
          </el-select>

          <el-date-picker
            v-else-if="schema.type === 'daterange'"
            v-model="model[schema.prop]"
            type="daterange"
            value-format="YYYY-MM-DD HH:mm:ss"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            style="width: 100%"
          />

          <el-date-picker
            v-else-if="schema.type === 'date'"
            v-model="model[schema.prop]"
            type="date"
            value-format="YYYY-MM-DD HH:mm:ss"
            :placeholder="schema.placeholder || `请选择${schema.label}`"
            style="width: 100%"
          />

          <el-input
            v-else
            v-model="model[schema.prop]"
            :placeholder="schema.placeholder || `请输入${schema.label}`"
            clearable
            @keyup.enter="emit('search')"
          />
        </el-form-item>
      </el-col>

      <el-col :span="span" class="wb-search-form__actions">
        <!--
          按钮组必须包在 el-form-item 里，且不传 label：
          1) 没有 label 时 Element Plus 会给内容区加 margin-left = labelWidth，
             按钮于是与上方输入框左对齐，不再贴到卡片边缘；
          2) el-form-item__content 自带 display:flex + align-items:center，
             行内高度不一的按钮（link 按钮只有 20px）自动垂直居中。
        -->
        <el-form-item>
          <el-button type="primary" :icon="Search" :loading="loading" @click="emit('search')">
            {{ t('common.query') }}
          </el-button>
          <el-button :icon="Refresh" @click="reset">{{ t('common.reset') }}</el-button>
          <el-button v-if="canCollapse" link type="primary" @click="expanded = !expanded">
            {{ expanded ? t('common.collapse') : t('common.expand') }}
            <el-icon><component :is="expanded ? ArrowUp : ArrowDown" /></el-icon>
          </el-button>
        </el-form-item>
      </el-col>
    </el-row>
  </el-form>
</template>

<style scoped lang="scss">
.wb-search-form {
  flex: none;

  :deep(.el-form-item) {
    margin-bottom: var(--wb-gap, 12px);
  }

  /**
   * 按钮组列：按内容宽度取 flex-basis 并允许占满该行剩余空间。
   *
   * el-col 默认 `flex: 0 0 25%`（1440px 下约 225px），而按钮组要放进
   * 「80px 标签缩进 + 三个按钮」≈ 290px，固定 25% 会被 el-form-item__content
   * 的 flex-wrap 折成两行。改成按内容撑开（basis: auto）后：
   *  - 与字段同处一行时占满该行剩余宽度；
   *  - 剩余宽度不够时整列换到下一行并撑满整行。
   */
  &__actions {
    flex: 1 1 auto;
    max-width: 100%;
  }
}
</style>
