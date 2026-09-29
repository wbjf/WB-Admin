<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef } from 'vue'
import { Editor, Toolbar } from '@wangeditor/editor-for-vue'
import '@wangeditor/editor/dist/css/style.css'
import { ElMessage } from 'element-plus'
import { UPLOAD_IMAGE_URL } from '@/api/tool'
import { getToken } from '@/utils/auth'

defineOptions({ name: 'WangEditor' })

const props = withDefaults(
  defineProps<{
    modelValue?: string
    placeholder?: string
    height?: string
    disabled?: boolean
  }>(),
  { placeholder: '请输入内容…', height: '360px' }
)

const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>()

const editorRef = shallowRef()
const loading = ref(false)

const html = computed({
  get: () => props.modelValue ?? '',
  set: (v) => emit('update:modelValue', v)
})

const toolbarConfig = {
  excludeKeys: ['fullScreen', 'group-video']
}

const editorConfig = {
  placeholder: props.placeholder,
  readOnly: props.disabled,
  MENU_CONF: {
    uploadImage: {
      server: UPLOAD_IMAGE_URL,
      fieldName: 'file',
      maxFileSize: 10 * 1024 * 1024,
      headers: { Authorization: `Bearer ${getToken()}` },
      onFailed(file: File, res: any) {
        void file
        ElMessage.error(res?.message || '上传失败')
      }
    } as any
  }
}

function onCreated(editor: any) {
  editorRef.value = editor
}

onBeforeUnmount(() => {
  editorRef.value?.destroy?.()
})
</script>

<template>
  <div v-loading="loading" class="wb-editor" :style="{ '--wb-editor-height': height }">
    <Toolbar :editor="editorRef" :default-config="toolbarConfig" mode="default" class="wb-editor__toolbar" />
    <Editor
      v-model="html"
      :default-config="editorConfig"
      mode="default"
      class="wb-editor__body"
      @on-created="onCreated"
    />
  </div>
</template>

<style scoped lang="scss">
.wb-editor {
  border: 1px solid var(--wb-border);
  border-radius: 6px;
  overflow: hidden;

  &__toolbar {
    border-bottom: 1px solid var(--wb-border);
  }

  &__body {
    height: var(--wb-editor-height);
    overflow-y: hidden;
  }
}
</style>
