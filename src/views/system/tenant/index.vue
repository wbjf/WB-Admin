<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Edit, Refresh } from '@element-plus/icons-vue'
import type { FormSchema } from '@/components/ProForm/types'
import SearchForm from '@/components/SearchForm/index.vue'
import ProTable from '@/components/ProTable/index.vue'
import ProDialog from '@/components/ProDialog.vue'
import type { TableColumn } from '@/components/ProTable/types'
import { tenantApi } from '@/api/tenant'
import { download } from '@/utils/download'
import { hasPermi } from '@/utils/permission'
import { useTenantStore } from '@/stores/modules/tenant'
import { useI18n } from 'vue-i18n'
import type { TenantInfo } from '@/types'

defineOptions({ name: 'SystemTenant' })

const { t } = useI18n()
const tenantStore = useTenantStore()

/** ---------- 查询条件 ---------- */
const queryParams = reactive<{ tenantName?: string; tenantCode?: string; status?: string }>({})

const searchSchemas = computed<FormSchema[]>(() => [
  { prop: 'tenantName', label: t('tenant.name'), type: 'input' },
  { prop: 'tenantCode', label: t('tenant.code'), type: 'input' },
  { prop: 'status', label: t('common.status'), type: 'dict', dictType: 'sys_normal_disable' }
])

/** ---------- 表格 ---------- */
const tableRef = ref<any>(null)
const selected = ref<TenantInfo[]>([])

const columns = ref<TableColumn[]>([
  { label: t('tenant.id'), prop: 'tenantId', width: 110, sortable: false },
  { label: t('tenant.name'), prop: 'tenantName', minWidth: 150, sortable: false },
  { label: t('tenant.code'), prop: 'tenantCode', minWidth: 130, sortable: false },
  { label: t('tenant.contact'), prop: 'contactUser', width: 120, sortable: false },
  { label: t('tenant.phone'), prop: 'contactPhone', width: 140, sortable: false },
  { label: t('common.status'), prop: 'status', slot: 'status', width: 90, sortable: false },
  { label: t('tenant.expire'), prop: 'expireTime', slot: 'expireTime', width: 140, sortable: false },
  { label: t('common.createTime'), prop: 'createTime', minWidth: 170, sortable: false },
  {
    label: t('common.operate'),
    prop: 'operation',
    slot: 'operation',
    width: 240,
    fixed: 'right',
    sortable: false
  }
])

async function request(params: Record<string, any>): Promise<{ list: TenantInfo[]; total: number }> {
  const res: unknown = await tenantApi.list({ ...queryParams, ...params })
  if (Array.isArray(res)) return { list: res as TenantInfo[], total: (res as TenantInfo[]).length }
  const page = (res ?? {}) as { list?: TenantInfo[]; total?: number }
  return { list: page.list ?? [], total: page.total ?? page.list?.length ?? 0 }
}

function onSelectionChange(rows: TenantInfo[]): void {
  selected.value = rows
}

/** 过期时间在表格里标红 */
function isExpired(expireTime?: string): boolean {
  if (!expireTime) return false
  return new Date(expireTime).getTime() < Date.now()
}

/** ---------- 表单 ---------- */
const formVisible = ref(false)
const formTitle = ref('')
const submitting = ref(false)
const currentId = ref('')
const form = reactive<Partial<TenantInfo>>({})

async function openAdd(): Promise<void> {
  currentId.value = ''
  Object.assign(form, {
    tenantName: '',
    tenantCode: '',
    contactUser: '',
    contactPhone: '',
    status: '0',
    expireTime: ''
  })
  formTitle.value = `${t('common.add')}${t('menu.tenant')}`
  formVisible.value = true
}

async function openEdit(row: TenantInfo): Promise<void> {
  currentId.value = row.tenantId
  const detail = await tenantApi.detail(row.tenantId)
  Object.assign(form, detail)
  formTitle.value = `${t('common.edit')}${t('menu.tenant')}`
  formVisible.value = true
}

async function submitForm(): Promise<void> {
  submitting.value = true
  try {
    if (currentId.value) {
      await tenantApi.update({ ...form, tenantId: currentId.value })
    } else {
      await tenantApi.add(form)
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
  const targets = ids ?? selected.value.map((r) => r.tenantId).join(',')
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
    await tenantApi.remove(targets.split(','))
    ElMessage.success(t('common.success'))
    tableRef.value?.reload()
  } catch (e: any) {
    ElMessage.error(e?.message || t('common.failed'))
  }
}

async function exportData(): Promise<void> {
  await download('/system/tenant/export', { method: 'post', data: { ...queryParams }, filename: 'tenant' })
}

async function changeStatus(row: TenantInfo, val: boolean): Promise<void> {
  try {
    await tenantApi.changeStatus(row.tenantId, val ? '0' : '1')
    row.status = val ? '0' : '1'
    ElMessage.success(t('common.success'))
  } catch (e: any) {
    ElMessage.error(e?.message || t('common.failed'))
  }
}

async function switchTenant(row: TenantInfo): Promise<void> {
  try {
    await tenantStore.setCurrent(row.tenantId)
    ElMessage.success(t('tenant.switched'))
    tableRef.value?.refresh()
  } catch (e: any) {
    ElMessage.error(e?.message || t('common.failed'))
  }
}
</script>

<template>
  <div class="wb-page wb-tenant">
    <SearchForm v-model="queryParams" :schemas="searchSchemas" @search="tableRef?.reload()" />

    <div class="wb-card">
      <ProTable
        ref="tableRef"
        row-key="tenantId"
        :columns="columns"
        :request="request"
        :selection="true"
        export-name="tenant"
        print-title="租户列表"
        @selection-change="onSelectionChange"
      >
        <template #toolbar-left>
          <el-button v-hasPermi="['system:tenant:add']" type="primary" @click="openAdd">
            + {{ t('common.add') }}
          </el-button>
          <el-button v-hasPermi="['system:tenant:remove']" plain :disabled="!selected.length" @click="remove()">
            {{ t('common.delete') }}
          </el-button>
        </template>

        <template #toolbar-right>
          <el-button v-hasPermi="['system:tenant:export']" plain @click="exportData">
            {{ t('common.export') }}
          </el-button>
        </template>

        <template #status="{ row }">
          <el-switch
            :model-value="row.status === '0'"
            :disabled="!hasPermi(['system:tenant:edit'])"
            @change="(v: any) => changeStatus(row as TenantInfo, Boolean(v))"
          />
        </template>

        <template #expireTime="{ row }">
          <span :class="{ 'wb-tenant__expired': isExpired(row.expireTime) }">
            {{ row.expireTime || '-' }}
          </span>
          <el-tag v-if="isExpired(row.expireTime)" type="danger" size="small" style="margin-left: 6px">
            {{ t('tenant.expired') }}
          </el-tag>
        </template>

        <template #operation="{ row }">
          <el-button v-hasPermi="['system:tenant:edit']" link type="primary" @click="openEdit(row as TenantInfo)">
            <el-icon><Edit /></el-icon>{{ t('common.edit') }}
          </el-button>
          <el-button link type="warning" @click="switchTenant(row as TenantInfo)">
            <el-icon><Refresh /></el-icon>{{ t('tenant.switch') }}
          </el-button>
          <el-button v-hasPermi="['system:tenant:remove']" link type="danger" @click="remove(row.tenantId)">
            {{ t('common.delete') }}
          </el-button>
        </template>
      </ProTable>
    </div>

    <ProDialog v-model="formVisible" :title="formTitle" width="640px" :loading="submitting" @confirm="submitForm">
      <el-form :model="form" label-width="90px">
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item :label="t('tenant.name')" prop="tenantName">
              <el-input v-model="form.tenantName" clearable />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('tenant.code')" prop="tenantCode">
              <el-input v-model="form.tenantCode" clearable />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('tenant.contact')" prop="contactUser">
              <el-input v-model="form.contactUser" clearable />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('tenant.phone')" prop="contactPhone">
              <el-input v-model="form.contactPhone" clearable />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('common.status')" prop="status">
              <el-radio-group v-model="form.status">
                <el-radio value="0">{{ t('common.enabled') }}</el-radio>
                <el-radio value="1">{{ t('common.disabled') }}</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('tenant.expire')" prop="expireTime">
              <el-date-picker
                v-model="form.expireTime"
                type="date"
                value-format="YYYY-MM-DD"
                :placeholder="`请选择${t('tenant.expire')}`"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
    </ProDialog>
  </div>
</template>

<style scoped lang="scss">
.wb-tenant {
  &__expired {
    color: var(--el-color-danger);
    font-weight: 600;
  }
}
</style>
