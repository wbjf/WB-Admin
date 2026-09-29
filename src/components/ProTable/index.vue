<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Refresh } from '@element-plus/icons-vue'
import ColumnSetting from './ColumnSetting.vue'
import type { TableColumn, ProTableRequest } from './types'
import { exportExcel, type ExcelColumn } from '@/utils/excel'
import { printElement } from '@/utils/print'
import { useI18n } from 'vue-i18n'

defineOptions({ name: 'ProTable' })

const props = withDefaults(
  defineProps<{
    /** 列配置 */
    columns: TableColumn[]
    /** 数据请求方法，传入内部组装好的分页参数 */
    request?: ProTableRequest
    /** 静态数据（不传 request 时使用） */
    data?: any[]
    /** 额外的查询参数 */
    params?: Record<string, any>
    /** 行 key */
    rowKey?: string
    /** 是否显示多选框 */
    selection?: boolean
    /** 是否显示序号 */
    showIndex?: boolean
    /** 是否显示分页 */
    pagination?: boolean
    /** 默认页大小 */
    defaultPageSize?: number
    /** 表格高度自适应 */
    height?: string | number
    /** 是否显示工具栏 */
    showToolbar?: boolean
    /** 是否显示刷新按钮 */
    showRefresh?: boolean
    /** 是否列斑马纹 */
    stripe?: boolean
    /** 边框 */
    border?: boolean
    /** 是否默认展开全部（树表） */
    expandAll?: boolean
    /** 树形子字段 */
    childrenField?: string
    /** 行内多选 disabled 判定 */
    selectable?: (row: any, index: number) => boolean
    /** 导出文件名 */
    exportName?: string
    /** 打印区域标题 */
    printTitle?: string
  }>(),
  {
    rowKey: 'id',
    pagination: true,
    defaultPageSize: 10,
    showToolbar: true,
    showRefresh: true,
    stripe: true,
    border: true,
    expandAll: false,
    selection: false,
    showIndex: true
  }
)

const emit = defineEmits<{
  (e: 'selection-change', rows: any[]): void
  (e: 'row-click', row: any): void
  (e: 'loaded', rows: any[]): void
}>()

const { t } = useI18n()

const tableData = ref<any[]>([])
const total = ref(0)
const loading = ref(false)
const pageNum = ref(1)
const pageSize = ref(props.defaultPageSize)
const sortProp = ref('')
const sortOrder = ref<'ascending' | 'descending' | ''>('')
const selectedRows = ref<any[]>([])
const columnSettingVisible = ref(false)
const tableRef = ref()
const wrapRef = ref<HTMLElement>()

/** 可见列（过滤 hidden，保持原数组以便列设置原地修改） */
const visibleColumns = computed(() => props.columns.filter((c) => !c.hidden))

const pageParams = computed(() => ({
  pageNum: pageNum.value,
  pageSize: pageSize.value,
  orderByColumn: sortProp.value,
  isAsc: sortOrder.value === 'ascending' ? 'asc' : 'desc'
}))

async function fetchData(): Promise<void> {
  if (!props.request) {
    tableData.value = props.data ?? []
    total.value = tableData.value.length
    emit('loaded', tableData.value)
    return
  }
  loading.value = true
  try {
    const res = await props.request({ ...props.params, ...pageParams.value })
    tableData.value = res?.list ?? []
    total.value = res?.total ?? 0
    emit('loaded', tableData.value)
  } catch {
    tableData.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

/** 保留当前页刷新 */
function refresh(): void {
  fetchData()
}

/** 重置到第一页刷新 */
function reload(): void {
  pageNum.value = 1
  fetchData()
}

function setData(rows: any[]): void {
  tableData.value = rows
}

function getData(): any[] {
  return tableData.value
}

function onSelectionChange(rows: any[]): void {
  selectedRows.value = rows
  emit('selection-change', rows)
}

function clearSelection(): void {
  tableRef.value?.clearSelection()
  selectedRows.value = []
}

function onSortChange(data: any): void {
  sortProp.value = data?.prop ?? ''
  sortOrder.value = data?.order ?? ''
  reload()
}

function onSizeChange(size: number): void {
  pageSize.value = size
  reload()
}

function onCurrentChange(page: number): void {
  pageNum.value = page
  fetchData()
}

function onColumnChange(next: TableColumn[]): void {
  props.columns.splice(0, props.columns.length, ...next)
}

/** 导出：默认导出当前结果集；业务需要走后端导出时可用 toolbar 自定义 */
function handleExport(): void {
  const cols: ExcelColumn[] = visibleColumns.value.map((c) => ({ label: c.label, prop: c.prop }))
  exportExcel(cols, tableData.value, props.exportName || 'export')
}

function handlePrint(): void {
  printElement(wrapRef.value!, { header: props.printTitle })
}

watch(
  () => props.params,
  () => reload(),
  { deep: true }
)

watch(
  () => props.data,
  (val) => {
    if (!props.request && val) {
      tableData.value = val
      total.value = val.length
    }
  },
  { deep: true }
)

onMounted(() => {
  fetchData()
})

defineExpose({ refresh, reload, setData, getData, clearSelection, getSelection: () => selectedRows.value })
</script>

<template>
  <div ref="wrapRef" class="wb-pro-table">
    <div v-if="showToolbar" class="wb-toolbar">
      <div class="wb-toolbar__left">
        <slot name="toolbar-left" />
        <slot name="toolbar" />
      </div>
      <div class="wb-toolbar__right">
        <slot name="toolbar-right" />
        <el-tooltip v-if="showRefresh" :content="t('common.refresh')" placement="top">
          <el-button circle plain size="small" @click="refresh"><el-icon><Refresh /></el-icon></el-button>
        </el-tooltip>
        <el-tooltip v-if="exportName" :content="t('common.export')" placement="top">
          <el-button circle plain size="small" @click="handleExport()">
            <el-icon><Download /></el-icon>
          </el-button>
        </el-tooltip>
        <el-tooltip v-if="printTitle" :content="t('common.print')" placement="top">
          <el-button circle plain size="small" @click="handlePrint">
            <el-icon><Printer /></el-icon>
          </el-button>
        </el-tooltip>
        <ColumnSetting
          v-model:visible="columnSettingVisible"
          :columns="columns"
          @change="onColumnChange"
        />
        <slot name="toolbar-extra" />
      </div>
    </div>

    <el-table
      ref="tableRef"
      v-loading="loading"
      :data="tableData"
      :row-key="rowKey"
      :stripe="stripe"
      :border="border"
      :height="height"
      :default-expand-all="expandAll"
      :tree-props="childrenField ? { children: childrenField } : undefined"
      @selection-change="onSelectionChange"
      @row-click="(row: any) => emit('row-click', row)"
      @sort-change="onSortChange"
      @refresh="refresh"
    >
      <el-table-column v-if="selection" type="selection" width="46" :reserve-selection="true" />
      <el-table-column v-if="showIndex" type="index" width="56" label="#" align="center" />

      <template v-for="col in visibleColumns" :key="col.prop">
        <el-table-column v-if="col.children?.length" :label="col.label" :align="col.align">
          <el-table-column
            v-for="child in col.children"
            :key="child.prop"
            :prop="child.prop"
            :label="child.label"
            :width="child.width"
            :min-width="child.minWidth"
            :align="child.align"
            :formatter="child.formatter as any"
          >
            <template v-if="$slots[child.slot || child.prop]" #default="scope">
              <slot :name="child.slot || child.prop" v-bind="scope" />
            </template>
          </el-table-column>
        </el-table-column>

        <el-table-column
          v-else
          :prop="col.prop"
          :label="col.label"
          :width="col.width"
          :min-width="col.minWidth"
          :align="col.align"
          :fixed="col.fixed"
          :sortable="col.sortable ?? true"
          :show-overflow-tooltip="col.tooltip ?? true"
          :formatter="col.formatter as any"
        >
          <template v-if="$slots[col.slot || col.prop]" #default="scope">
            <slot :name="col.slot || col.prop" v-bind="scope" />
          </template>
        </el-table-column>
      </template>

      <template #empty>
        <el-empty :description="t('common.noData')" :image-size="90" />
      </template>
    </el-table>

    <div v-if="pagination" class="wb-pro-table__footer">
      <span class="wb-text-muted">{{ t('common.total', { total }) }}</span>
      <el-pagination
        v-model:current-page="pageNum"
        v-model:page-size="pageSize"
        :page-sizes="[10, 20, 30, 50, 100]"
        :total="total"
        layout="sizes, prev, pager, next, jumper"
        background
        @size-change="onSizeChange"
        @current-change="onCurrentChange"
      />
    </div>

    <slot name="footer" />
  </div>
</template>

<style scoped lang="scss">
.wb-pro-table {
  &__footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--wb-gap, 12px);
    margin-top: var(--wb-gap, 12px);
    flex-wrap: wrap;
    /* 分页固定，不参与剩余高度分配 */
    flex: none;
  }
}
</style>
