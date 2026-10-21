<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  ElAlert,
  ElButton,
  ElDialog,
  ElEmpty,
  ElInput,
  ElMessage,
  ElTable,
  ElTableColumn,
  ElTag
} from 'element-plus'
import type { FlowGraph, FlowVersion } from '@/types'
import { flowApi } from '@/api/flow'
import { readExcel } from '@/utils/excel'
import { migrateFlow, newId } from './serialize'
import { BUILTIN_TEMPLATES, applyTemplate } from './templates'
import { diffSummary } from './diff'
import type { SimResult } from './simulate'

export type DialogAction = 'version' | 'template' | 'ai' | 'excel' | 'share' | 'search' | null

interface Props {
  modelValue: DialogAction
  graph: FlowGraph
  flowId?: string
}
const props = withDefaults(defineProps<Props>(), { flowId: '' })

const emit = defineEmits<{
  (e: 'update:modelValue', v: DialogAction): void
  (e: 'apply', graph: FlowGraph): void
  (e: 'locate', id: string): void
}>()

const { t } = useI18n()

const open = computed({
  get: () => props.modelValue !== null,
  set: (v: boolean) => emit('update:modelValue', v ? props.modelValue : null)
})

function close(): void {
  emit('update:modelValue', null)
}

const title = computed(() => {
  const map: Record<string, string> = {
    version: t('flow.version'),
    template: t('flow.template'),
    ai: t('flow.aiGenerate'),
    excel: t('flow.importExcel'),
    share: t('flow.share'),
    search: t('flow.search')
  }
  return props.modelValue ? map[props.modelValue] || '' : ''
})

/* ────────── 版本 ────────── */
const versions = ref<FlowVersion[]>([])
const versionLoading = ref(false)
const versionRemark = ref('')
const selectedVersion = ref<number | null>(null)

watch(
  () => props.modelValue,
  async (v) => {
    if (v !== 'version' || !props.flowId) return
    versionLoading.value = true
    try {
      versions.value = (await flowApi.versions(props.flowId)) || []
    } catch {
      versions.value = []
    } finally {
      versionLoading.value = false
    }
  },
  { immediate: true }
)

const diffLines = computed(() => {
  if (!selectedVersion.value) return []
  const v = versions.value.find((x) => x.version === selectedVersion.value)
  if (!v) return []
  return diffSummary(v.graph, props.graph, {
    added: t('flow.diffAdded'),
    removed: t('flow.diffRemoved'),
    changed: t('flow.diffChanged'),
    moved: t('flow.diffMoved'),
    edgeAdded: t('flow.diffEdgeAdded'),
    edgeRemoved: t('flow.diffEdgeRemoved'),
    same: t('flow.diffSame')
  })
})

async function publish(): Promise<void> {
  if (!props.flowId) return
  try {
    await flowApi.publish(props.flowId, { remark: versionRemark.value })
    versionRemark.value = ''
    versions.value = (await flowApi.versions(props.flowId)) || []
    ElMessage.success(t('flow.published'))
  } catch {
    ElMessage.error(t('flow.opFailed'))
  }
}

async function rollback(v: number): Promise<void> {
  if (!props.flowId) return
  try {
    const graph = await flowApi.rollback(props.flowId, { version: v })
    if (graph) {
      emit('apply', migrateFlow(graph))
      close()
      ElMessage.success(t('flow.rolledBack'))
    }
  } catch {
    ElMessage.error(t('flow.opFailed'))
  }
}

/* ────────── 模板 ────────── */
function useTpl(tpl: FlowGraph): void {
  emit('apply', applyTemplate(tpl, tpl.meta.name))
  close()
}

/* ────────── AI ────────── */
const aiPrompt = ref('')
const aiLoading = ref(false)
const aiError = ref('')

async function runAi(): Promise<void> {
  if (!aiPrompt.value.trim()) return
  aiLoading.value = true
  aiError.value = ''
  try {
    // 动态 import：不开 AI 这个功能时，这段代码根本不加载
    const mod = await import('./ai')
    const graph = await mod.generateFlow(aiPrompt.value, { base: props.graph })
    emit('apply', migrateFlow(graph))
    close()
  } catch (e) {
    aiError.value = e instanceof Error ? e.message : String(e)
  } finally {
    aiLoading.value = false
  }
}

/* ────────── 导入 Excel ────────── */
const excelRows = ref<Array<Record<string, unknown>>>([])
async function pickExcel(): Promise<void> {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.xlsx,.xls'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) return
    try {
      excelRows.value = await readExcel<Record<string, unknown>>(file)
    } catch {
      ElMessage.error(t('flow.importFailed'))
    }
  }
  input.click()
}

function importExcelRows(): void {
  const rows = excelRows.value
  if (!rows.length) return
  const graph: FlowGraph = {
    schema: 1,
    meta: { id: props.flowId || '', name: t('flow.importedFlow'), updatedAt: Date.now() },
    nodes: [],
    edges: [],
    groups: []
  }
  rows.forEach((r, i) => {
    const code = String(r['工序编号'] ?? r['code'] ?? '')
    const name = String(r['名称'] ?? r['name'] ?? '')
    const device = String(r['设备'] ?? r['device'] ?? '')
    const cycle = Number(r['节拍'] ?? r['cycleTime'] ?? 0)
    graph.nodes.push({
      id: newId('n'),
      type: 'task',
      x: 100 + (i % 6) * 190,
      y: 200 + Math.floor(i / 6) * 160,
      text: name || code || `工序 ${i + 1}`,
      width: 140,
      height: 54,
      properties: {
        code,
        deviceName: device,
        deviceId: device,
        cycleTime: Number.isFinite(cycle) ? cycle : undefined,
        params: [],
        comments: []
      }
    })
    if (i > 0) {
      graph.edges.push({
        id: newId('e'),
        type: 'polyline',
        sourceNodeId: graph.nodes[i - 1].id,
        targetNodeId: graph.nodes[i].id,
        properties: { kind: 'main' }
      })
    }
  })
  emit('apply', graph)
  close()
}

/* ────────── 分享 ────────── */
const shareUrl = computed(() => {
  const base = typeof location !== 'undefined' ? location.origin + location.pathname : ''
  const id = props.flowId || props.graph.meta.id || ''
  return `${base}#/flow/editor/${id}?readonly=1`
})

function copyShare(): void {
  navigator.clipboard?.writeText(shareUrl.value).then(
    () => ElMessage.success(t('flow.copied')),
    () => ElMessage.warning(t('flow.copyFailed'))
  )
}

/* ────────── 搜索定位 ────────── */
const kw = ref('')
const hits = computed(() => {
  const k = kw.value.trim().toLowerCase()
  if (!k) return []
  return props.graph.nodes.filter((n) => {
    if ((n.text || '').toLowerCase().includes(k)) return true
    if (
      String(n.properties?.code || '')
        .toLowerCase()
        .includes(k)
    )
      return true
    if (
      String(n.properties?.deviceName || '')
        .toLowerCase()
        .includes(k)
    )
      return true
    return false
  })
})

function locate(id: string): void {
  emit('locate', id)
  close()
}

export type { SimResult }
</script>

<template>
  <el-dialog v-model="open" :title="title" width="640px" append-to-body @closed="close">
    <!-- 版本 -->
    <template v-if="modelValue === 'version'">
      <div v-loading="versionLoading">
        <div class="publish">
          <el-input v-model="versionRemark" size="small" :placeholder="t('flow.versionRemark')" />
          <el-button size="small" type="primary" :disabled="!flowId" @click="publish">
            {{ t('flow.publish') }}
          </el-button>
        </div>
        <el-table :data="versions" size="small" style="margin-top: 10px">
          <el-table-column prop="version" :label="t('flow.versionNo')" width="80" />
          <el-table-column prop="name" :label="t('flow.name')" width="120" />
          <el-table-column prop="remark" :label="t('flow.remark')" />
          <el-table-column :label="t('common.operate') || '操作'" width="160">
            <template #default="{ row }">
              <el-button size="small" link @click="selectedVersion = row.version">
                {{ t('flow.compare') }}
              </el-button>
              <el-button size="small" link type="primary" @click="rollback(row.version)">
                {{ t('flow.rollback') }}
              </el-button>
            </template>
          </el-table-column>
        </el-table>
        <div v-if="diffLines.length" class="diff">
          <h4>{{ t('flow.diffTitle') }}</h4>
          <p v-for="(l, i) in diffLines" :key="i">{{ l }}</p>
        </div>
      </div>
    </template>

    <!-- 模板 -->
    <template v-else-if="modelValue === 'template'">
      <div class="tpl-list">
        <div v-for="tpl in BUILTIN_TEMPLATES" :key="tpl.meta.name" class="tpl" @click="useTpl(tpl)">
          <b>{{ tpl.meta.name }}</b>
          <span>
            {{ tpl.nodes.length }} {{ t('flow.nodes2') }} · {{ tpl.edges.length }}
            {{ t('flow.edges') }}
          </span>
        </div>
      </div>
    </template>

    <!-- AI -->
    <template v-else-if="modelValue === 'ai'">
      <el-alert type="info" :closable="false" :title="t('flow.aiTip')" />
      <el-input
        v-model="aiPrompt"
        type="textarea"
        :rows="4"
        :placeholder="t('flow.aiPlaceholder')"
        style="margin-top: 10px"
      />
      <p v-if="aiError" class="err">{{ aiError }}</p>
      <div class="actions">
        <el-button size="small" type="primary" :loading="aiLoading" @click="runAi">
          {{ t('flow.generate') }}
        </el-button>
        <el-button size="small" @click="close">{{ t('common.cancel') || '取消' }}</el-button>
      </div>
    </template>

    <!-- 导入 Excel -->
    <template v-else-if="modelValue === 'excel'">
      <el-alert type="info" :closable="false" :title="t('flow.excelTip')" />
      <div class="actions">
        <el-button size="small" @click="pickExcel">{{ t('flow.pickFile') }}</el-button>
        <el-button
          size="small"
          type="primary"
          :disabled="!excelRows.length"
          @click="importExcelRows"
        >
          {{ t('flow.import') }}（{{ excelRows.length }}）
        </el-button>
      </div>
      <el-table
        v-if="excelRows.length"
        :data="excelRows"
        size="small"
        style="margin-top: 10px"
        max-height="240"
      >
        <el-table-column
          v-for="k in Object.keys(excelRows[0] || {})"
          :key="k"
          :prop="k"
          :label="k"
        />
      </el-table>
    </template>

    <!-- 分享 -->
    <template v-else-if="modelValue === 'share'">
      <p class="share-url">{{ shareUrl }}</p>
      <div class="actions">
        <el-button size="small" type="primary" @click="copyShare">{{ t('flow.copy') }}</el-button>
      </div>
    </template>

    <!-- 搜索 -->
    <template v-else-if="modelValue === 'search'">
      <el-input v-model="kw" size="small" :placeholder="t('flow.searchPlaceholder')" clearable />
      <div class="hit-list">
        <div v-for="n in hits" :key="n.id" class="hit" @click="locate(n.id)">
          <el-tag size="small" type="info">{{ n.properties?.code || n.type }}</el-tag>
          <span>{{ n.text || n.id }}</span>
        </div>
        <el-empty v-if="kw && !hits.length" :description="t('flow.noMatch')" :image-size="50" />
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
.publish {
  display: flex;
  gap: 8px;
}
.diff {
  margin-top: 12px;
  padding: 8px 10px;
  border-radius: 6px;
  background: var(--el-fill-color-light);
  font-size: 12px;
}
.diff h4 {
  margin: 0 0 6px;
}
.tpl-list {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.tpl {
  padding: 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  cursor: pointer;
}
.tpl:hover {
  border-color: var(--el-color-primary);
}
.tpl b {
  display: block;
  font-size: 13px;
}
.tpl span {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}
.err {
  color: var(--el-color-danger);
  font-size: 12px;
  margin-top: 6px;
}
.share-url {
  font-size: 12px;
  word-break: break-all;
  padding: 8px;
  background: var(--el-fill-color-light);
  border-radius: 4px;
}
.hit-list {
  margin-top: 10px;
  max-height: 280px;
  overflow: auto;
}
.hit {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 4px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  cursor: pointer;
  font-size: 13px;
}
.hit:hover {
  background: var(--el-fill-color-light);
}
</style>
