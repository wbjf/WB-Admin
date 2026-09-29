<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Edit } from '@element-plus/icons-vue'
import type { FormSchema } from '@/components/ProForm/types'
import SearchForm from '@/components/SearchForm/index.vue'
import ProTable from '@/components/ProTable/index.vue'
import ProDialog from '@/components/ProDialog.vue'
import DictTag from '@/components/Dict/DictTag.vue'
import WangEditor from '@/components/Editor/WangEditor.vue'
import type { TableColumn } from '@/components/ProTable/types'
import { noticeApi } from '@/api/dept'
import { useI18n } from 'vue-i18n'

defineOptions({ name: 'SystemNotice' })

const { t } = useI18n()

/** ---------- 查询条件 ---------- */
const queryParams = reactive<{ noticeTitle?: string; noticeType?: string; createBy?: string }>({})

const searchSchemas = computed<FormSchema[]>(() => [
  { prop: 'noticeTitle', label: t('notice.title'), type: 'input' },
  {
    prop: 'noticeType',
    label: t('notice.type'),
    type: 'select',
    options: [
      { label: t('notice.typeNotice'), value: '1' },
      { label: t('notice.typeAnnounce'), value: '2' }
    ]
  },
  { prop: 'createBy', label: t('common.createBy'), type: 'input' }
])

/** ---------- 表格 ---------- */
const tableRef = ref<any>(null)
const selected = ref<any[]>([])

const columns = ref<TableColumn[]>([
  { label: '公告编号', prop: 'noticeId', width: 110, sortable: false },
  { label: t('notice.title'), prop: 'noticeTitle', minWidth: 220, sortable: false },
  { label: t('notice.type'), prop: 'noticeType', slot: 'noticeType', width: 100, sortable: false },
  { label: t('common.status'), prop: 'status', slot: 'status', width: 90, sortable: false },
  { label: t('common.createBy'), prop: 'createBy', width: 110, sortable: false },
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
  const res: unknown = await noticeApi.list({ ...queryParams, ...params })
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
  Object.assign(form, { noticeTitle: '', noticeType: '1', status: '0', noticeContent: '' })
  formTitle.value = `${t('common.add')}${t('menu.notice')}`
  formVisible.value = true
}

async function openEdit(row: any): Promise<void> {
  currentId.value = row.noticeId
  const detail = await noticeApi.detail(row.noticeId)
  Object.assign(form, detail)
  formTitle.value = `${t('common.edit')}${t('menu.notice')}`
  formVisible.value = true
}

async function submitForm(): Promise<void> {
  submitting.value = true
  try {
    if (currentId.value) {
      await noticeApi.update({ ...form, noticeId: currentId.value })
    } else {
      await noticeApi.add(form)
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
  const targets = ids ?? selected.value.map((r) => r.noticeId).join(',')
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
    await noticeApi.remove(targets.split(','))
    ElMessage.success(t('common.success'))
    tableRef.value?.reload()
  } catch (e: any) {
    ElMessage.error(e?.message || t('common.failed'))
  }
}
</script>

<template>
  <div class="wb-page wb-notice">
    <SearchForm v-model="queryParams" :schemas="searchSchemas" @search="tableRef?.reload()" />

    <div class="wb-card">
      <ProTable
        ref="tableRef"
        row-key="noticeId"
        :columns="columns"
        :request="request"
        :selection="true"
        export-name="notice"
        print-title="通知公告列表"
        @selection-change="onSelectionChange"
      >
        <template #toolbar-left>
          <el-button v-hasPermi="['system:notice:add']" type="primary" @click="openAdd">
            + {{ t('common.add') }}
          </el-button>
          <el-button v-hasPermi="['system:notice:remove']" plain :disabled="!selected.length" @click="remove()">
            {{ t('common.delete') }}
          </el-button>
        </template>

        <template #noticeType="{ row }">
          <el-tag :type="row.noticeType === '2' ? 'warning' : 'success'" disable-transitions>
            {{ row.noticeType === '2' ? t('notice.typeAnnounce') : t('notice.typeNotice') }}
          </el-tag>
        </template>

        <template #status="{ row }">
          <DictTag dict-type="sys_normal_disable" :value="row.status" />
        </template>

        <template #operation="{ row }">
          <el-button v-hasPermi="['system:notice:edit']" link type="primary" @click="openEdit(row)">
            <el-icon><Edit /></el-icon>{{ t('common.edit') }}
          </el-button>
          <el-button v-hasPermi="['system:notice:remove']" link type="danger" @click="remove(row.noticeId)">
            {{ t('common.delete') }}
          </el-button>
        </template>
      </ProTable>
    </div>

    <ProDialog v-model="formVisible" :title="formTitle" width="860px" :loading="submitting" @confirm="submitForm">
      <el-form :model="form" label-width="90px">
        <el-row :gutter="12">
          <el-col :span="24">
            <el-form-item :label="t('notice.title')" prop="noticeTitle">
              <el-input v-model="form.noticeTitle" clearable />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('notice.type')" prop="noticeType">
              <el-radio-group v-model="form.noticeType">
                <el-radio value="1">{{ t('notice.typeNotice') }}</el-radio>
                <el-radio value="2">{{ t('notice.typeAnnounce') }}</el-radio>
              </el-radio-group>
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
          <el-col :span="24">
            <el-form-item :label="t('notice.content')" prop="noticeContent">
              <WangEditor v-model="form.noticeContent" height="320px" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
    </ProDialog>
  </div>
</template>

<style scoped lang="scss">
.wb-notice {
  :deep(.wb-editor) {
    width: 100%;
  }
}
</style>
