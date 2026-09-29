<script setup lang="ts">
import { computed } from 'vue'
import { MdEditor, MdPreview } from 'md-editor-v3'
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

MdEditor.config({
  editorExtensions: { highlight: { instance: hljs } }
} as any)
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
