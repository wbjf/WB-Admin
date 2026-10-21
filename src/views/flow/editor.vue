<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ElButton, ElCheckbox, ElMessage, ElRadioGroup, ElRadioButton } from 'element-plus'
import type { FlowGraph, FlowIssue } from '@/types'
import { flowApi } from '@/api/flow'
import FlowEditor from '@/components/FlowEditor/index.vue'
import type { FlowEditorOptions } from '@/components/FlowEditor/types'
import { migrateFlow } from '@/components/FlowEditor/serialize'

defineOptions({ name: 'FlowEditorPage' })

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const flowId = computed(() => String(route.params.id || ''))
const readonly = computed(() => route.query.readonly === '1')
const loading = ref(false)
const graph = ref<FlowGraph | null>(null)
/** 编辑器最新的一份（保存必须用这个，不能用初始 prop —— 那个是旧引用） */
const current = ref<FlowGraph | null>(null)
const saving = ref(false)
const issues = ref<FlowIssue[]>([])

/** 配置演示：同一组件在不同配置下的差异（对应 PRD 5.5 三档对照） */
const ui = reactive({
  preset: 'pro' as NonNullable<FlowEditorOptions['preset']>,
  readonly: false,
  minimap: true,
  validate: true,
  autoLayout: true,
  version: true,
  template: true,
  lane: true,
  lock: true,
  fullscreen: true,
  ai: false,
  collab: false,
  simulate: false,
  comment: false,
  search: true,
  share: false,
  importExcel: true,
  legend: true,
  /** 空串 = 跟随 preset 档位（用来演示「档位给默认值，实例可覆盖」） */
  palette: '' as '' | 'semiconductor' | 'basic' | 'generic',
  searchable: true,
  collapsible: true,
  draggable: true,
  exportsPng: true,
  exportsSvg: true,
  exportsJson: true,
  exportsExcel: true
})

const config = computed<FlowEditorOptions>(() => ({
  preset: ui.preset,
  features: {
    minimap: ui.minimap,
    validate: ui.validate,
    autoLayout: ui.autoLayout,
    version: ui.version,
    template: ui.template,
    lane: ui.lane,
    lock: ui.lock,
    fullscreen: ui.fullscreen,
    ai: ui.ai,
    collab: ui.collab,
    simulate: ui.simulate,
    comment: ui.comment,
    search: ui.search,
    share: ui.share,
    importExcel: ui.importExcel,
    legend: ui.legend
  },
  palette: {
    preset: ui.palette || undefined,
    searchable: ui.searchable,
    collapsible: ui.collapsible,
    draggable: ui.draggable
  },
  exports: [
    ...(ui.exportsPng ? (['png'] as const) : []),
    ...(ui.exportsSvg ? (['svg'] as const) : []),
    ...(ui.exportsJson ? (['json'] as const) : []),
    ...(ui.exportsExcel ? (['excel'] as const) : [])
  ]
}))

async function load(): Promise<void> {
  if (!flowId.value) return
  loading.value = true
  try {
    const g = await flowApi.detail(flowId.value)
    graph.value = g ? migrateFlow(g) : null
    current.value = graph.value
  } catch {
    ElMessage.error(t('flow.opFailed'))
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(flowId, load)

async function onSave(g: FlowGraph): Promise<void> {
  if (readonly.value || ui.readonly) {
    ElMessage.warning(t('flow.saved'))
    return
  }
  saving.value = true
  try {
    await flowApi.saveGraph(flowId.value, g)
    ElMessage.success(t('flow.saved'))
  } catch {
    ElMessage.error(t('flow.opFailed'))
  } finally {
    saving.value = false
  }
}

function onValidate(list: FlowIssue[]): void {
  issues.value = list
}

function onChange(g: FlowGraph): void {
  current.value = g
}

function back(): void {
  router.push('/flow/index')
}
</script>

<template>
  <div class="page">
    <div class="cfg-bar">
      <div class="row">
        <span class="lb">preset</span>
        <el-radio-group v-model="ui.preset" size="small">
          <el-radio-button value="mini">mini</el-radio-button>
          <el-radio-button value="standard">standard</el-radio-button>
          <el-radio-button value="pro">pro</el-radio-button>
        </el-radio-group>

        <span class="lb">palette</span>
        <el-radio-group v-model="ui.palette" size="small">
          <el-radio-button value="">跟随档位</el-radio-button>
          <el-radio-button value="semiconductor">半导体</el-radio-button>
          <el-radio-button value="basic">基础</el-radio-button>
          <el-radio-button value="generic">通用</el-radio-button>
        </el-radio-group>

        <el-checkbox v-model="ui.readonly" size="small">readonly</el-checkbox>
        <el-button size="small" @click="back">返回列表</el-button>
        <el-button
          size="small"
          type="primary"
          :loading="saving"
          @click="onSave((current || graph) as FlowGraph)"
        >
          {{ t('flow.save') }}
        </el-button>
      </div>

      <div class="row wrap">
        <el-checkbox
          v-for="k in [
            'minimap',
            'validate',
            'autoLayout',
            'version',
            'template',
            'lane',
            'lock',
            'fullscreen',
            'ai',
            'collab',
            'simulate',
            'comment',
            'search',
            'share',
            'importExcel',
            'legend'
          ] as const"
          :key="k"
          v-model="ui[k]"
          size="small"
        >
          {{ k }}
        </el-checkbox>
        <span class="sep" />
        <el-checkbox v-model="ui.searchable" size="small">palette.searchable</el-checkbox>
        <el-checkbox v-model="ui.collapsible" size="small">palette.collapsible</el-checkbox>
        <el-checkbox v-model="ui.draggable" size="small">palette.draggable</el-checkbox>
        <span class="sep" />
        <el-checkbox v-model="ui.exportsPng" size="small">exports.png</el-checkbox>
        <el-checkbox v-model="ui.exportsSvg" size="small">exports.svg</el-checkbox>
        <el-checkbox v-model="ui.exportsJson" size="small">exports.json</el-checkbox>
        <el-checkbox v-model="ui.exportsExcel" size="small">exports.excel</el-checkbox>
      </div>
    </div>

    <div v-loading="loading" class="editor-wrap">
      <FlowEditor
        v-if="graph"
        :key="`${ui.preset}-${ui.readonly}-${ui.palette}`"
        :graph="graph"
        :flow-id="flowId"
        :config="config"
        :readonly="ui.readonly || readonly"
        height="calc(100vh - 220px)"
        @save="onSave"
        @change="onChange"
        @validate="onValidate"
      />
    </div>
  </div>
</template>

<style scoped>
.page {
  padding: 12px;
}
.cfg-bar {
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
  padding: 8px 10px;
  margin-bottom: 10px;
  background: var(--el-bg-color);
}
.cfg-bar .row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.cfg-bar .row.wrap {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px dashed var(--el-border-color-lighter);
}
.cfg-bar .lb {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.sep {
  width: 1px;
  height: 16px;
  background: var(--el-border-color);
}
.editor-wrap {
  min-height: 420px;
}
</style>
