<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  ElButton,
  ElButtonGroup,
  ElDropdown,
  ElDropdownItem,
  ElDropdownMenu,
  ElInput,
  ElTag,
  ElTooltip
} from 'element-plus'
import type { BuiltinAction, ResolvedFlowConfig, ToolbarItem } from './types'

interface Props {
  cfg: ResolvedFlowConfig
  /** 已归一化的工具条项 */
  items: Array<{ kind: 'builtin'; action: BuiltinAction } | { kind: 'custom'; item: ToolbarItem }>
  name: string
  dirty?: boolean
  saveText?: string
  canUndo?: boolean
  canRedo?: boolean
  fullscreen?: boolean
}
const props = withDefaults(defineProps<Props>(), {
  dirty: false,
  saveText: '',
  canUndo: true,
  canRedo: true,
  fullscreen: false
})

const emit = defineEmits<{
  (e: 'action', action: BuiltinAction): void
  (e: 'exportAs', type: 'png' | 'jpeg' | 'svg' | 'json' | 'excel' | 'print'): void
  (e: 'update:name', value: string): void
}>()

const { t } = useI18n()

const LABEL: Record<BuiltinAction, string> = computed(() => ({
  undo: t('flow.undo'),
  redo: t('flow.redo'),
  validate: t('flow.validate'),
  layout: t('flow.autoLayout'),
  export: t('flow.export'),
  import: t('flow.import'),
  save: t('flow.save'),
  fullscreen: props.fullscreen ? t('flow.exitFullscreen') : t('flow.fullscreen'),
  version: t('flow.version'),
  template: t('flow.template'),
  ai: t('flow.aiGenerate'),
  collab: t('flow.collab'),
  simulate: t('flow.simulate'),
  search: t('flow.search'),
  share: t('flow.share')
})).value

const ICON: Record<BuiltinAction, string> = {
  undo: '↶',
  redo: '↷',
  validate: '✓',
  layout: '⇄',
  export: '⤓',
  import: '⤒',
  save: '',
  fullscreen: '⛶',
  version: '⏱',
  template: '▦',
  ai: '✦',
  collab: '👥',
  simulate: '∑',
  search: '🔍',
  share: '🔗'
}

const EXPORT_LABEL: Record<string, string> = computed(() => ({
  png: 'PNG ' + t('flow.image'),
  jpeg: 'JPEG ' + t('flow.image'),
  svg: 'SVG ' + t('flow.vector'),
  json: '.flow.json',
  excel: t('flow.excelCard'),
  print: t('flow.print')
})).value

function run(a: BuiltinAction): void {
  if (a === 'export') return
  emit('action', a)
}
</script>

<template>
  <div class="wb-flow-toolbar">
    <slot name="left" />

    <el-input
      class="fname"
      :model-value="name"
      size="small"
      :disabled="cfg.readonly"
      @update:model-value="emit('update:name', $event)"
    />
    <el-tag v-if="dirty" size="small" type="warning">{{ saveText || t('flow.unsaved') }}</el-tag>
    <el-tag v-else size="small" type="success">{{ t('flow.saved') }}</el-tag>

    <div class="spacer" />

    <template v-for="(it, i) in items" :key="i">
      <!-- 自定义项 -->
      <el-button
        v-if="it.kind === 'custom'"
        size="small"
        @click="it.item.onClick && it.item.onClick($props as never)"
      >
        {{ it.item.label }}
      </el-button>

      <!-- 撤销 / 重做 -->
      <el-button-group v-else-if="it.action === 'undo'" size="small">
        <el-tooltip :content="LABEL.undo" placement="bottom">
          <el-button :disabled="!canUndo || cfg.readonly" @click="run('undo')">
            {{ ICON.undo }}
          </el-button>
        </el-tooltip>
        <el-tooltip :content="LABEL.redo" placement="bottom">
          <el-button :disabled="!canRedo || cfg.readonly" @click="run('redo')">
            {{ ICON.redo }}
          </el-button>
        </el-tooltip>
      </el-button-group>

      <!-- 导出下拉 -->
      <el-dropdown
        v-else-if="it.action === 'export'"
        size="small"
        @command="(c: string) => emit('exportAs', c as never)"
      >
        <el-button size="small" data-test="tb-export">
          {{ ICON.export }} {{ LABEL.export }} ▾
        </el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item v-for="t2 in cfg.exports" :key="t2" :command="t2">
              {{ EXPORT_LABEL[t2] }}
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>

      <el-button v-else-if="it.action === 'redo'" v-show="false" size="small" />

      <el-button v-else-if="it.action === 'save'" size="small" type="primary" @click="run('save')">
        {{ LABEL.save }}
      </el-button>

      <el-tooltip v-else :content="LABEL[it.action]" placement="bottom">
        <el-button size="small" :data-test="'tb-' + it.action" @click="run(it.action)">
          {{ ICON[it.action] }}
          <span class="txt">{{ LABEL[it.action] }}</span>
        </el-button>
      </el-tooltip>
    </template>

    <slot name="right" />
  </div>
</template>

<style scoped>
.wb-flow-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--el-border-color-light);
  background: var(--el-bg-color);
  flex: none;
  /* pro 档按钮很多：允许换行，否则图名输入框会被 flex 挤压成几像素宽 */
  flex-wrap: wrap;
  row-gap: 8px;
}
.fname {
  width: 240px;
  /* 关键：不参与收缩，否则按钮一多输入框就被压没 */
  flex: none;
}
.spacer {
  flex: 1;
}
.txt {
  margin-left: 4px;
  font-size: 12px;
}
</style>
