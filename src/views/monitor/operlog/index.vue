<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, Document, Download } from '@element-plus/icons-vue'
import type { FormSchema } from '@/components/ProForm/types'
import SearchForm from '@/components/SearchForm/index.vue'
import ProTable from '@/components/ProTable/index.vue'
import ProDialog from '@/components/ProDialog.vue'
import type { TableColumn } from '@/components/ProTable/types'
import { operlogApi } from '@/api/monitor'
import { addDateRange } from '@/utils'
import { exportExcel } from '@/utils/excel'
import { useI18n } from 'vue-i18n'
import type { OperLog } from '@/types'

defineOptions({ name: 'MonitorOperlog' })

const { t } = useI18n()

/** ---------- 查询条件 ---------- */
const queryParams = reactive<Record<string, any> & { dateRange?: [string, string] }>({})

const searchSchemas = computed<FormSchema[]>(() => [
  { prop: 'title', label: t('monitor.operlog.module'), type: 'input' },
  { prop: 'operName', label: t('monitor.operlog.operator'), type: 'input' },
  {
    prop: 'status',
    label: t('common.status'),
    type: 'select',
    options: [
      { label: t('monitor.loginlog.success'), value: '0' },
      { label: t('monitor.loginlog.fail'), value: '1' }
    ]
  },
  { prop: 'dateRange', label: t('common.dateRange'), type: 'daterange' }
])

/** ---------- 表格 ---------- */
const tableRef = ref<any>(null)
const selected = ref<OperLog[]>([])

const columns = ref<TableColumn[]>([
  { label: '日志编号', prop: 'operId', width: 100, sortable: false },
  { label: t('monitor.operlog.module'), prop: 'title', minWidth: 130, sortable: false },
  { label: t('monitor.operlog.type'), prop: 'businessType', slot: 'businessType', width: 110, sortable: false },
  { label: t('monitor.operlog.operator'), prop: 'operName', minWidth: 120, sortable: false },
  { label: '操作地址', prop: 'operIp', minWidth: 130, sortable: false },
  { label: t('monitor.operlog.time'), prop: 'operTime', minWidth: 170 },
  { label: t('monitor.operlog.cost'), prop: 'costTime', slot: 'costTime', width: 110, sortable: false },
  { label: t('common.status'), prop: 'status', slot: 'status', width: 100, sortable: false },
  {
    label: t('common.operate'),
    prop: 'operation',
    slot: 'operation',
    width: 150,
    fixed: 'right',
    sortable: false
  }
])

/** 操作类型：0其它 1新增 2修改 3删除 4导出 5导入 6强退 */
const businessTypeMap: Record<string, { label: string; type: 'info' | 'success' | 'warning' | 'danger' | 'primary' }> = {
  '0': { label: '其它', type: 'info' },
  '1': { label: '新增', type: 'success' },
  '2': { label: '修改', type: 'primary' },
  '3': { label: '删除', type: 'danger' },
  '4': { label: '导出', type: 'warning' },
  '5': { label: '导入', type: 'warning' },
  '6': { label: '强退', type: 'danger' }
}

function businessTypeMeta(value: any): { label: string; type: 'info' | 'success' | 'warning' | 'danger' | 'primary' } {
  return businessTypeMap[String(value ?? '')] ?? { label: '其它', type: 'info' }
}

async function request(params: Record<string, any>): Promise<{ list: OperLog[]; total: number }> {
  const { dateRange, ...rest } = queryParams
  const finalParams = addDateRange(rest, dateRange ? ([dateRange[0], dateRange[1]] as [string, string]) : undefined)
  const res = await operlogApi.list({ ...finalParams, ...params })
  return { list: res?.list ?? [], total: res?.total ?? 0 }
}

function onSelectionChange(rows: OperLog[]): void {
  selected.value = rows
}

/** ---------- 删除 / 清空 ---------- */
async function remove(ids?: string): Promise<void> {
  const targets = ids ?? selected.value.map((r) => r.operId).join(',')
  if (!targets) {
    ElMessage.warning(t('common.selectAtLeastOne'))
    return
  }
  try {
    await ElMessageBox.confirm(t('common.confirmDelete'), t('common.tip'), {
      confirmButtonText: t('common.confirm'),
      cancelButtonText: t('common.cancel'),
      type: 'warning'
    })
  } catch {
    return
  }
  try {
    await operlogApi.remove(targets.split(','))
    ElMessage.success(t('common.success'))
    tableRef.value?.reload()
  } catch (e: any) {
    ElMessage.error(e?.message || t('common.failed'))
  }
}

async function clean(): Promise<void> {
  try {
    await ElMessageBox.confirm('确认清空全部操作日志吗？清空后不可恢复。', t('common.tip'), {
      confirmButtonText: t('common.confirm'),
      cancelButtonText: t('common.cancel'),
      type: 'warning'
    })
  } catch {
    return
  }
  try {
    await operlogApi.clean()
    ElMessage.success(t('common.success'))
    tableRef.value?.reload()
  } catch (e: any) {
    ElMessage.error(e?.message || t('common.failed'))
  }
}

/** ---------- 详情 ---------- */
const detailVisible = ref(false)
const detail = ref<Partial<OperLog>>({})

async function openDetail(row: Record<string, any>): Promise<void> {
  const current = row as OperLog
  try {
    const res = await operlogApi.detail(current.operId)
    detail.value = { ...current, ...(res ?? {}) }
  } catch (e: any) {
    detail.value = { ...current }
    ElMessage.error(e?.message || t('common.failed'))
  }
  detailVisible.value = true
}

/** ---------- 导出（当前结果集） ---------- */
function exportData(): void {
  try {
    const rows: OperLog[] = tableRef.value?.getData?.() ?? []
    if (!rows.length) {
      ElMessage.warning(t('common.noData'))
      return
    }
    const cols = columns.value
      .filter((c) => c.prop !== 'operation')
      .map((c) => ({ label: c.label, prop: c.prop, width: 20 }))
    exportExcel(cols, rows, 'operlog', t('menu.operlog'))
    ElMessage.success(t('common.success'))
  } catch {
    ElMessage.error(t('common.failed'))
  }
}
</script>

<template>
  <div class="wb-page wb-monitor-operlog">
    <SearchForm v-model="queryParams" :schemas="searchSchemas" @search="tableRef?.reload()" />

    <div class="wb-card">
      <ProTable
        ref="tableRef"
        row-key="operId"
        :columns="columns"
        :request="request"
        :selection="true"
        print-title="操作日志列表"
        @selection-change="onSelectionChange"
      >
        <template #toolbar-left>
          <el-button v-hasPermi="['monitor:operlog:remove']" plain :disabled="!selected.length" @click="remove()">
            <el-icon><Delete /></el-icon>{{ t('common.delete') }}
          </el-button>
          <el-button v-hasPermi="['monitor:operlog:remove']" plain @click="clean">
            <el-icon><Delete /></el-icon>清空
          </el-button>
          <el-button v-hasPermi="['monitor:operlog:list']" plain @click="exportData">
            <el-icon><Download /></el-icon>{{ t('common.export') }}
          </el-button>
        </template>

        <template #businessType="{ row }">
          <el-tag :type="businessTypeMeta(row.businessType).type" size="small" disable-transitions>
            {{ businessTypeMeta(row.businessType).label }}
          </el-tag>
        </template>

        <template #costTime="{ row }">
          <span>{{ row.costTime }} ms</span>
        </template>

        <template #status="{ row }">
          <el-tag :type="row.status === '0' ? 'success' : 'danger'" size="small" disable-transitions>
            {{ row.status === '0' ? t('monitor.loginlog.success') : t('monitor.loginlog.fail') }}
          </el-tag>
        </template>

        <template #operation="{ row }">
          <el-button v-hasPermi="['monitor:operlog:list']" link type="primary" @click="openDetail(row)">
            <el-icon><Document /></el-icon>{{ t('common.detail') }}
          </el-button>
          <el-button v-hasPermi="['monitor:operlog:remove']" link type="danger" @click="remove(row.operId)">
            {{ t('common.delete') }}
          </el-button>
        </template>
      </ProTable>
    </div>

    <ProDialog
      v-model="detailVisible"
      :title="`${t('common.detail')} - ${t('menu.operlog')}`"
      width="760px"
      :show-footer="false"
    >
      <el-descriptions :column="2" border>
        <el-descriptions-item :label="t('monitor.operlog.module')">{{ detail.title }}</el-descriptions-item>
        <el-descriptions-item :label="t('monitor.operlog.type')">
          {{ businessTypeMeta(detail.businessType).label }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('monitor.operlog.operator')">{{ detail.operName }}</el-descriptions-item>
        <el-descriptions-item :label="t('common.status')">
          <el-tag :type="detail.status === '0' ? 'success' : 'danger'" size="small" disable-transitions>
            {{ detail.status === '0' ? t('monitor.loginlog.success') : t('monitor.loginlog.fail') }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="操作地址">{{ detail.operIp }}</el-descriptions-item>
        <el-descriptions-item :label="t('monitor.operlog.time')">{{ detail.operTime }}</el-descriptions-item>
        <el-descriptions-item :label="t('monitor.operlog.cost')">{{ detail.costTime }} ms</el-descriptions-item>
        <el-descriptions-item :label="t('monitor.operlog.method')">{{ detail.requestMethod }}</el-descriptions-item>
        <el-descriptions-item :label="t('monitor.operlog.url')" :span="2">{{ detail.operUrl }}</el-descriptions-item>
        <el-descriptions-item :label="t('monitor.operlog.param')" :span="2">
          <div class="wb-monitor-operlog__pre">{{ detail.operParam || '-' }}</div>
        </el-descriptions-item>
        <el-descriptions-item :label="t('monitor.operlog.error')" :span="2">
          <div class="wb-monitor-operlog__pre wb-monitor-operlog__pre--error">{{ detail.errorMsg || '-' }}</div>
        </el-descriptions-item>
      </el-descriptions>
    </ProDialog>
  </div>
</template>

<style scoped lang="scss">
.wb-monitor-operlog {
  &__pre {
    max-height: 180px;
    overflow: auto;
    white-space: pre-wrap;
    word-break: break-all;
    font-size: 12px;
    line-height: 1.6;
  }

  &__pre--error {
    color: var(--el-color-danger);
  }
}
</style>
