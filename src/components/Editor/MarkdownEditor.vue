<script setup lang="ts">
import { computed } from 'vue'
import { MdEditor, MdPreview, config } from 'md-editor-v3'
import 'md-editor-v3/lib/style.css'
import hljs from 'highlight.js'

defineOptions({ name: 'MarkdownEditor' })

const props = withDefaults(
  defineProps<{
    modelValue?: string
    height?: string
    previewOnly?: boolean
    theme?: 'light' | 'dark'
  }>(),
  { height: '420px', previewOnly: false, theme: 'light' }
)

const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>()

const value = computed({
  get: () => props.modelValue ?? '',
  set: (v) => emit('update:modelValue', v)
})

/**
 * 4.x 的全局配置是**独立的 `config()` 函数**，不是 `MdEditor.config`。
 * 写成 `MdEditor.config(...)` 会在 setup 里抛 TypeError，整个组件渲染成
 * `Invalid vnode type: undefined` —— 页面上只剩一个空的表单项，控制台之外毫无提示。
 */
config({ editorExtensions: { highlight: { instance: hljs } } })
</script>

<template>
  <MdPreview v-if="previewOnly" :model-value="value" :theme="theme" class="wb-md" />
  <MdEditor v-else v-model="value" :theme="theme" :style="{ height }" class="wb-md" />
</template>

<style scoped>
.wb-md {
  border-radius: 6px;
}
</style>
