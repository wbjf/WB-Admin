<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage, type FormInstance } from 'element-plus'
import type { FormItemRule } from 'element-plus'
import type { FormSchema } from './types'
import DictSelect from '@/components/Dict/DictSelect.vue'
import IconSelect from '@/components/IconSelect/index.vue'
import ProUpload from '@/components/ProUpload/index.vue'
import { useDictStore } from '@/stores/modules/dict'
import { useI18n } from 'vue-i18n'

defineOptions({ name: 'ProForm' })

const props = withDefaults(
  defineProps<{
    /** 表单数据（v-model） */
    modelValue: Record<string, any>
    schemas: FormSchema[]
    labelWidth?: string
    /** 每行栅格数（ summed 24 ） */
    gutter?: number
    disabled?: boolean
    /** 自定义整体 rules */
    rules?: Record<string, FormItemRule[]>
    size?: 'large' | 'default' | 'small'
    inline?: boolean
    /** 是否显示底部操作按钮 */
    footer?: boolean
    submitText?: string
    resetText?: string
  }>(),
  {
    labelWidth: '100px',
    gutter: 16,
    footer: false
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', v: Record<string, any>): void
  (e: 'submit', v: Record<string, any>): void
  (e: 'reset'): void
}>()

const { t } = useI18n()
const dictStore = useDictStore()
const formRef = ref<FormInstance>()

const model = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})

function callIf<T>(v: T | ((m: any) => T), fallback: T): T {
  return typeof v === 'function' ? (v as (m: any) => T)(model.value) : (v ?? fallback)
}

const visibleSchemas = computed(() =>
  props.schemas.filter((s) => !callIf(s.hidden as any, false))
)

const formRules = computed<Record<string, FormItemRule[]>>(() => {
  const map: Record<string, FormItemRule[]> = { ...(props.rules ?? {}) }
  visibleSchemas.value.forEach((s) => {
    const list: FormItemRule[] = []
    if (s.required) {
      list.push({
        required: true,
        message: `${s.type === 'select' || s.type === 'dict' ? '请选择' : '请输入'}${s.label}`,
        trigger: ['blur', 'change']
      })
    }
    if (s.rules?.length) list.push(...s.rules)
    if (list.length) map[s.prop] = list
  })
  return map
})

function resolveDisabled(schema: FormSchema): boolean {
  return props.disabled || callIf(schema.disabled as any, false)
}

function options(schema: FormSchema) {
  if (schema.options?.length) return schema.options
  if (schema.dictType) return dictStore.getOptions(schema.dictType)
  return []
}

async function validate(): Promise<boolean> {
  try {
    await formRef.value?.validate()
    return true
  } catch {
    ElMessage.warning('请检查表单填写是否完整')
    return false
  }
}

function resetFields(): void {
  formRef.value?.resetFields()
  emit('reset')
}

async function submit(): Promise<void> {
  if (!(await validate())) return
  emit('submit', model.value)
}

/** 初始化默认值 + 预加载字典 */
function initDefaults(): void {
  props.schemas.forEach((s) => {
    if (s.defaultValue !== undefined && model.value[s.prop] === undefined) {
      model.value[s.prop] = s.defaultValue
    }
    if (s.dictType) void dictStore.loadDict(s.dictType)
  })
}

watch(() => props.schemas, initDefaults, { immediate: true, deep: false })

defineExpose({ validate, resetFields, submit, formRef })
</script>

<template>
  <el-form
    ref="formRef"
    :model="model"
    :rules="formRules"
    :label-width="labelWidth"
    :disabled="disabled"
    :inline="inline"
    :size="size"
    v-bind="$attrs"
  >
    <el-row :gutter="gutter">
      <el-col v-for="schema in visibleSchemas" :key="schema.prop" :span="schema.span ?? 24">
        <el-form-item :label="schema.label" :prop="schema.prop" :rules="schema.rules">
          <slot v-if="schema.type === 'slot'" :name="schema.slot || schema.prop" :model="model" />

          <DictSelect
            v-else-if="schema.type === 'dict'"
            v-model="model[schema.prop]"
            :dict-type="schema.dictType!"
            :placeholder="schema.placeholder ?? `请选择${schema.label}`"
            :disabled="resolveDisabled(schema)"
            v-bind="schema.props"
          />

          <IconSelect
            v-else-if="schema.type === 'icon'"
            v-model="model[schema.prop]"
            :disabled="resolveDisabled(schema)"
          />

          <ProUpload
            v-else-if="schema.type === 'upload'"
            v-model="model[schema.prop]"
            :disabled="resolveDisabled(schema)"
            v-bind="schema.props"
          />

          <el-select
            v-else-if="schema.type === 'select'"
            v-model="model[schema.prop]"
            :placeholder="schema.placeholder ?? `请选择${schema.label}`"
            :disabled="resolveDisabled(schema)"
            clearable
            v-bind="schema.props"
          >
            <el-option
              v-for="opt in options(schema)"
              :key="String(opt.value)"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>

          <el-radio-group
            v-else-if="schema.type === 'radio'"
            v-model="model[schema.prop]"
            :disabled="resolveDisabled(schema)"
          >
            <el-radio v-for="opt in options(schema)" :key="String(opt.value)" :value="opt.value">
              {{ opt.label }}
            </el-radio>
          </el-radio-group>

          <el-checkbox-group
            v-else-if="schema.type === 'checkbox'"
            v-model="model[schema.prop]"
            :disabled="resolveDisabled(schema)"
          >
            <el-checkbox v-for="opt in options(schema)" :key="String(opt.value)" :value="opt.value">
              {{ opt.label }}
            </el-checkbox>
          </el-checkbox-group>

          <el-switch
            v-else-if="schema.type === 'switch'"
            v-model="model[schema.prop]"
            :disabled="resolveDisabled(schema)"
            v-bind="schema.props"
          />

          <el-date-picker
            v-else-if="schema.type === 'date' || schema.type === 'datetime' || schema.type === 'daterange'"
            v-model="model[schema.prop]"
            :type="schema.type === 'daterange' ? 'daterange' : schema.type"
            :placeholder="schema.placeholder ?? `请选择${schema.label}`"
            :disabled="resolveDisabled(schema)"
            value-format="YYYY-MM-DD HH:mm:ss"
            v-bind="schema.props"
          />

          <el-time-picker
            v-else-if="schema.type === 'time'"
            v-model="model[schema.prop]"
            :disabled="resolveDisabled(schema)"
            v-bind="schema.props"
          />

          <el-slider
            v-else-if="schema.type === 'slider'"
            v-model="model[schema.prop]"
            :disabled="resolveDisabled(schema)"
            v-bind="schema.props"
          />

          <el-rate
            v-else-if="schema.type === 'rate'"
            v-model="model[schema.prop]"
            :disabled="resolveDisabled(schema)"
            v-bind="schema.props"
          />

          <el-color-picker
            v-else-if="schema.type === 'color'"
            v-model="model[schema.prop]"
            :disabled="resolveDisabled(schema)"
          />

          <el-input-number
            v-else-if="schema.type === 'number'"
            v-model="model[schema.prop]"
            :disabled="resolveDisabled(schema)"
            v-bind="schema.props"
          />

          <el-input
            v-else-if="schema.type === 'textarea'"
            v-model="model[schema.prop]"
            type="textarea"
            :rows="3"
            :placeholder="schema.placeholder ?? `请输入${schema.label}`"
            :disabled="resolveDisabled(schema)"
            v-bind="schema.props"
          />

          <el-input
            v-else
            v-model="model[schema.prop]"
            :type="schema.type === 'password' ? 'password' : 'text'"
            :placeholder="schema.placeholder ?? `请输入${schema.label}`"
            :disabled="resolveDisabled(schema)"
            clearable
            v-bind="schema.props"
          />

          <div v-if="schema.tip" class="wb-pro-form__tip">{{ schema.tip }}</div>
        </el-form-item>
      </el-col>

      <el-col :span="24">
        <slot name="default" :model="model" />
      </el-col>
    </el-row>

    <div v-if="footer" class="wb-pro-form__footer">
      <el-button @click="resetFields">{{ resetText || t('common.reset') }}</el-button>
      <el-button type="primary" @click="submit">{{ submitText || t('common.save') }}</el-button>
    </div>
  </el-form>
</template>

<style scoped lang="scss">
.wb-pro-form {
  &__tip {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    line-height: 1.4;
    margin-top: 4px;
  }

  &__footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 8px;
  }
}
</style>
