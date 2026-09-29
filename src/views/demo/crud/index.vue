<script setup lang="ts">
defineOptions({ name: 'DemoCrud' })

import { computed, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Delete, Download, Edit, Plus, UploadFilled, View } from '@element-plus/icons-vue'
import type { FormSchema } from '@/components/ProForm/types'
import type { TableColumn } from '@/components/ProTable/types'
import SearchForm from '@/components/SearchForm/index.vue'
import ProTable from '@/components/ProTable/index.vue'
import ProDialog from '@/components/ProDialog.vue'
import ProForm from '@/components/ProForm/index.vue'
import DictTag from '@/components/Dict/DictTag.vue'
import MarkdownEditor from '@/components/Editor/MarkdownEditor.vue'
import { demoApi, type DemoItem } from '@/api/demo'
import { useCrud } from '@/composables/useCrud'
import { addDateRange, toThousands } from '@/utils'
import { exportExcel, readExcel } from '@/utils/excel'
import { confirmExport } from '@/utils/download'
import { hasPermi } from '@/utils/permission'
import { useI18n } from 'vue-i18n'
import type { PageQuery } from '@/types'

const { t } = useI18n()

const TAG_OPTIONS = ['热销', '新品', '清仓', '包邮', '限量', '预售']

/** ---------- 查询条件 ---------- */
const queryParams = reactive<Record<string, any> & { dateRange?: [string, string] }>({})

const searchSchemas = computed<FormSchema[]>(() => [
  { prop: 'name', label: '商品名称', type: 'input' },
  { prop: 'category', label: '商品分类', type: 'dict', dictType: 'demo_category' },
  { prop: 'status', label: t('common.status'), type: 'dict', dictType: 'sys_normal_disable' },
  { prop: 'dateRange', label: t('common.dateRange'), type: 'daterange' }
])

/** ---------- useCrud：统一驱动查询 / 新增 / 编辑 / 删除 / 提交 ---------- */
const crud = useCrud<DemoItem>({
  listApi: (params) => demoApi.list(params as PageQuery),
  detailApi: demoApi.detail,
  addApi: demoApi.add,
  updateApi: demoApi.update,
  delApi: (ids) => demoApi.remove(ids),
  pk: 'id'
})

const tableRef = crud.tableRef

async function request(params: Record<string, any>): Promise<{ list: DemoItem[]; total: number }> {
  const { dateRange, ...rest } = queryParams
  const finalParams = addDateRange(rest, dateRange ? ([dateRange[0], dateRange[1]] as [string, string]) : undefined)
  return crud.query({ ...finalParams, ...params })
}

/** ---------- 表格列 ---------- */
const columns = ref<TableColumn[]>([
  { label: '主键', prop: 'id', width: 100, hidden: true, sortable: false },
  { label: '商品名称', prop: 'name', minWidth: 180, sortable: false },
  { label: '商品分类', prop: 'category', slot: 'category', width: 120, sortable: false },
  { label: '价格', prop: 'price', slot: 'price', width: 130, align: 'right', sortable: true },
  { label: '库存', prop: 'stock', slot: 'stock', width: 110, align: 'right', sortable: true },
  { label: t('common.status'), prop: 'status', slot: 'status', width: 100, sortable: false },
  { label: '标签', prop: 'tags', slot: 'tags', minWidth: 180, sortable: false },
  { label: t('common.createTime'), prop: 'createTime', minWidth: 170, sortable: true },
  {
    label: t('common.operate'),
    prop: 'operation',
    slot: 'operation',
    width: 200,
    fixed: 'right',
    sortable: false
  }
])

/** ---------- 表单 ---------- */
const proFormRef = ref<any>(null)

const formSchemas = computed<FormSchema[]>(() => [
  {
    prop: 'name',
    label: '商品名称',
    type: 'input',
    span: 12,
    rules: [{ required: true, message: '请输入商品名称', trigger: ['blur', 'change'] }]
  },
  { prop: 'category', label: '商品分类', type: 'dict', dictType: 'demo_category', span: 12 },
  {
    prop: 'price',
    label: '价格',
    type: 'number',
    span: 12,
    props: { min: 0, precision: 2, step: 1, controlsPosition: 'right', style: 'width:100%' },
    rules: [
      { required: true, message: '请输入价格', trigger: ['blur', 'change'] },
      {
        validator: (_rule: any, value: any, callback: any) => {
          if (value === undefined || value === null || value === '') {
            callback(new Error('请输入价格'))
            return
          }
          if (Number(value) < 0) {
            callback(new Error('价格不能小于 0'))
            return
          }
          callback()
        },
        trigger: ['blur', 'change']
      }
    ]
  },
  { prop: 'stock', label: '库存', type: 'number', span: 12, props: { min: 0, step: 1, controlsPosition: 'right', style: 'width:100%' } },
  {
    prop: 'status',
    label: t('common.status'),
    type: 'radio',
    span: 12,
    options: [
      { label: t('common.enabled'), value: '0' },
      { label: t('common.disabled'), value: '1' }
    ]
  },
  { prop: 'createTime', label: t('common.createTime'), type: 'date', span: 12 },
  {
    prop: 'tags',
    label: '标签',
    type: 'select',
    span: 24,
    options: TAG_OPTIONS.map((tag) => ({ label: tag, value: tag })),
    props: { multiple: true, filterable: true, allowCreate: true, defaultFirstOption: true, style: 'width:100%' }
  },
  { prop: 'cover', label: '封面图', type: 'upload', span: 24, props: { listType: 'picture-card' } },
  { prop: 'remark', label: t('common.remark'), type: 'textarea', span: 24 },
  { prop: 'description', label: '富文本说明', type: 'slot', slot: 'description', span: 24 }
])

function onFormChange(value: Record<string, any>): void {
  Object.assign(crud.formData, value)
}

async function openAdd(): Promise<void> {
  crud.openAdd({ status: '0', stock: 0, tags: [], category: '' } as Partial<DemoItem>)
}

async function openEdit(row: DemoItem): Promise<void> {
  try {
    await crud.openEdit(row)
  } catch (e: any) {
    ElMessage.error(e?.message || t('common.failed'))
  }
}

async function onSubmit(): Promise<void> {
  const ok = await proFormRef.value?.validate()
  if (!ok) return
  await crud.submit()
}

/** ---------- 详情 ---------- */
const detailVisible = ref(false)
const detail = ref<Partial<DemoItem>>({})

async function openDetail(row: DemoItem): Promise<void> {
  try {
    const res = await demoApi.detail(row.id)
    detail.value = { ...row, ...(res ?? {}) }
  } catch (e: any) {
    detail.value = { ...row }
    ElMessage.error(e?.message || t('common.failed'))
  }
  detailVisible.value = true
}

/** ---------- 状态切换 ---------- */
async function changeStatus(row: DemoItem, val: boolean): Promise<void> {
  try {
    await demoApi.update({ id: row.id, status: val ? '0' : '1' })
    row.status = val ? '0' : '1'
    ElMessage.success(t('common.success'))
  } catch (e: any) {
    ElMessage.error(e?.message || t('common.failed'))
  }
}

/** ---------- 导入 ---------- */
const importVisible = ref(false)
const importRows = ref<Record<string, any>[]>([])

const importColumns = computed<string[]>(() => Object.keys(importRows.value[0] ?? {}).slice(0, 6))

async function onImportFile(file: any): Promise<void> {
  try {
    const rows = await readExcel<Record<string, any>>(file?.raw as File)
    if (!rows.length) {
      ElMessage.warning(t('common.emptyFile'))
      return
    }
    importRows.value = rows.slice(0, 5)
    importVisible.value = true
    ElMessage.success(`共解析 ${rows.length} 条数据，下方预览前 ${importRows.value.length} 条`)
  } catch {
    ElMessage.error(t('common.parseFailed'))
  }
}

/** ---------- 导出 ---------- */
async function exportData(): Promise<void> {
  if (!(await confirmExport())) return
  try {
    const rows: DemoItem[] =
      (crud.tableRef.value as any)?.getData?.() ?? crud.list.value ?? []
    if (!rows.length) {
      ElMessage.warning(t('common.noData'))
      return
    }
    const cols = columns.value
      .filter((c) => c.prop !== 'operation')
      .map((c) => ({
        label: c.label,
        prop: c.prop,
        width: 20,
        formatter: (row: DemoItem, value: any) => {
          if (c.prop === 'price') return `¥${toThousands(Number(value ?? 0))}`
          if (c.prop === 'category') return String(value ?? '')
          return value
        }
      }))
    exportExcel(cols, rows, 'wb-demo-crud', 'CRUD 示例')
    ElMessage.success(t('common.success'))
  } catch (e: any) {
    ElMessage.error(e?.message || t('common.failed'))
  }
}
</script>

<template>
  <div class="wb-page wb-demo-crud">
    <el-alert type="info" show-icon :closable="false" class="wb-mb12">
      <div class="wb-demo-crud__tip">
        <div>本页是所有业务页面的标准写法：<b>SearchForm + ProTable + ProDialog + useCrud</b>。</div>
        <div>新增、编辑、删除、详情、提交由 useCrud 统一驱动；分页、多选、列设置、打印交由 ProTable 负责。</div>
        <div>复制本页改名即可产出新业务页，只需替换列定义、表单 schema 与字典类型。</div>
      </div>
    </el-alert>

    <SearchForm v-model="queryParams" :schemas="searchSchemas" @search="crud.reload()" />

    <div class="wb-card">
      <ProTable
        ref="tableRef"
        row-key="id"
        :columns="columns"
        :request="request"
        :selection="true"
        export-name="wb-demo-crud"
        print-title="CRUD 示例数据"
        @selection-change="crud.onSelectionChange"
      >
        <template #toolbar-left>
          <el-button v-hasPermi="['demo:crud:add']" type="primary" @click="openAdd">
            <el-icon><Plus /></el-icon>{{ t('common.add') }}
          </el-button>
          <el-button v-hasPermi="['demo:crud:remove']" plain :disabled="!crud.selected.value.length" @click="crud.remove()">
            <el-icon><Delete /></el-icon>{{ t('common.delete') }}
          </el-button>
          <el-upload :show-file-list="false" :auto-upload="false" accept=".xlsx,.xls,.csv" action="#" :on-change="onImportFile">
            <el-button v-hasPermi="['demo:crud:add']" plain>
              <el-icon><UploadFilled /></el-icon>{{ t('common.import') }}
            </el-button>
          </el-upload>
          <el-button v-hasPermi="['demo:crud:export']" plain @click="exportData">
            <el-icon><Download /></el-icon>{{ t('common.export') }}
          </el-button>
        </template>

        <template #category="{ row }">
          <DictTag dict-type="demo_category" :value="row.category" />
        </template>

        <template #price="{ row }">
          <span class="wb-demo-crud__price">¥{{ toThousands(Number(row.price ?? 0)) }}</span>
        </template>

        <template #stock="{ row }">
          <span :class="{ 'wb-demo-crud__low': Number(row.stock) < 50 }">{{ row.stock }}</span>
        </template>

        <template #status="{ row }">
          <el-switch
            :model-value="row.status === '0'"
            :disabled="!hasPermi(['demo:crud:edit'])"
            @change="(v: any) => changeStatus(row as DemoItem, v)"
          />
        </template>

        <template #tags="{ row }">
          <template v-if="row.tags?.length">
            <el-tag v-for="tag in row.tags" :key="tag" size="small" effect="plain" class="wb-demo-crud__tag">
              {{ tag }}
            </el-tag>
          </template>
          <span v-else class="wb-text-muted">-</span>
        </template>

        <template #operation="{ row }">
          <el-button v-hasPermi="['demo:crud:list']" link type="info" @click="openDetail(row as DemoItem)">
            <el-icon><View /></el-icon>{{ t('common.detail') }}
          </el-button>
          <el-button v-hasPermi="['demo:crud:edit']" link type="primary" @click="openEdit(row as DemoItem)">
            <el-icon><Edit /></el-icon>{{ t('common.edit') }}
          </el-button>
          <el-button v-hasPermi="['demo:crud:remove']" link type="danger" @click="crud.remove(row.id)">
            <el-icon><Delete /></el-icon>{{ t('common.delete') }}
          </el-button>
        </template>
      </ProTable>
    </div>

    <!-- 新增 / 编辑 -->
    <ProDialog
      v-model="crud.visible.value"
      :title="`${crud.title.value} · ${t('menu.crudDemo')}`"
      width="820px"
      :loading="crud.submitting.value"
      @confirm="onSubmit"
    >
      <ProForm
        ref="proFormRef"
        :model-value="crud.formData"
        :schemas="formSchemas"
        label-width="100px"
        @update:model-value="onFormChange"
      >
        <template #description="{ model }">
          <MarkdownEditor v-model="model.description" height="320px" />
        </template>
      </ProForm>
    </ProDialog>

    <!-- 详情 -->
    <ProDialog v-model="detailVisible" :title="`${t('common.detail')} · ${t('menu.crudDemo')}`" width="720px" :show-footer="false">
      <el-descriptions :column="2" border>
        <el-descriptions-item label="商品名称">{{ detail.name }}</el-descriptions-item>
        <el-descriptions-item label="商品分类">
          <DictTag dict-type="demo_category" :value="detail.category" />
        </el-descriptions-item>
        <el-descriptions-item label="价格">¥{{ toThousands(Number(detail.price ?? 0)) }}</el-descriptions-item>
        <el-descriptions-item label="库存">{{ detail.stock }}</el-descriptions-item>
        <el-descriptions-item :label="t('common.status')">
          <DictTag dict-type="sys_normal_disable" :value="detail.status" />
        </el-descriptions-item>
        <el-descriptions-item :label="t('common.createTime')">{{ detail.createTime }}</el-descriptions-item>
        <el-descriptions-item label="标签" :span="2">
          <el-tag v-for="tag in detail.tags ?? []" :key="tag" size="small" effect="plain" class="wb-demo-crud__tag">
            {{ tag }}
          </el-tag>
          <span v-if="!detail.tags?.length" class="wb-text-muted">-</span>
        </el-descriptions-item>
        <el-descriptions-item label="封面图" :span="2">
          <el-image v-if="detail.cover" :src="detail.cover" :preview-src-list="[detail.cover]" fit="cover" class="wb-demo-crud__cover" />
          <span v-else class="wb-text-muted">-</span>
        </el-descriptions-item>
        <el-descriptions-item :label="t('common.remark')" :span="2">{{ detail.remark || '-' }}</el-descriptions-item>
      </el-descriptions>
    </ProDialog>

    <!-- 导入预览 -->
    <ProDialog v-model="importVisible" :title="`${t('common.import')}预览`" width="720px" :show-footer="false">
      <el-alert type="warning" :closable="false" show-icon title="此处仅做解析预览，真实落库请对接后端批量导入接口" class="wb-mb12" />
      <el-table :data="importRows" border stripe size="small">
        <el-table-column type="index" label="#" width="56" align="center" />
        <el-table-column v-for="key in importColumns" :key="key" :prop="key" :label="key" min-width="120" show-overflow-tooltip />
      </el-table>
    </ProDialog>
  </div>
</template>

<style scoped lang="scss">
.wb-demo-crud {
  &__tip {
    font-size: 13px;
    line-height: 1.8;
  }

  &__price {
    color: var(--el-color-danger);
    font-weight: 600;
  }

  &__low {
    color: var(--el-color-warning);
    font-weight: 600;
  }

  &__tag {
    margin-right: 4px;
  }

  &__cover {
    width: 120px;
    height: 80px;
    border-radius: 6px;
    display: block;
  }
}
</style>
