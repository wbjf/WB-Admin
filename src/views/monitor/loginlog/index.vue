<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, Download, Unlock } from '@element-plus/icons-vue'
import type { FormSchema } from '@/components/ProForm/types'
import SearchForm from '@/components/SearchForm/index.vue'
import ProTable from '@/components/ProTable/index.vue'
import type { TableColumn } from '@/components/ProTable/types'
import { loginlogApi } from '@/api/monitor'
import { addDateRange } from '@/utils'
import { exportExcel } from '@/utils/excel'
import { useI18n } from 'vue-i18n'
import type { LoginLog } from '@/types'

defineOptions({ name: 'MonitorLoginlog' })

const { t } = useI18n()

/** ---------- 查询条件 ---------- */
const queryParams = reactive<Record<string, any> & { dateRange?: [string, string] }>({})

const searchSchemas = computed<FormSchema[]>(() => [
  { prop: 'userName', label: t('monitor.loginlog.user'), type: 'input' },
  { prop: 'ipaddr', label: t('monitor.loginlog.ip'), type: 'input' },
  {
    prop: 'status',
    label: t('monitor.loginlog.result'),
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
const selected = ref<LoginLog[]>([])

const columns = ref<TableColumn[]>([
  { label: '访问编号', prop: 'infoId', width: 100, sortable: false },
  { label: t('monitor.loginlog.user'), prop: 'userName', minWidth: 130, sortable: false },
  { label: t('monitor.loginlog.ip'), prop: 'ipaddr', minWidth: 130, sortable: false },
  { label: t('monitor.loginlog.result'), prop: 'status', slot: 'status', width: 100, sortable: false },
  { label: '操作信息', prop: 'msg', minWidth: 160, sortable: false },
  { label: t('monitor.online.browser'), prop: 'browser', minWidth: 110, sortable: false },
  { label: t('monitor.online.os'), prop: 'os', minWidth: 120, sortable: false },
  { label: t('monitor.loginlog.time'), prop: 'accessTime', minWidth: 170 },
  {
    label: t('common.operate'),
    prop: 'operation',
    slot: 'operation',
    width: 110,
    fixed: 'right',
    sortable: false
  }
])

async function request(params: Record<string, any>): Promise<{ list: LoginLog[]; total: number }> {
  const { dateRange, ...rest } = queryParams
  const finalParams = addDateRange(rest, dateRange ? ([dateRange[0], dateRange[1]] as [string, string]) : undefined)
  const res = await loginlogApi.list({ ...finalParams, ...params })
  return { list: res?.list ?? [], total: res?.total ?? 0 }
}

function onSelectionChange(rows: LoginLog[]): void {
  selected.value = rows
}

function statusMeta(status: string): { label: string; type: 'success' | 'danger' } {
  return status === '0'
    ? { label: t('monitor.loginlog.success'), type: 'success' }
    : { label: t('monitor.loginlog.fail'), type: 'danger' }
}

/** ---------- 删除 / 清空 / 解锁 ---------- */
async function remove(ids?: string): Promise<void> {
  const targets = ids ?? selected.value.map((r) => r.infoId).join(',')
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
    await loginlogApi.remove(targets.split(','))
    ElMessage.success(t('common.success'))
    tableRef.value?.reload()
  } catch (e: any) {
    ElMessage.error(e?.message || t('common.failed'))
  }
}

async function clean(): Promise<void> {
  try {
    await ElMessageBox.confirm('确认清空全部登录日志吗？清空后不可恢复。', t('common.tip'), {
      confirmButtonText: t('common.confirm'),
      cancelButtonText: t('common.cancel'),
      type: 'warning'
    })
  } catch {
    return
  }
  try {
    await loginlogApi.clean()
    ElMessage.success(t('common.success'))
    tableRef.value?.reload()
  } catch (e: any) {
    ElMessage.error(e?.message || t('common.failed'))
  }
}

async function unlock(): Promise<void> {
  let userName = ''
  try {
    const res = await ElMessageBox.prompt('请输入需要解锁的登录名称', '解锁账号', {
      confirmButtonText: t('common.confirm'),
      cancelButtonText: t('common.cancel'),
      inputPattern: /\S+/,
      inputErrorMessage: '登录名称不能为空'
    })
    userName = res.value?.trim() ?? ''
  } catch {
    return
  }
  if (!userName) return
  try {
    await loginlogApi.unlock(userName)
    ElMessage.success(t('common.success'))
    tableRef.value?.reload()
  } catch (e: any) {
    ElMessage.error(e?.message || t('common.failed'))
  }
}

/** ---------- 导出（当前结果集） ---------- */
function exportData(): void {
  try {
    const rows: LoginLog[] = tableRef.value?.getData?.() ?? []
    if (!rows.length) {
      ElMessage.warning(t('common.noData'))
      return
    }
    const cols = columns.value
      .filter((c) => c.prop !== 'operation')
      .map((c) => ({ label: c.label, prop: c.prop, width: 20 }))
    exportExcel(cols, rows, 'loginlog', t('menu.loginlog'))
    ElMessage.success(t('common.success'))
  } catch {
    ElMessage.error(t('common.failed'))
  }
}
</script>

<template>
  <div class="wb-page wb-monitor-loginlog">
    <SearchForm v-model="queryParams" :schemas="searchSchemas" @search="tableRef?.reload()" />

    <div class="wb-card">
      <ProTable
        ref="tableRef"
        row-key="infoId"
        :columns="columns"
        :request="request"
        :selection="true"
        print-title="登录日志列表"
        @selection-change="onSelectionChange"
      >
        <template #toolbar-left>
          <el-button v-hasPermi="['monitor:loginlog:remove']" plain :disabled="!selected.length" @click="remove()">
            <el-icon><Delete /></el-icon>{{ t('common.delete') }}
          </el-button>
          <el-button v-hasPermi="['monitor:loginlog:remove']" plain @click="clean">
            <el-icon><Delete /></el-icon>清空
          </el-button>
          <el-button v-hasPermi="['monitor:loginlog:remove']" plain @click="unlock">
            <el-icon><Unlock /></el-icon>解锁账号
          </el-button>
          <el-button v-hasPermi="['monitor:loginlog:list']" plain @click="exportData">
            <el-icon><Download /></el-icon>{{ t('common.export') }}
          </el-button>
        </template>

        <template #status="{ row }">
          <el-tag :type="statusMeta(row.status).type" size="small" disable-transitions>
            {{ statusMeta(row.status).label }}
          </el-tag>
        </template>

        <template #operation="{ row }">
          <el-button v-hasPermi="['monitor:loginlog:remove']" link type="danger" @click="remove(row.infoId)">
            {{ t('common.delete') }}
          </el-button>
        </template>
      </ProTable>
    </div>
  </div>
</template>

<style scoped lang="scss">
.wb-monitor-loginlog {
  :deep(.wb-pro-table) {
    margin-top: 0;
  }
}
</style>
