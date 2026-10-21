<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ElButton, ElMessage, ElMessageBox, ElTag, ElUpload } from 'element-plus'
import { Delete, Edit, Plus, UploadFilled } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import type { FlowListItem } from '@/types'
import { flowApi } from '@/api/flow'
import SearchForm from '@/components/SearchForm/index.vue'
import ProTable from '@/components/ProTable/index.vue'
import ProDialog from '@/components/ProDialog.vue'
import ProForm from '@/components/ProForm/index.vue'
import { readFlowFile } from '@/components/FlowEditor/useFlowExport'
import type { FormSchema } from '@/components/ProForm/types'
import type { TableColumn } from '@/components/ProTable/types'

defineOptions({ name: 'FlowList' })

const { t } = useI18n()
const router = useRouter()

/* ────────────────── 查询 ────────────────── */

const query = reactive<{ name: string; category: string; status: string }>({
  name: '',
  category: '',
  status: ''
})

const searchSchemas = computed<FormSchema[]>(() => [
  { prop: 'name', label: t('flow.name'), type: 'input' },
  {
    prop: 'category',
    label: t('flow.stage'),
    type: 'select',
    options: [
      { label: t('flow.catProcess'), value: 'process' },
      { label: t('flow.catLayout'), value: 'layout' },
      { label: t('flow.catGeneric'), value: 'generic' }
    ]
  },
  {
    prop: 'status',
    label: t('common.status'),
    type: 'select',
    options: [
      { label: t('flow.statusDraft'), value: 'draft' },
      { label: t('flow.statusReview'), value: 'review' },
      { label: t('flow.statusPublished'), value: 'published' }
    ]
  }
])

const tableRef = ref<InstanceType<typeof ProTable> | null>(null)
const selected = ref<FlowListItem[]>([])

/** ProTable 传进来的是分页参数，这里补上查询条件（空值不传，别把空串当过滤词） */
async function request(
  params: Record<string, any>
): Promise<{ list: FlowListItem[]; total: number }> {
  const filter: Record<string, any> = {}
  if (query.name) filter.name = query.name
  if (query.category) filter.category = query.category
  if (query.status) filter.status = query.status
  const res = await flowApi.list({ ...params, ...filter })
  return { list: res?.list || [], total: res?.total || 0 }
}

function reload(): void {
  tableRef.value?.reload()
}

function resetQuery(): void {
  query.name = ''
  query.category = ''
  query.status = ''
  reload()
}

/* ────────────────── 展示映射 ────────────────── */

const CATEGORY_META: Record<string, { label: string; type: 'primary' | 'warning' | 'info' }> = {
  process: { label: 'catProcess', type: 'primary' },
  layout: { label: 'catLayout', type: 'warning' },
  generic: { label: 'catGeneric', type: 'info' }
}

const STATUS_META: Record<string, { label: string; type: 'info' | 'warning' | 'success' }> = {
  draft: { label: 'statusDraft', type: 'info' },
  review: { label: 'statusReview', type: 'warning' },
  published: { label: 'statusPublished', type: 'success' }
}

const columns = ref<TableColumn[]>([
  { label: t('flow.name'), prop: 'name', minWidth: 260, slot: 'name', sortable: false },
  { label: t('flow.stage'), prop: 'category', width: 110, slot: 'category', sortable: false },
  // 表头写明「节点/连线」，否则 15 / 11 这种单元格会让人猜第二个数字是什么
  {
    label: t('flow.nodeEdge'),
    prop: 'nodeCount',
    width: 110,
    align: 'right',
    slot: 'nodeCount',
    sortable: false
  },
  { label: t('common.status'), prop: 'status', width: 100, slot: 'status', sortable: false },
  {
    label: t('flow.versionNo'),
    prop: 'version',
    width: 90,
    align: 'center',
    slot: 'version',
    sortable: false
  },
  { label: t('flow.updatedAt'), prop: 'updatedAt', width: 170, slot: 'updatedAt', sortable: false },
  {
    label: t('common.operate'),
    prop: 'operation',
    width: 160,
    fixed: 'right',
    slot: 'operation',
    sortable: false
  }
])

function fmtTime(ts?: number): string {
  return ts ? dayjs(ts).format('YYYY-MM-DD HH:mm') : '-'
}

/* ────────────────── 操作 ────────────────── */

function open(id: string): void {
  router.push(`/flow/editor/${id}`)
}

async function remove(row: FlowListItem): Promise<void> {
  try {
    await ElMessageBox.confirm(`${t('common.confirmDelete')}「${row.name}」`, t('common.tip'), {
      type: 'warning'
    })
  } catch {
    return
  }
  await flowApi.remove(row.id)
  ElMessage.success(t('common.success'))
  reload()
}

async function removeSelected(): Promise<void> {
  const ids = selected.value.map((r) => r.id)
  if (!ids.length) return
  try {
    await ElMessageBox.confirm(t('common.confirmDelete'), t('common.tip'), { type: 'warning' })
  } catch {
    return
  }
  await flowApi.remove(ids)
  ElMessage.success(t('common.success'))
  tableRef.value?.clearSelection()
  reload()
}

/* ────────────────── 新建 ────────────────── */

const createVisible = ref(false)
const creating = ref(false)
const formRef = ref<InstanceType<typeof ProForm> | null>(null)
const createForm = reactive<{
  name: string
  category: NonNullable<FlowListItem['category']>
  description: string
}>({
  name: '',
  category: 'process',
  description: ''
})

const createSchemas = computed<FormSchema[]>(() => [
  {
    prop: 'name',
    label: t('flow.name'),
    type: 'input',
    span: 24,
    rules: [{ required: true, message: t('flow.name'), trigger: ['blur', 'change'] }]
  },
  {
    prop: 'category',
    label: t('flow.stage'),
    type: 'radio',
    span: 24,
    options: [
      { label: t('flow.catProcess'), value: 'process' },
      { label: t('flow.catLayout'), value: 'layout' },
      { label: t('flow.catGeneric'), value: 'generic' }
    ]
  },
  {
    prop: 'description',
    label: t('flow.remark'),
    type: 'textarea',
    span: 24,
    props: { rows: 2, placeholder: t('flow.descPlaceholder') }
  }
])

function openCreate(): void {
  createForm.name = ''
  createForm.category = 'process'
  createForm.description = ''
  createVisible.value = true
}

async function submitCreate(): Promise<void> {
  const ok = await formRef.value?.validate()
  if (!ok) return
  creating.value = true
  try {
    const res = await flowApi.add({ ...createForm })
    createVisible.value = false
    ElMessage.success(t('common.success'))
    if (res?.id) open(res.id)
    else reload()
  } finally {
    creating.value = false
  }
}

/* ────────────────── 导入 JSON ────────────────── */

async function onImportFile(file: any): Promise<void> {
  const raw = file?.raw as File | undefined
  if (!raw) return
  try {
    const graph = await readFlowFile(raw)
    const res = await flowApi.importJson(graph)
    ElMessage.success(t('flow.importOk'))
    if (res?.id) open(res.id)
    else reload()
  } catch {
    ElMessage.error(t('flow.importFailed'))
  }
}
</script>

<template>
  <div class="wb-page wb-flow-list">
    <SearchForm v-model="query" :schemas="searchSchemas" @search="reload" @reset="resetQuery" />

    <div class="wb-card">
      <ProTable
        ref="tableRef"
        row-key="id"
        :columns="columns"
        :request="request"
        :selection="true"
        export-name="wb-flow-list"
        :print-title="t('flow.listTitle')"
        @selection-change="(rows: FlowListItem[]) => (selected = rows)"
      >
        <template #toolbar-left>
          <el-button v-hasPermi="['flow:add']" type="primary" @click="openCreate">
            <el-icon><Plus /></el-icon>
            {{ t('common.add') }}
          </el-button>
          <el-button
            v-hasPermi="['flow:remove']"
            plain
            :disabled="!selected.length"
            @click="removeSelected"
          >
            <el-icon><Delete /></el-icon>
            {{ t('flow.batchDelete') }}
          </el-button>
          <el-upload
            :show-file-list="false"
            :auto-upload="false"
            accept=".json"
            action="#"
            :on-change="onImportFile"
          >
            <el-button v-hasPermi="['flow:add']" plain>
              <el-icon><UploadFilled /></el-icon>
              {{ t('flow.importJson') }}
            </el-button>
          </el-upload>
        </template>

        <!-- 名称：主标题 + 描述副标题，比单列一行更能说明「这是什么图」 -->
        <template #name="{ row }">
          <div class="fl-name">
            <button class="fl-name__text" type="button" @click="open(row.id)">
              {{ row.name }}
            </button>
            <span v-if="row.description" class="fl-name__desc">{{ row.description }}</span>
          </div>
        </template>

        <template #category="{ row }">
          <el-tag
            v-if="row.category"
            size="small"
            effect="light"
            :type="CATEGORY_META[row.category]?.type || 'info'"
          >
            {{ t(`flow.${CATEGORY_META[row.category]?.label || 'catGeneric'}`) }}
          </el-tag>
          <span v-else class="fl-muted">-</span>
        </template>

        <template #nodeCount="{ row }">
          <span class="fl-num">{{ row.nodeCount ?? 0 }}</span>
          <span class="fl-muted">/ {{ row.edgeCount ?? 0 }}</span>
        </template>

        <template #status="{ row }">
          <el-tag size="small" effect="plain" :type="STATUS_META[row.status]?.type || 'info'">
            {{ t(`flow.${STATUS_META[row.status]?.label || 'statusDraft'}`) }}
          </el-tag>
        </template>

        <template #version="{ row }">
          <span class="fl-version">v{{ row.version ?? 1 }}</span>
        </template>

        <template #updatedAt="{ row }">
          <span class="fl-time">{{ fmtTime(row.updatedAt) }}</span>
        </template>

        <template #operation="{ row }">
          <el-button v-hasPermi="['flow:edit']" link type="primary" @click="open(row.id)">
            <el-icon><Edit /></el-icon>
            {{ t('flow.openEditor') }}
          </el-button>
          <el-button
            v-hasPermi="['flow:remove']"
            link
            type="danger"
            @click="remove(row as FlowListItem)"
          >
            <el-icon><Delete /></el-icon>
            {{ t('common.delete') }}
          </el-button>
        </template>
      </ProTable>
    </div>

    <ProDialog
      v-model="createVisible"
      :title="t('flow.createTitle')"
      width="560px"
      :loading="creating"
      @confirm="submitCreate"
    >
      <ProForm
        ref="formRef"
        :model-value="createForm"
        :schemas="createSchemas"
        label-width="80px"
        @update:model-value="(v: Record<string, any>) => Object.assign(createForm, v)"
      />
    </ProDialog>
  </div>
</template>

<style scoped lang="scss">
.wb-flow-list {
  .fl-name {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;

    &__text {
      padding: 0;
      border: none;
      background: none;
      font: inherit;
      font-weight: 500;
      color: var(--el-color-primary);
      text-align: left;
      cursor: pointer;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;

      &:hover {
        text-decoration: underline;
      }
    }

    &__desc {
      font-size: 12px;
      color: var(--el-text-color-secondary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .fl-num {
    font-variant-numeric: tabular-nums;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .fl-version,
  .fl-time {
    font-variant-numeric: tabular-nums;
    color: var(--el-text-color-regular);
  }

  .fl-muted {
    color: var(--el-text-color-placeholder);
    font-size: 12px;
  }
}
</style>
