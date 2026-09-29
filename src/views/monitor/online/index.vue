<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, Download, Refresh } from '@element-plus/icons-vue'
import type { FormSchema } from '@/components/ProForm/types'
import SearchForm from '@/components/SearchForm/index.vue'
import ProTable from '@/components/ProTable/index.vue'
import type { TableColumn } from '@/components/ProTable/types'
import { onlineApi } from '@/api/monitor'
import { exportExcel } from '@/utils/excel'
import { useI18n } from 'vue-i18n'
import type { OnlineUser } from '@/types'

defineOptions({ name: 'MonitorOnline' })

const { t } = useI18n()

/** ---------- 查询条件 ---------- */
const queryParams = reactive<{ userName?: string; ipaddr?: string }>({})

const searchSchemas = computed<FormSchema[]>(() => [
  { prop: 'userName', label: t('monitor.online.user'), type: 'input' },
  { prop: 'ipaddr', label: t('monitor.online.ip'), type: 'input' }
])

/** ---------- 表格 ---------- */
const tableRef = ref<any>(null)

const columns = ref<TableColumn[]>([
  { label: t('monitor.online.session'), prop: 'tokenId', minWidth: 220, sortable: false },
  { label: t('monitor.online.user'), prop: 'userName', minWidth: 120 },
  { label: t('monitor.online.ip'), prop: 'ipaddr', minWidth: 130 },
  { label: t('monitor.online.location'), prop: 'loginLocation', minWidth: 120 },
  { label: t('monitor.online.browser'), prop: 'browser', minWidth: 120 },
  { label: t('monitor.online.os'), prop: 'os', minWidth: 120 },
  { label: t('monitor.online.time'), prop: 'loginTime', minWidth: 170 },
  {
    label: t('common.operate'),
    prop: 'operation',
    slot: 'operation',
    width: 120,
    fixed: 'right',
    sortable: false
  }
])

async function request(params: Record<string, any>): Promise<{ list: OnlineUser[]; total: number }> {
  const { userName, ipaddr } = queryParams
  const res = await onlineApi.list({ ...params, userName, ipaddr })
  return { list: res?.list ?? [], total: res?.total ?? 0 }
}

function refresh(): void {
  tableRef.value?.refresh()
}

/** ---------- 强制下线 ---------- */
async function kick(row: Record<string, any>): Promise<void> {
  const target = row as OnlineUser
  try {
    await ElMessageBox.confirm(`确认将「${target.userName}」强制下线吗？`, t('common.tip'), {
      confirmButtonText: t('common.confirm'),
      cancelButtonText: t('common.cancel'),
      type: 'warning'
    })
  } catch {
    return
  }
  try {
    await onlineApi.kick(target.tokenId)
    ElMessage.success(t('common.success'))
    refresh()
  } catch (e: any) {
    ElMessage.error(e?.message || t('common.failed'))
  }
}

/** ---------- 导出（当前结果集） ---------- */
function exportData(): void {
  try {
    const rows: OnlineUser[] = tableRef.value?.getData?.() ?? []
    if (!rows.length) {
      ElMessage.warning(t('common.noData'))
      return
    }
    const cols = columns.value
      .filter((c) => c.prop !== 'operation')
      .map((c) => ({ label: c.label, prop: c.prop, width: 20 }))
    exportExcel(cols, rows, 'online', t('menu.online'))
    ElMessage.success(t('common.success'))
  } catch {
    ElMessage.error(t('common.failed'))
  }
}
</script>

<template>
  <div class="wb-page wb-monitor-online">
    <SearchForm v-model="queryParams" :schemas="searchSchemas" @search="tableRef?.reload()" />

    <div class="wb-card">
      <ProTable
        ref="tableRef"
        row-key="tokenId"
        :columns="columns"
        :request="request"
        print-title="在线用户列表"
      >
        <template #toolbar-left>
          <el-button v-hasPermi="['monitor:online:list']" plain @click="refresh">
            <el-icon><Refresh /></el-icon>{{ t('common.refresh') }}
          </el-button>
          <el-button v-hasPermi="['monitor:online:list']" plain @click="exportData">
            <el-icon><Download /></el-icon>{{ t('common.export') }}
          </el-button>
        </template>

        <template #operation="{ row }">
          <el-button v-hasPermi="['monitor:online:kick']" link type="danger" @click="kick(row)">
            <el-icon><Delete /></el-icon>{{ t('monitor.online.kick') }}
          </el-button>
        </template>
      </ProTable>
    </div>
  </div>
</template>

<style scoped lang="scss">
.wb-monitor-online {
  :deep(.wb-pro-table) {
    margin-top: 0;
  }
}
</style>
