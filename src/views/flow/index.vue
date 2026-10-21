<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ElButton, ElMessage, ElMessageBox, ElTable, ElTableColumn, ElTag } from 'element-plus'
import type { FlowListItem } from '@/types'
import { flowApi } from '@/api/flow'
import SearchForm from '@/components/SearchForm/index.vue'
import type { FormSchema } from '@/components/ProForm/types'
import ProDialog from '@/components/ProDialog.vue'

defineOptions({ name: 'FlowList' })

const { t } = useI18n()
const router = useRouter()

const loading = ref(false)
const list = ref<FlowListItem[]>([])
const total = ref(0)
const query = reactive<{ pageNum: number; pageSize: number; name?: string }>({
  pageNum: 1,
  pageSize: 10,
  name: ''
})

const searchFields: FormSchema[] = [{ prop: 'name', label: t('flow.name'), type: 'input' }]

async function load(): Promise<void> {
  loading.value = true
  try {
    const res = await flowApi.list({ ...query })
    list.value = res?.list || []
    total.value = res?.total || 0
  } finally {
    loading.value = false
  }
}

onMounted(load)

function prevPage(): void {
  if (query.pageNum <= 1) return
  query.pageNum--
  void load()
}

function nextPage(): void {
  query.pageNum++
  void load()
}

function open(id: string): void {
  router.push(`/flow/editor/${id}`)
}

const createVisible = ref(false)
const createForm = reactive({
  name: '',
  category: 'process' as FlowListItem['category'],
  description: ''
})

async function create(): Promise<void> {
  if (!createForm.name.trim()) {
    ElMessage.warning(t('flow.name'))
    return
  }
  const res = await flowApi.add({ ...createForm })
  createVisible.value = false
  createForm.name = ''
  if (res?.id) {
    ElMessage.success(t('common.success') || 'OK')
    open(res.id)
  }
  await load()
}

async function remove(raw: unknown): Promise<void> {
  const row = raw as FlowListItem
  try {
    await ElMessageBox.confirm(
      t('common.confirmDelete') || '确认删除？',
      t('common.tip') || '提示',
      {
        type: 'warning'
      }
    )
  } catch {
    return
  }
  await flowApi.remove(row.id)
  ElMessage.success(t('common.success') || 'OK')
  await load()
}
</script>

<template>
  <div class="page">
    <SearchForm v-model="query" :schemas="searchFields" @search="load" @reset="query.name = ''" />

    <div class="toolbar">
      <el-button type="primary" @click="createVisible = true">
        {{ t('common.add') || '新增' }}
      </el-button>
    </div>

    <el-table v-loading="loading" :data="list" border size="small">
      <el-table-column prop="name" :label="t('flow.name')" min-width="200" />
      <el-table-column prop="category" :label="t('flow.stage')" width="110">
        <template #default="{ row }">
          <el-tag size="small">{{ row.category }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="version" :label="t('flow.versionNo')" width="90" />
      <el-table-column
        prop="description"
        :label="t('flow.remark')"
        min-width="180"
        show-overflow-tooltip
      />
      <el-table-column :label="t('common.operate') || '操作'" width="160">
        <template #default="{ row }">
          <el-button link type="primary" @click="open(row.id)">{{ t('flow.version') }}</el-button>
          <el-button link type="danger" @click="remove(row)">
            {{ t('common.delete') || '删除' }}
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pager">
      <el-button size="small" :disabled="query.pageNum <= 1" @click="prevPage">上一页</el-button>
      <span>
        {{ query.pageNum }} / {{ Math.max(1, Math.ceil(total / query.pageSize)) }} · 共 {{ total }}
      </span>
      <el-button size="small" @click="nextPage">下一页</el-button>
    </div>

    <ProDialog v-model="createVisible" title="新建流程图" width="480px">
      <div class="form">
        <label>{{ t('flow.name') }}</label>
        <input v-model="createForm.name" class="ipt" />
        <label>{{ t('flow.remark') }}</label>
        <input v-model="createForm.description" class="ipt" />
      </div>
      <template #footer>
        <el-button size="small" @click="createVisible = false">
          {{ t('common.cancel') || '取消' }}
        </el-button>
        <el-button size="small" type="primary" @click="create">
          {{ t('common.confirm') || '确定' }}
        </el-button>
      </template>
    </ProDialog>
  </div>
</template>

<style scoped>
.page {
  padding: 12px;
}
.toolbar {
  margin: 10px 0;
}
.pager {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.form {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.form label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.ipt {
  height: 32px;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  padding: 0 8px;
}
</style>
