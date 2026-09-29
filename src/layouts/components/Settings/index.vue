<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '@/stores/modules/settings'
import { PRESET_COLORS, type LayoutMode, type ThemeMode } from '@/utils/theme'

defineOptions({ name: 'SettingsPanel' })

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits(['update:modelValue'])
const { t } = useI18n()
const settings = useSettingsStore()

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})

const modeLabel: Record<ThemeMode, string> = {
  light: t('theme.light'),
  dark: t('theme.dark'),
  auto: t('theme.auto')
}

const layoutLabel: Record<LayoutMode, string> = {
  left: t('theme.leftMenu'),
  top: t('theme.topMenu'),
  mix: t('theme.mixMenu')
}

const customColor = ref(settings.color)

function setColor(color: string) {
  customColor.value = color
  settings.setColor(color)
}

function reset() {
  settings.resetDefault()
  customColor.value = settings.color
}

function copyConfig() {
  const raw = JSON.stringify({ ...settings.$state }, null, 2)
  navigator.clipboard?.writeText(raw)
  ElMessage.success(t('common.copied'))
}
</script>

<template>
  <el-drawer v-model="visible" :title="t('common.theme')" size="300px" append-to-body>
    <div class="wb-settings">
      <div class="wb-settings__row">
        <span>{{ t('theme.mode') }}</span>
        <el-radio-group :model-value="settings.mode" size="small" @change="(v) => settings.setMode(v as ThemeMode)">
          <el-radio-button v-for="(label, key) in modeLabel" :key="key" :value="key">{{ label }}</el-radio-button>
        </el-radio-group>
      </div>

      <div class="wb-settings__row">
        <span>{{ t('theme.layout') }}</span>
        <el-select :model-value="settings.layout" size="small" style="width: 120px" @change="(v) => settings.setLayout(v as LayoutMode)">
          <el-option v-for="(label, key) in layoutLabel" :key="key" :label="label" :value="key" />
        </el-select>
      </div>

      <div class="wb-settings__col">
        <span>{{ t('theme.color') }}</span>
        <div class="wb-settings__colors">
          <span
            v-for="color in PRESET_COLORS"
            :key="color"
            class="wb-settings__color"
            :class="{ 'is-active': settings.color === color }"
            :style="{ background: color }"
            @click="setColor(color)"
          />
        </div>
        <el-color-picker
          :model-value="customColor"
          size="small"
          @change="(v: string | null) => v && setColor(v)"
        />
      </div>

      <el-divider />

      <div class="wb-settings__row">
        <span>{{ t('theme.tagsView') }}</span>
        <el-switch :model-value="settings.tagsView" @change="(v) => settings.set('tagsView', v as boolean)" />
      </div>
      <div class="wb-settings__row">
        <span>{{ t('theme.fixedHeader') }}</span>
        <el-switch :model-value="settings.fixedHeader" @change="(v) => settings.set('fixedHeader', v as boolean)" />
      </div>
      <div class="wb-settings__row">
        <span>{{ t('theme.footer') }}</span>
        <el-switch :model-value="settings.footer" @change="(v) => settings.set('footer', v as boolean)" />
      </div>
      <div class="wb-settings__row">
        <span>{{ t('theme.animation') }}</span>
        <el-switch :model-value="settings.animation" @change="(v) => settings.set('animation', v as boolean)" />
      </div>
      <div class="wb-settings__row">
        <span>{{ t('theme.weak') }}</span>
        <el-switch :model-value="settings.weak" @change="(v) => settings.set('weak', v as boolean)" />
      </div>
      <div class="wb-settings__row">
        <span>{{ t('theme.gray') }}</span>
        <el-switch :model-value="settings.gray" @change="(v) => settings.set('gray', v as boolean)" />
      </div>
      <div class="wb-settings__row">
        <span>页面水印</span>
        <el-switch :model-value="settings.allowWatermark" @change="(v) => settings.set('allowWatermark', v as boolean)" />
      </div>

      <div class="wb-settings__row">
        <span>{{ t('theme.size') }}</span>
        <el-radio-group :model-value="settings.size" size="small" @change="(v) => settings.set('size', v as any)">
          <el-radio-button value="large">Large</el-radio-button>
          <el-radio-button value="default">Default</el-radio-button>
          <el-radio-button value="small">Small</el-radio-button>
        </el-radio-group>
      </div>

      <el-divider />

      <div class="wb-settings__actions">
        <el-button size="small" @click="copyConfig">{{ t('theme.copySettings') }}</el-button>
        <el-button size="small" type="primary" @click="reset">{{ t('theme.reset') }}</el-button>
      </div>
    </div>
  </el-drawer>
</template>

<style scoped lang="scss">
.wb-settings {
  &__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 0;
    font-size: 13px;
  }

  &__col {
    padding: 8px 0;
    font-size: 13px;
  }

  &__colors {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 8px 0;
  }

  &__color {
    width: 20px;
    height: 20px;
    border-radius: 4px;
    cursor: pointer;
    box-shadow: 0 0 0 1px var(--wb-border);

    &.is-active {
      box-shadow: 0 0 0 2px var(--el-color-primary);
    }
  }

  &__actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }
}
</style>
