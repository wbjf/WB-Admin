<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  ElButton,
  ElCheckbox,
  ElDialog,
  ElEmpty,
  ElForm,
  ElFormItem,
  ElInput,
  ElInputNumber,
  ElMessage,
  ElOption,
  ElSelect,
  ElSwitch,
  ElTag
} from 'element-plus'
import { Delete, Plus } from '@element-plus/icons-vue'
import type { FlowComment, FlowEdge, FlowGraph, FlowNode, FlowParam } from '@/types'
import DeviceTree from '@/components/DeviceTree/index.vue'
import { deviceApi } from '@/api/device'
import type { DeviceArea, DeviceItem } from '@/types'
import type { DeviceTreeNode } from '@/components/DeviceTree/useDeviceTree'
import type { InspectorOptions, PaletteItem } from './types'
import type { Selection } from './useFlowEditor'

interface Props {
  graph: FlowGraph
  selection: Selection
  inspector: Required<InspectorOptions>
  paletteIndex: Record<string, PaletteItem>
  readonly?: boolean
  showDevice?: boolean
  showComment?: boolean
  showSimulateFields?: boolean
}
const props = withDefaults(defineProps<Props>(), {
  readonly: false,
  showDevice: false,
  showComment: false,
  showSimulateFields: false
})

const emit = defineEmits<{
  (e: 'updateNode', payload: { id: string; props: Record<string, unknown> }): void
  (e: 'updateText', payload: { id: string; text: string }): void
  (e: 'updateEdge', payload: { id: string; props: Record<string, unknown> }): void
  (e: 'removeNode', id: string): void
}>()

const { t } = useI18n()

const node = computed<FlowNode | null>(() =>
  props.selection.kind === 'node'
    ? props.graph.nodes.find((n) => n.id === props.selection.id) || null
    : null
)
const edge = computed<FlowEdge | null>(() =>
  props.selection.kind === 'edge'
    ? props.graph.edges.find((e) => e.id === props.selection.id) || null
    : null
)

/* ── 表单本地编辑：改完立即写回画布（受控，不做双向绑定直写 graph） ── */
const form = ref<Record<string, unknown>>({})
const text = ref('')

watch(
  node,
  (n) => {
    if (!n) return
    text.value = n.text || ''
    form.value = {
      code: n.properties?.code || '',
      stage: n.properties?.stage || '',
      bay: n.properties?.bay || '',
      cycleTime: n.properties?.cycleTime ?? undefined,
      yield: n.properties?.yield ?? undefined,
      deviceId: n.properties?.deviceId || '',
      deviceName: n.properties?.deviceName || '',
      remark: n.properties?.remark || '',
      locked: !!n.properties?.locked,
      color: n.properties?.color || '',
      params: JSON.parse(JSON.stringify(n.properties?.params || [])) as FlowParam[]
    }
  },
  { immediate: true, deep: true }
)

const edgeForm = ref<Record<string, unknown>>({})
watch(
  edge,
  (e) => {
    if (!e) return
    edgeForm.value = {
      kind: e.properties?.kind || 'main',
      dashed: !!e.properties?.dashed,
      text: e.text || '',
      remark: e.properties?.remark || ''
    }
  },
  { immediate: true }
)

function commit(patch: Record<string, unknown>): void {
  if (!node.value || props.readonly) return
  emit('updateNode', { id: node.value.id, props: patch })
}

function commitAll(): void {
  if (!node.value || props.readonly) return
  commit({ ...form.value })
}

function onTextBlur(): void {
  if (!node.value || props.readonly) return
  if (text.value !== (node.value.text || ''))
    emit('updateText', { id: node.value.id, text: text.value })
}

function commitEdge(patch: Record<string, unknown>): void {
  if (!edge.value || props.readonly) return
  emit('updateEdge', { id: edge.value.id, props: patch })
}

/* ── 参数表 ── */
const params = computed({
  get: () => (form.value.params as FlowParam[]) || [],
  set: (v: FlowParam[]) => (form.value.params = v)
})
function addParam(): void {
  params.value = [...params.value, { key: '', value: '', unit: '' }]
  commitAll()
}
function removeParam(i: number): void {
  params.value = params.value.filter((_, idx) => idx !== i)
  commitAll()
}
function onParamChange(): void {
  commitAll()
}

/* ── 设备绑定 ── */
const areas = ref<DeviceArea[]>([])
const deviceDialog = ref(false)
const deviceLoading = ref(false)

async function openDevicePicker(): Promise<void> {
  deviceDialog.value = true
  if (areas.value.length) return
  deviceLoading.value = true
  try {
    areas.value = await deviceApi.areaTreeSafe()
  } catch {
    ElMessage.warning(t('flow.deviceLoadFailed'))
  } finally {
    deviceLoading.value = false
  }
}

function onDeviceClick(node: DeviceTreeNode): void {
  if (node.type !== 'device') return
  const d = node.device as DeviceItem
  form.value.deviceId = String(d?.id ?? node.key)
  form.value.deviceName = node.name
  deviceDialog.value = false
  commitAll()
}

function clearDevice(): void {
  form.value.deviceId = ''
  form.value.deviceName = ''
  commitAll()
}

/* ── 评论 ── */
const comments = computed<FlowComment[]>(
  () => (node.value?.properties?.comments as FlowComment[]) || []
)
const commentText = ref('')
function addComment(): void {
  if (!node.value || !commentText.value.trim()) return
  const list: FlowComment[] = [
    ...comments.value,
    {
      id: `c_${Date.now().toString(36)}`,
      nodeId: node.value.id,
      author: t('flow.me'),
      content: commentText.value.trim(),
      createdAt: Date.now()
    }
  ]
  commentText.value = ''
  commit({ comments: list })
}

const typeLabel = computed(() =>
  node.value ? props.paletteIndex[node.value.type]?.label || node.value.type : ''
)
</script>

<template>
  <aside class="wb-flow-inspector">
    <!-- 未选中：画布概况 -->
    <div v-if="selection.kind === 'graph' || selection.kind === 'none'" class="ins-block">
      <el-empty :description="t('flow.noSelection')" :image-size="60" />
      <div class="kv">
        <div>
          <span>{{ t('flow.nodes') }}</span>
          <b>{{ graph.nodes.length }}</b>
        </div>
        <div>
          <span>{{ t('flow.edges') }}</span>
          <b>{{ graph.edges.length }}</b>
        </div>
        <div>
          <span>{{ t('flow.lanes') }}</span>
          <b>{{ graph.groups?.length || 0 }}</b>
        </div>
      </div>
    </div>

    <!-- 节点 -->
    <div v-else-if="node" class="ins-block">
      <h3 class="ins-title">
        {{ t('flow.nodeProps') }}
        <el-tag size="small" type="info">{{ typeLabel }}</el-tag>
      </h3>

      <el-form label-position="top" size="small">
        <el-form-item :label="t('flow.name')">
          <el-input
            v-model="text"
            :disabled="readonly"
            @blur="onTextBlur"
            @keyup.enter="onTextBlur"
          />
        </el-form-item>

        <template v-if="inspector.showBasic">
          <el-form-item :label="t('flow.code')">
            <el-input
              v-model="form.code as string"
              :disabled="readonly"
              placeholder="OP-0100"
              @change="commitAll"
            />
          </el-form-item>
          <div class="row2">
            <el-form-item :label="t('flow.stage')">
              <el-input v-model="form.stage as string" :disabled="readonly" @change="commitAll" />
            </el-form-item>
            <el-form-item :label="t('flow.bay')">
              <el-input v-model="form.bay as string" :disabled="readonly" @change="commitAll" />
            </el-form-item>
          </div>
          <el-form-item :label="t('flow.color')">
            <el-input
              v-model="form.color as string"
              :disabled="readonly"
              placeholder="#409eff"
              @change="commitAll"
            />
          </el-form-item>
        </template>

        <template v-if="showSimulateFields">
          <div class="row2">
            <el-form-item :label="t('flow.cycleTime')">
              <el-input-number
                v-model="form.cycleTime as number"
                :min="0"
                :disabled="readonly"
                controls-position="right"
                @change="commitAll"
              />
            </el-form-item>
            <el-form-item :label="t('flow.yield')">
              <el-input-number
                v-model="form.yield as number"
                :min="0"
                :max="1"
                :step="0.001"
                :precision="3"
                :disabled="readonly"
                controls-position="right"
                @change="commitAll"
              />
            </el-form-item>
          </div>
        </template>

        <el-form-item v-if="showDevice" :label="t('flow.device')">
          <div class="device-row">
            <el-input
              :model-value="form.deviceName as string"
              readonly
              :placeholder="t('flow.deviceEmpty')"
            />
            <el-button v-if="!readonly" size="small" @click="openDevicePicker">
              {{ t('flow.pick') }}
            </el-button>
            <el-button v-if="!readonly" size="small" @click="clearDevice">
              {{ t('common.clear') || '清除' }}
            </el-button>
          </div>
        </el-form-item>

        <!-- 业务自定义字段（inspector.fields） -->
        <el-form-item v-for="f in inspector.fields" :key="f.key" :label="f.label">
          <el-select
            v-if="f.type === 'select'"
            v-model="form[f.key] as string"
            :disabled="readonly"
            @change="commitAll"
          >
            <el-option
              v-for="o in f.options || []"
              :key="String(o.value)"
              :label="o.label"
              :value="o.value"
            />
          </el-select>
          <el-switch
            v-else-if="f.type === 'switch'"
            v-model="form[f.key] as boolean"
            :disabled="readonly"
            @change="commitAll"
          />
          <el-input-number
            v-else-if="f.type === 'number'"
            v-model="form[f.key] as number"
            :disabled="readonly"
            @change="commitAll"
          />
          <el-input
            v-else
            v-model="form[f.key] as string"
            :disabled="readonly"
            :type="f.type === 'textarea' ? 'textarea' : 'text'"
            @change="commitAll"
          />
        </el-form-item>

        <el-form-item v-if="inspector.showParams" :label="t('flow.params')">
          <div class="params">
            <div v-for="(p, i) in params" :key="i" class="param-row">
              <el-input
                v-model="p.key"
                :disabled="readonly"
                placeholder="参数"
                @change="onParamChange"
              />
              <el-input
                v-model="p.value"
                :disabled="readonly"
                placeholder="值"
                @change="onParamChange"
              />
              <el-input
                v-model="p.unit"
                :disabled="readonly"
                placeholder="单位"
                class="unit"
                @change="onParamChange"
              />
              <el-button v-if="!readonly" :icon="Delete" size="small" @click="removeParam(i)" />
            </div>
            <el-button v-if="!readonly" :icon="Plus" size="small" @click="addParam">
              {{ t('flow.addParam') }}
            </el-button>
          </div>
        </el-form-item>

        <el-form-item v-if="inspector.showRemark" :label="t('flow.remark')">
          <el-input
            v-model="form.remark as string"
            type="textarea"
            :rows="3"
            :disabled="readonly"
            @change="commitAll"
          />
        </el-form-item>

        <el-form-item v-if="inspector.showBasic" :label="t('flow.locked')">
          <el-switch v-model="form.locked as boolean" :disabled="readonly" @change="commitAll" />
        </el-form-item>
      </el-form>

      <div v-if="showComment" class="comments">
        <h4>{{ t('flow.comments') }}</h4>
        <div v-for="c in comments" :key="c.id" class="comment">
          <b>{{ c.author }}</b>
          <span>{{ c.content }}</span>
        </div>
        <div v-if="!readonly" class="comment-add">
          <el-input
            v-model="commentText"
            size="small"
            :placeholder="t('flow.commentPlaceholder')"
          />
          <el-button size="small" type="primary" @click="addComment">
            {{ t('flow.send') }}
          </el-button>
        </div>
      </div>

      <slot name="extra" :node="node" />

      <el-button
        v-if="!readonly"
        class="danger"
        size="small"
        plain
        @click="emit('removeNode', node.id)"
      >
        {{ t('flow.deleteNode') }}
      </el-button>
    </div>

    <!-- 连线 -->
    <div v-else-if="edge" class="ins-block">
      <h3 class="ins-title">{{ t('flow.edgeProps') }}</h3>
      <el-form label-position="top" size="small">
        <el-form-item :label="t('flow.edgeKind')">
          <el-select
            v-model="edgeForm.kind as string"
            :disabled="readonly"
            @change="commitEdge({ ...edgeForm })"
          >
            <el-option :label="t('flow.kindMain')" value="main" />
            <el-option :label="t('flow.kindRework')" value="rework" />
            <el-option :label="t('flow.kindScrap')" value="scrap" />
            <el-option :label="t('flow.kindMaterial')" value="material" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('flow.edgeLabel')">
          <el-input
            v-model="edgeForm.text as string"
            :disabled="readonly"
            placeholder="OK / NG"
            @change="commitEdge({ ...edgeForm })"
          />
        </el-form-item>
        <el-form-item :label="t('flow.dashed')">
          <el-checkbox
            v-model="edgeForm.dashed as boolean"
            :disabled="readonly"
            @change="commitEdge({ ...edgeForm })"
          />
        </el-form-item>
        <el-form-item :label="t('flow.remark')">
          <el-input
            v-model="edgeForm.remark as string"
            type="textarea"
            :rows="3"
            :disabled="readonly"
            @change="commitEdge({ ...edgeForm })"
          />
        </el-form-item>
      </el-form>
    </div>

    <el-dialog v-model="deviceDialog" :title="t('flow.pickDevice')" width="560px" append-to-body>
      <div v-loading="deviceLoading" style="height: 420px">
        <DeviceTree :areas="areas" height="420px" @device-click="onDeviceClick" />
      </div>
    </el-dialog>
  </aside>
</template>

<style scoped>
.wb-flow-inspector {
  width: 300px;
  flex: none;
  border-left: 1px solid var(--el-border-color-light);
  background: var(--el-bg-color);
  overflow: auto;
  padding: 12px;
}
.ins-title {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 10px;
  font-size: 13px;
  font-weight: 600;
}
.ins-block :deep(.el-form-item) {
  margin-bottom: 10px;
}
.row2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.kv > div {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
  font-size: 12px;
  color: var(--el-text-color-regular);
}
.device-row {
  display: flex;
  gap: 6px;
  width: 100%;
}
.params {
  width: 100%;
}
.param-row {
  display: grid;
  grid-template-columns: 1fr 1fr 60px 32px;
  gap: 4px;
  margin-bottom: 6px;
}
.comments {
  margin-top: 10px;
  border-top: 1px dashed var(--el-border-color-light);
  padding-top: 8px;
}
.comments h4 {
  margin: 0 0 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.comment {
  font-size: 12px;
  padding: 4px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.comment b {
  margin-right: 6px;
}
.comment-add {
  display: flex;
  gap: 6px;
  margin-top: 6px;
}
.danger {
  margin-top: 8px;
  width: 100%;
}
</style>
