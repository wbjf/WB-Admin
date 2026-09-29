<script setup lang="ts">
defineOptions({ name: 'ToolGen' })

import { computed, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Download, MagicStick, View } from '@element-plus/icons-vue'
import type { FormSchema } from '@/components/ProForm/types'
import SearchForm from '@/components/SearchForm/index.vue'
import ProTable from '@/components/ProTable/index.vue'
import ProDialog from '@/components/ProDialog.vue'
import type { TableColumn } from '@/components/ProTable/types'
import { genApi } from '@/api/tool'
import { download } from '@/utils/download'
import { useI18n } from 'vue-i18n'

interface GenTableRow {
  tableId: string
  tableName: string
  tableComment: string
  createTime: string
}

const { t } = useI18n()

/** ---------- 查询条件 ---------- */
const queryParams = reactive<{ tableName?: string }>({})

const searchSchemas = computed<FormSchema[]>(() => [
  {
    prop: 'tableName',
    label: t('tool.generator.tableName'),
    type: 'input',
    placeholder: `请输入${t('tool.generator.tableName')}关键字`
  }
])

/** ---------- 表格 ---------- */
const tableRef = ref<any>(null)
const selected = ref<GenTableRow[]>([])

const columns = ref<TableColumn[]>([
  { label: t('tool.generator.tableName'), prop: 'tableName', minWidth: 200, sortable: false },
  { label: t('tool.generator.remark'), prop: 'tableComment', minWidth: 220, sortable: false },
  { label: t('common.createTime'), prop: 'createTime', minWidth: 170, sortable: false },
  {
    label: t('common.operate'),
    prop: 'operation',
    slot: 'operation',
    width: 260,
    fixed: 'right',
    sortable: false
  }
])

async function request(params: Record<string, any>): Promise<{ list: GenTableRow[]; total: number }> {
  const res = await genApi.tables({
    tableName: queryParams.tableName,
    pageNum: params.pageNum,
    pageSize: params.pageSize
  })
  return { list: (res?.list ?? []) as GenTableRow[], total: res?.total ?? 0 }
}

function onSelectionChange(rows: GenTableRow[]): void {
  selected.value = rows
}

function reload(): void {
  tableRef.value?.reload()
}

/** ---------- 代码预览 ---------- */
const previewVisible = ref(false)
const previewTitle = ref('')
const activeFileName = ref('')
const previewFiles = ref<{ name: string; code: string }[]>([])

async function openPreview(row: GenTableRow): Promise<void> {
  try {
    const res = await genApi.preview(row.tableId)
    const entries = Object.entries(res ?? {})
    previewFiles.value = entries.map(([name, code]) => ({ name, code: String(code ?? '') }))
    activeFileName.value = previewFiles.value[0]?.name ?? ''
    previewTitle.value = `${t('tool.generator.preview')} · ${row.tableName}`
    if (!previewFiles.value.length) {
      ElMessage.warning(t('common.noData'))
      return
    }
    previewVisible.value = true
  } catch (e: any) {
    ElMessage.error(e?.message || t('common.failed'))
  }
}

async function copyCode(code: string): Promise<void> {
  try {
    if (!navigator.clipboard) {
      ElMessage.error(t('common.failed'))
      return
    }
    await navigator.clipboard.writeText(code)
    ElMessage.success(t('common.copied'))
  } catch {
    ElMessage.error(t('common.failed'))
  }
}

/** ---------- 生成代码 ---------- */
async function generate(row: GenTableRow): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `确认生成「${row.tableName}」的前后端代码吗？生成后将覆盖同名文件。`,
      t('common.tip'),
      { confirmButtonText: t('common.confirm'), cancelButtonText: t('common.cancel'), type: 'warning' }
    )
  } catch {
    return
  }
  try {
    await genApi.generate({ tableId: row.tableId })
    ElMessage.success(t('common.success'))
  } catch (e: any) {
    ElMessage.error(e?.message || t('common.failed'))
  }
}

/** ---------- 下载源码 ---------- */
async function downloadZip(tables: string[]): Promise<void> {
  if (!tables.length) {
    ElMessage.warning(t('common.selectAtLeastOne'))
    return
  }
  try {
    await download('/tool/gen/download/batch', {
      method: 'post',
      data: tables as any,
      filename: 'wb-gen'
    })
  } catch {
    ElMessage.error(t('common.downloadFailed'))
  }
}
</script>

<template>
  <div class="wb-page wb-tool-gen">
    <SearchForm v-model="queryParams" :schemas="searchSchemas" @search="reload()" />

    <div class="wb-card">
      <ProTable
        ref="tableRef"
        row-key="tableId"
        :columns="columns"
        :request="request"
        :selection="true"
        export-name="wb-gen-tables"
        print-title="数据表列表"
        @selection-change="onSelectionChange"
      >
        <template #toolbar-left>
          <el-button v-hasPermi="['tool:gen:code']" :icon="Download" plain :disabled="!selected.length" @click="downloadZip(selected.map((r) => r.tableName))">
            {{ t('tool.generator.downloadZip') }}
          </el-button>
        </template>

        <template #operation="{ row }">
          <el-button v-hasPermi="['tool:gen:list']" link type="primary" @click="openPreview(row as GenTableRow)">
            <el-icon><View /></el-icon>{{ t('tool.generator.preview') }}
          </el-button>
          <el-button v-hasPermi="['tool:gen:code']" link type="warning" @click="generate(row as GenTableRow)">
            <el-icon><MagicStick /></el-icon>{{ t('tool.generator.generate') }}
          </el-button>
          <el-button v-hasPermi="['tool:gen:code']" link type="primary" @click="downloadZip([(row as GenTableRow).tableName])">
            {{ t('common.download') }}
          </el-button>
        </template>
      </ProTable>
    </div>

    <ProDialog v-model="previewVisible" :title="previewTitle" width="900px" :show-footer="false">
      <el-tabs v-model="activeFileName" type="card" class="wb-tool-gen__tabs">
        <el-tab-pane v-for="item in previewFiles" :key="item.name" :label="item.name" :name="item.name">
          <div class="wb-tool-gen__bar">
            <span class="wb-text-muted">{{ item.name }} · {{ item.code.split('\n').length }} 行</span>
            <el-button link type="primary" @click="copyCode(item.code)">复制代码</el-button>
          </div>
          <el-scrollbar max-height="420px">
            <pre class="wb-tool-gen__pre">{{ item.code }}</pre>
          </el-scrollbar>
        </el-tab-pane>
      </el-tabs>
    </ProDialog>
  </div>
</template>

<style scoped lang="scss">
.wb-tool-gen {
  &__tabs {
    :deep(.el-tabs__content) {
      overflow: visible;
    }
  }

  &__bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    font-size: 12px;
    margin-bottom: 6px;
  }

  &__pre {
    margin: 0;
    padding: 12px;
    border-radius: 6px;
    background: #1f2430;
    color: #e6e6e6;
    font-size: 12px;
    line-height: 1.7;
    font-family: Consolas, Monaco, 'Courier New', monospace;
    white-space: pre;
    word-break: break-all;
  }
}
</style>
