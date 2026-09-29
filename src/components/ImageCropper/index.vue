<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import Cropper from 'cropperjs'
import 'cropperjs/dist/cropper.css'
import { ElMessage } from 'element-plus'
import { RefreshLeft, RefreshRight, ZoomIn, ZoomOut } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'

defineOptions({ name: 'ImageCropper' })

const props = defineProps<{ src?: string; aspectRatio?: number; modelValue: boolean; round?: boolean }>()
const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'done', dataUrl: string): void
}>()

const { t } = useI18n()

const visible = ref(false)
const imgRef = ref<HTMLImageElement>()
const cropper = ref<Cropper>()

watch(
  () => props.modelValue,
  async (v) => {
    visible.value = v
    if (v && props.src) {
      await nextTick()
      if (imgRef.value) {
        cropper.value?.destroy()
        cropper.value = new Cropper(imgRef.value, {
          aspectRatio: props.aspectRatio ?? 1,
          viewMode: 1,
          autoCropArea: 0.9,
          background: false
        })
      }
    }
  }
)

watch(visible, (v) => emit('update:modelValue', v))

function rotate(deg: number) {
  cropper.value?.rotate(deg)
}

function zoom(ratio: number) {
  cropper.value?.zoom(ratio)
}

function reset() {
  cropper.value?.reset()
}

function confirm() {
  if (!cropper.value) {
    ElMessage.warning('请稍候再试')
    return
  }
  const canvas = cropper.value.getCroppedCanvas({ width: 300, height: 300 })
  if (!canvas) return
  const dataUrl = canvas.toDataURL('image/png')
  emit('done', dataUrl)
  visible.value = false
}
</script>

<template>
  <el-dialog v-model="visible" :title="t('component.cropperTitle')" width="640px" append-to-body>
    <div class="wb-cropper">
      <img ref="imgRef" :src="src" alt="crop" style="max-width: 100%" />
    </div>

    <template #footer>
      <div class="wb-cropper__ops">
        <el-button-group>
          <el-button :icon="RefreshLeft" size="small" @click="rotate(-90)" />
          <el-button :icon="RefreshRight" size="small" @click="rotate(90)" />
          <el-button :icon="ZoomIn" size="small" @click="zoom(0.2)" />
          <el-button :icon="ZoomOut" size="small" @click="zoom(-0.2)" />
        </el-button-group>
        <div>
          <el-button size="small" @click="reset">{{ t('component.reset') }}</el-button>
          <el-button size="small" type="primary" @click="confirm">{{ t('common.confirm') }}</el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.wb-cropper {
  max-height: 460px;

  &__ops {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
}
</style>
