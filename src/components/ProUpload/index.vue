<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage, type UploadFile, type UploadRawFile, type UploadRequestOptions } from 'element-plus'
import { Delete, Document, Plus, UploadFilled } from '@element-plus/icons-vue'
import { getToken } from '@/utils/auth'
import { UPLOAD_URL } from '@/api/tool'
import { useI18n } from 'vue-i18n'
import type { UploadResult } from '@/types'

defineOptions({ name: 'ProUpload' })

const props = withDefaults(
  defineProps<{
    modelValue?: string | string[]
    /** 文件列表类型 */
    listType?: 'picture-card' | 'picture' | 'text'
    /** 是否多选（modelValue 为数组） */
    multiple?: boolean
    limit?: number
    /** 后缀白名单 */
    accept?: string
    /** 单文件体积上限 MB */
    maxSize?: number
    disabled?: boolean
    action?: string
    tip?: string
  }>(),
  {
    listType: 'picture-card',
    maxSize: 10,
    accept: 'image/*,.pdf,.xlsx,.xls,.docx,.doc,.zip'
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', v: any): void
  (e: 'success', res: UploadResult, file: UploadFile): void
}>()

const { t } = useI18n()
const uploading = ref(false)

const urls = computed<string[]>(() => {
  const v = props.modelValue
  if (!v) return []
  if (Array.isArray(v)) return v.filter(Boolean)
  return v.split(',').filter(Boolean)
})

const isImage = (url: string): boolean => /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(url)

const hiddenInput = ref(false)

function emitValue(next: string[]) {
  emit('update:modelValue', props.multiple ? next : next[0] ?? '')
}

function beforeUpload(raw: UploadRawFile): boolean {
  if (props.maxSize && raw.size / 1024 / 1024 > props.maxSize) {
    ElMessage.error(t('component.sizeLimit', { n: props.maxSize }))
    return false
  }
  if (props.accept && props.accept !== '*') {
    const ext = raw.name.slice(raw.name.lastIndexOf('.')).toLowerCase()
    const whitelist = props.accept.split(',').map((s) => s.trim().toLowerCase())
    const okFile =
      whitelist.includes(ext) || whitelist.some((w) => w.startsWith('.') === false && raw.type.includes(w.replace('/*', '')))
    if (!okFile) {
      ElMessage.error(t('component.typeLimit', { n: props.accept }))
      return false
    }
  }
  return true
}

async function customRequest(options: UploadRequestOptions): Promise<void> {
  const form = new FormData()
  form.append('file', options.file)
  uploading.value = true
  try {
    const xhr = new XMLHttpRequest()
    const res = await new Promise<UploadResult>((resolve, reject) => {
      xhr.open('POST', String(props.action || UPLOAD_URL))
      const token = getToken()
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) options.onProgress({ percent: (e.loaded / e.total) * 100 } as any)
      }
      xhr.onload = () => {
        try {
          const json = JSON.parse(xhr.responseText)
          if (json.code === 200 || json.code === 0) resolve(json.data)
          else reject(new Error(json.msg || 'upload failed'))
        } catch {
          reject(new Error('invalid response'))
        }
      }
      xhr.onerror = () => reject(new Error('network error'))
      xhr.send(form)
    })
    const next = props.multiple ? [...urls.value, res.url] : [res.url]
    emitValue(next)
    emit('success', res, options.file as unknown as UploadFile)
    ElMessage.success(t('common.success'))
  } catch (e: any) {
    ElMessage.error(e?.message || t('common.failed'))
  } finally {
    uploading.value = false
  }
}

function remove(index: number) {
  const next = [...urls.value]
  next.splice(index, 1)
  emitValue(next)
}

function onExceed() {
  ElMessage.warning(t('component.maxLimit', { n: props.limit ?? 1 }))
}

defineExpose({ hiddenInput })
</script>

<template>
  <div class="wb-upload">
    <el-upload
      :file-list="urls.map((u) => ({ name: u.split('/').pop() || u, url: u }))"
      :list-type="listType"
      :limit="limit"
      :accept="accept"
      :disabled="disabled"
      :http-request="customRequest"
      :before-upload="beforeUpload"
      :on-exceed="onExceed"
      :multiple="multiple"
      v-loading="uploading"
    >
      <el-icon v-if="listType === 'picture-card'"><Plus /></el-icon>
      <el-button v-else type="primary" :icon="UploadFilled" :disabled="disabled">
        {{ listType === 'picture' ? t('component.uploadImage') : t('component.uploadFile') }}
      </el-button>
      <template #tip>
        <div v-if="tip" class="el-upload__tip">{{ tip }}</div>
      </template>
    </el-upload>

    <!-- 已上传列表封面 -->
    <div v-if="listType === 'picture-card'" class="wb-upload__preview">
      <div v-for="(url, index) in urls" :key="url + index" class="wb-upload__item">
        <el-image
          v-if="isImage(url)"
          :src="url"
          :preview-src-list="urls.filter(isImage)"
          fit="cover"
          class="wb-upload__img"
        />
        <div v-else class="wb-upload__file">
          <el-icon :size="22"><Document /></el-icon>
          <span>{{ url.split('/').pop() }}</span>
        </div>
        <div class="wb-upload__mask">
          <el-icon :size="16" @click="remove(index)"><Delete /></el-icon>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.wb-upload {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;

  /**
   * 消掉空文件列表占的位。
   *
   * EP 在 dist 里给 .el-upload-list 写死了 margin: 10px 0 0（不是主题变量，
   * 见 node_modules/element-plus/dist/index.css）。list-type 为 text 且还没有已上传
   * 文件时，这个空的 <ul> 照样渲染，于是 .wb-upload 的高度变成「按钮 32 + 空列表 10 = 42px」。
   *
   * 放进 align-items: center 的一行（如 views/tool/file 的工具条）时：
   * 外层那 42px 的盒子被居中了，可里面的按钮贴在盒子顶部，
   * 结果按钮比同排的其它按钮高出 (42 - 32) / 2 = 5px —— 实测 top 189 vs 194。
   *
   * 空列表本来就没有内容，不需要这段间距；有文件时保留 EP 原本的 10px。
   */
  :deep(.el-upload-list:not(:has(li))) {
    margin-top: 0;
  }

  &__preview {
    display: contents;
  }

  &__item {
    position: relative;
    width: 78px;
    height: 78px;
    border-radius: 6px;
    overflow: hidden;
    border: 1px solid var(--wb-border);
  }

  &__img {
    width: 100%;
    height: 100%;
    display: block;
  }

  &__file {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    font-size: 11px;
    padding: 4px;
    text-align: center;
    color: var(--el-text-color-secondary);
  }

  &__mask {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    opacity: 0;
    transition: opacity 0.2s;
    cursor: pointer;

    &:hover {
      opacity: 1;
    }
  }
}
</style>
