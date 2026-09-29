<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Edit } from '@element-plus/icons-vue'
import type { FormSchema } from '@/components/ProForm/types'
import SearchForm from '@/components/SearchForm/index.vue'
import ProTable from '@/components/ProTable/index.vue'
import ProDialog from '@/components/ProDialog.vue'
import type { TableColumn } from '@/components/ProTable/types'
import { postApi } from '@/api/dept'
import { download } from '@/utils/download'
import { hasPermi } from '@/utils/permission'
import { useI18n } from 'vue-i18n'
import type { PostInfo } from '@/types'

defineOptions({ name: 'SystemPost' })

const { t } = useI18n()

/** ---------- 查询条件 ---------- */
const queryParams = reactive<{ postCode?: string; postName?: string; status?: string }>({})

const searchSchemas = computed<FormSchema[]>(() => [
  { prop: 'postCode', label: t('post.code'), type: 'input' },
  { prop: 'postName', label: t('post.name'), type: 'input' },
  { prop: 'status', label: t('common.status'), type: 'dict', dictType: 'sys_normal_disable' }
])

/** ---------- 表格 ---------- */
const tableRef = ref<any>(null)
const selected = ref<PostInfo[]>([])

const columns = ref<TableColumn[]>([
  { label: t('post.id'), prop: 'postId', width: 100 },
  { label: t('post.code'), prop: 'postCode', minWidth: 130 },
  { label: t('post.name'), prop: 'postName', minWidth: 140 },
  { label: t('post.sort'), prop: 'postSort', width: 100, sortable: false },
  { label: t('common.status'), prop: 'status', slot: 'status', width: 100, sortable: false },
  { label: t('common.remark'), prop: 'remark', minWidth: 180, sortable: false },
  { label: t('common.createTime'), prop: 'createTime', minWidth: 170, sortable: false },
  {
    label: t('common.operate'),
    prop: 'operation',
    slot: 'operation',
    width: 180,
    fixed: 'right',
    sortable: false
  }
])

async function request(params: Record<string, any>): Promise<{ list: PostInfo[]; total: number }> {
  const res: unknown = await postApi.list({ ...queryParams, ...params })
  // 后端对 /system/post/list 同时支持「分页对象 / 纯数组」两种返回，这里统一取数组
  if (Array.isArray(res)) {
    return { list: res as PostInfo[], total: (res as PostInfo[]).length }
  }
  const page = (res ?? {}) as { list?: PostInfo[]; total?: number }
  return { list: page.list ?? [], total: page.total ?? page.list?.length ?? 0 }
}

function onSelectionChange(rows: PostInfo[]): void {
  selected.value = rows
}

/** ---------- 表单 ---------- */
const formVisible = ref(false)
const formTitle = ref('')
const submitting = ref(false)
const currentId = ref('')
const form = reactive<Partial<PostInfo>>({})

async function openAdd(): Promise<void> {
  currentId.value = ''
  Object.assign(form, { postCode: '', postName: '', postSort: 1, status: '0', remark: '' })
  formTitle.value = `${t('common.add')}${t('menu.post')}`
  formVisible.value = true
}

async function openEdit(row: PostInfo): Promise<void> {
  currentId.value = row.postId
  const detail = await postApi.detail(row.postId)
  Object.assign(form, detail)
  formTitle.value = `${t('common.edit')}${t('menu.post')}`
  formVisible.value = true
}

async function submitForm(): Promise<void> {
  submitting.value = true
  try {
    if (currentId.value) {
      await postApi.update({ ...form, postId: currentId.value })
    } else {
      await postApi.add(form)
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
  const targets = ids ?? selected.value.map((p) => p.postId).join(',')
  if (!targets) {
    ElMessage.warning(t('common.selectAtLeastOne'))
    return
  }
  try {
    await ElMessageBox.confirm(t('common.confirmDelete'), t('common.tip'), { type: 'warning' })
  } catch {
    return
  }
  await postApi.remove(targets.split(','))
  ElMessage.success(t('common.success'))
  tableRef.value?.reload()
}

async function exportData(): Promise<void> {
  await download('/system/post/export', { method: 'post', data: { ...queryParams }, filename: 'post' })
}
</script>

<template>
  <div class="wb-page wb-post">
    <SearchForm v-model="queryParams" :schemas="searchSchemas" @search="tableRef?.reload()" />

    <div class="wb-card">
      <ProTable
        ref="tableRef"
        row-key="postId"
        :columns="columns"
        :request="request"
        :selection="true"
        export-name="post"
        print-title="岗位列表"
        @selection-change="onSelectionChange"
      >
        <template #toolbar-left>
          <el-button v-hasPermi="['system:post:add']" type="primary" @click="openAdd">
            + {{ t('common.add') }}
          </el-button>
          <el-button v-hasPermi="['system:post:remove']" plain :disabled="!selected.length" @click="remove()">
            {{ t('common.delete') }}
          </el-button>
        </template>

        <template #toolbar-right>
          <el-button v-hasPermi="['system:post:export']" plain @click="exportData">
            {{ t('common.export') }}
          </el-button>
        </template>

        <template #status="{ row }">
          <el-switch
            :model-value="row.status === '0'"
            :disabled="!hasPermi(['system:post:edit'])"
            @change="
              async (v: any) => {
                await postApi.update({ postId: row.postId, status: Boolean(v) ? '0' : '1' })
                ElMessage.success(t('common.success'))
                row.status = Boolean(v) ? '0' : '1'
              }
            "
          />
        </template>

        <template #operation="{ row }">
          <el-button v-hasPermi="['system:post:edit']" link type="primary" @click="openEdit(row as PostInfo)">
            <el-icon><Edit /></el-icon>{{ t('common.edit') }}
          </el-button>
          <el-button v-hasPermi="['system:post:remove']" link type="danger" @click="remove(row.postId)">
            {{ t('common.delete') }}
          </el-button>
        </template>
      </ProTable>
    </div>

    <ProDialog v-model="formVisible" :title="formTitle" width="600px" :loading="submitting" @confirm="submitForm">
      <el-form :model="form" label-width="90px">
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item :label="t('post.code')" prop="postCode">
              <el-input v-model="form.postCode" clearable />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('post.name')" prop="postName">
              <el-input v-model="form.postName" clearable />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('post.sort')" prop="postSort">
              <el-input-number v-model="form.postSort" :min="1" controls-position="right" style="width: 100%" />
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
            <el-form-item :label="t('common.remark')" prop="remark">
              <el-input v-model="form.remark" type="textarea" :rows="3" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
    </ProDialog>
  </div>
</template>
