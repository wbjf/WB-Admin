<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Edit } from '@element-plus/icons-vue'
import type { FormSchema } from '@/components/ProForm/types'
import SearchForm from '@/components/SearchForm/index.vue'
import ProTable from '@/components/ProTable/index.vue'
import ProDialog from '@/components/ProDialog.vue'
import type { TableColumn } from '@/components/ProTable/types'
import { configApi } from '@/api/dept'
import { download } from '@/utils/download'
import { hasPermi } from '@/utils/permission'
import { useI18n } from 'vue-i18n'

defineOptions({ name: 'SystemConfig' })

const { t } = useI18n()

/** ---------- 查询条件 ---------- */
const queryParams = reactive<{ configName?: string; configKey?: string; configType?: string }>({})

const searchSchemas = computed<FormSchema[]>(() => [
  { prop: 'configName', label: t('config.name'), type: 'input' },
  { prop: 'configKey', label: t('config.key'), type: 'input' },
  {
    prop: 'configType',
    label: t('config.system'),
    type: 'select',
    options: [
      { label: t('common.yes'), value: 'Y' },
      { label: t('common.no'), value: 'N' }
    ]
  }
])

/** ---------- 表格 ---------- */
const tableRef = ref<any>(null)
const selected = ref<any[]>([])

const columns = ref<TableColumn[]>([
  { label: '参数编号', prop: 'configId', width: 100, sortable: false },
  { label: t('config.name'), prop: 'configName', minWidth: 160, sortable: false },
  { label: t('config.key'), prop: 'configKey', minWidth: 180, sortable: false },
  { label: t('config.value'), prop: 'configValue', minWidth: 160, sortable: false },
  { label: t('config.system'), prop: 'configType', slot: 'configType', width: 100, sortable: false },
  { label: t('common.remark'), prop: 'remark', minWidth: 160, sortable: false },
  { label: t('common.createTime'), prop: 'createTime', minWidth: 170, sortable: false },
  {
    label: t('common.operate'),
    prop: 'operation',
    slot: 'operation',
    width: 160,
    fixed: 'right',
    sortable: false
  }
])

async function request(params: Record<string, any>): Promise<{ list: any[]; total: number }> {
  const res: unknown = await configApi.list({ ...queryParams, ...params })
  if (Array.isArray(res)) return { list: res as any[], total: (res as any[]).length }
  const page = (res ?? {}) as { list?: any[]; total?: number }
  return { list: page.list ?? [], total: page.total ?? page.list?.length ?? 0 }
}

function onSelectionChange(rows: any[]): void {
  selected.value = rows
}

/** ---------- 表单 ---------- */
const formVisible = ref(false)
const formTitle = ref('')
const submitting = ref(false)
const currentId = ref('')
const form = reactive<Record<string, any>>({})

async function openAdd(): Promise<void> {
  currentId.value = ''
  Object.assign(form, { configName: '', configKey: '', configValue: '', configType: 'N', remark: '' })
  formTitle.value = `${t('common.add')}${t('menu.config')}`
  formVisible.value = true
}

async function openEdit(row: any): Promise<void> {
  currentId.value = row.configId
  const detail = await configApi.detail(row.configId)
  Object.assign(form, detail)
  formTitle.value = `${t('common.edit')}${t('menu.config')}`
  formVisible.value = true
}

async function submitForm(): Promise<void> {
  submitting.value = true
  try {
    if (currentId.value) {
      await configApi.update({ ...form, configId: currentId.value })
    } else {
      await configApi.add(form)
    }
    ElMessage.success(t('common.success'))
    formVisible.value = false
    tableRef.value?.reload()
  } catch (e: any) {
    ElMessage.error(e?.message || t('common.failed'))
  } finally {
    submitting.value = false
  }
}

/** ---------- 操作 ---------- */
async function remove(ids?: string): Promise<void> {
  const targets = ids ?? selected.value.map((r) => r.configId).join(',')
  if (!targets) {
    ElMessage.warning(t('common.selectAtLeastOne'))
    return
  }
  try {
    await ElMessageBox.confirm(t('common.confirmDelete'), t('common.tip'), { type: 'warning' })
  } catch {
    return
  }
  try {
    await configApi.remove(targets.split(','))
    ElMessage.success(t('common.success'))
    tableRef.value?.reload()
  } catch (e: any) {
    ElMessage.error(e?.message || t('common.failed'))
  }
}

async function exportData(): Promise<void> {
  await download('/system/config/export', { method: 'post', data: { ...queryParams }, filename: 'config' })
}

async function refreshCache(): Promise<void> {
  try {
    await configApi.refreshCache()
    ElMessage.success(t('config.cacheCleared'))
    tableRef.value?.refresh()
  } catch (e: any) {
    ElMessage.error(e?.message || t('common.failed'))
  }
}
</script>

<template>
  <div class="wb-page wb-config">
    <SearchForm v-model="queryParams" :schemas="searchSchemas" @search="tableRef?.reload()" />

    <div class="wb-card">
      <ProTable
        ref="tableRef"
        row-key="configId"
        :columns="columns"
        :request="request"
        :selection="true"
        export-name="config"
        print-title="参数列表"
        @selection-change="onSelectionChange"
      >
        <template #toolbar-left>
          <el-button v-hasPermi="['system:config:add']" type="primary" @click="openAdd">
            + {{ t('common.add') }}
          </el-button>
          <el-button v-hasPermi="['system:config:remove']" plain :disabled="!selected.length" @click="remove()">
            {{ t('common.delete') }}
          </el-button>
          <el-button plain @click="refreshCache">{{ t('common.refresh') }}</el-button>
        </template>

        <template #toolbar-right>
          <el-button v-hasPermi="['system:config:export']" plain @click="exportData">
            {{ t('common.export') }}
          </el-button>
        </template>

        <template #configType="{ row }">
          <el-tag :type="row.configType === 'Y' ? 'success' : 'info'" disable-transitions>
            {{ row.configType === 'Y' ? t('common.yes') : t('common.no') }}
          </el-tag>
        </template>

        <template #operation="{ row }">
          <el-button v-hasPermi="['system:config:edit']" link type="primary" @click="openEdit(row)">
            <el-icon><Edit /></el-icon>{{ t('common.edit') }}
          </el-button>
          <el-button v-hasPermi="['system:config:remove']" link type="danger" @click="remove(row.configId)">
            {{ t('common.delete') }}
          </el-button>
        </template>
      </ProTable>
    </div>

    <ProDialog v-model="formVisible" :title="formTitle" width="600px" :loading="submitting" @confirm="submitForm">
      <el-form :model="form" label-width="90px">
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item :label="t('config.name')" prop="configName">
              <el-input v-model="form.configName" clearable />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('config.key')" prop="configKey">
              <el-input v-model="form.configKey" clearable />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item :label="t('config.value')" prop="configValue">
              <el-input v-model="form.configValue" clearable />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item :label="t('config.system')" prop="configType">
              <el-radio-group v-model="form.configType">
                <el-radio value="Y">{{ t('common.yes') }}</el-radio>
                <el-radio value="N">{{ t('common.no') }}</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item :label="t('common.remark')" prop="remark">
              <el-input v-model="form.remark" type="textarea" :rows="3" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
    </ProDialog>
  </div>
</template>
