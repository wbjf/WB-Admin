<script setup lang="ts">
defineOptions({ name: 'ToolFile' })

import { computed, reactive, ref } from 'vue'
import { ElImageViewer, ElMessage, ElMessageBox } from 'element-plus'
import { Delete, Document, Download, Edit, FolderAdd, Grid, List, View } from '@element-plus/icons-vue'
import type { FormSchema } from '@/components/ProForm/types'
import SearchForm from '@/components/SearchForm/index.vue'
import ProTable from '@/components/ProTable/index.vue'
import ProUpload from '@/components/ProUpload/index.vue'
import type { TableColumn } from '@/components/ProTable/types'
import { fileApi } from '@/api/tool'
import { formatSize } from '@/utils'
import { useI18n } from 'vue-i18n'
import type { SysFile } from '@/types'

const { t } = useI18n()

/** ---------- 查询条件 ---------- */
const queryParams = reactive<{ fileName?: string }>({})

const searchSchemas = computed<FormSchema[]>(() => [
  { prop: 'fileName', label: t('tool.file.name'), type: 'input' }
])

/** ---------- 视图与数据 ---------- */
type ViewMode = 'list' | 'grid'
const viewMode = ref<ViewMode>('list')

const tableRef = ref<any>(null)
const selected = ref<SysFile[]>([])
const gridRows = ref<SysFile[]>([])
const gridLoading = ref(false)
const gridSelected = ref<string[]>([])

const columns = ref<TableColumn[]>([
  { label: '文件编号', prop: 'fileId', width: 110, sortable: false },
  { label: t('tool.file.name'), prop: 'fileName', minWidth: 220, sortable: false },
  { label: t('tool.file.url'), prop: 'fileUrl', slot: 'fileUrl', minWidth: 240, sortable: false },
  { label: t('tool.file.size'), prop: 'fileSize', slot: 'fileSize', width: 120, align: 'right', sortable: false },
  { label: t('tool.file.type'), prop: 'fileType', slot: 'fileType', width: 180, sortable: false },
  { label: t('common.createTime'), prop: 'createTime', minWidth: 170, sortable: false },
  {
    label: t('common.operate'),
    prop: 'operation',
    slot: 'operation',
    width: 220,
    fixed: 'right',
    sortable: false
  }
])

async function listRequest(params: Record<string, any>): Promise<{ list: SysFile[]; total: number }> {
  const res = await fileApi.list({ ...queryParams, ...params })
  return { list: (res?.list ?? []) as SysFile[], total: res?.total ?? 0 }
}

function onSelectionChange(rows: SysFile[]): void {
  selected.value = rows
}

async function loadGrid(): Promise<void> {
  gridLoading.value = true
  try {
    const res = await listRequest({ pageNum: 1, pageSize: 100 })
    gridRows.value = res.list
    gridSelected.value = gridSelected.value.filter((id) => res.list.some((r) => r.fileId === id))
  } catch (e: any) {
    ElMessage.error(e?.message || t('common.failed'))
  } finally {
    gridLoading.value = false
  }
}

function refresh(): void {
  if (viewMode.value === 'list') {
    tableRef.value?.reload()
  } else {
    void loadGrid()
  }
}

function onChangeView(mode: any): void {
  viewMode.value = mode === 'grid' ? 'grid' : 'list'
  refresh()
}

/** ---------- 通用判断 ---------- */
function isImage(row: SysFile): boolean {
  const typeHit = String(row.fileType ?? '').startsWith('image/')
  const extHit = /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(String(row.fileName ?? ''))
  return typeHit || extHit
}

function fileExt(name: string): string {
  const idx = String(name ?? '').lastIndexOf('.')
  return idx > -1 ? String(name).slice(idx + 1).toUpperCase() : 'FILE'
}

/** ---------- 预览 ---------- */
const viewerVisible = ref(false)
const viewerList = ref<string[]>([])

function openPreview(row: SysFile): void {
  if (isImage(row)) {
    viewerList.value = [row.fileUrl]
    viewerVisible.value = true
    return
  }
  if (!row.fileUrl) {
    ElMessage.warning('该文件暂无访问地址')
    return
  }
  window.open(row.fileUrl, '_blank')
}

function openUrl(row: SysFile): void {
  if (!row.fileUrl) {
    ElMessage.warning('该文件暂无访问地址')
    return
  }
  window.open(row.fileUrl, '_blank')
}

/** ---------- 上传 ---------- */
function onUploadSuccess(): void {
  ElMessage.success(t('common.success'))
  refresh()
}

/** ---------- 新建文件夹 ---------- */
async function mkdir(): Promise<void> {
  let name = ''
  try {
    const res = await ElMessageBox.prompt('请输入文件夹名称', '新建文件夹', {
      inputPlaceholder: '例如：合同文件',
      inputPattern: /\S+/,
      inputErrorMessage: '文件夹名称不能为空',
      confirmButtonText: t('common.confirm'),
      cancelButtonText: t('common.cancel')
    })
    name = String(res.value ?? '').trim()
  } catch {
    return
  }
  try {
    await fileApi.mkdir('0', name)
    ElMessage.success(t('common.success'))
    refresh()
  } catch (e: any) {
    ElMessage.error(e?.message || t('common.failed'))
  }
}

/** ---------- 重命名 ---------- */
async function rename(row: SysFile): Promise<void> {
  let name = ''
  try {
    const res = await ElMessageBox.prompt('请输入新的文件名称', '重命名', {
      inputValue: row.fileName,
      inputPattern: /\S+/,
      inputErrorMessage: '文件名称不能为空',
      confirmButtonText: t('common.confirm'),
      cancelButtonText: t('common.cancel')
    })
    name = String(res.value ?? '').trim()
  } catch {
    return
  }
  try {
    await fileApi.rename(row.fileId, name)
    ElMessage.success(t('common.success'))
    refresh()
  } catch (e: any) {
    ElMessage.error(e?.message || t('common.failed'))
  }
}

/** ---------- 删除 ---------- */
async function remove(ids?: string): Promise<void> {
  const targets = ids
    ? [ids]
    : viewMode.value === 'list'
      ? selected.value.map((r) => r.fileId)
      : gridSelected.value
  if (!targets.length) {
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
    await fileApi.remove(targets)
    ElMessage.success(t('common.success'))
    gridSelected.value = []
    refresh()
  } catch (e: any) {
    ElMessage.error(e?.message || t('common.failed'))
  }
}

function toggleGridSelect(fileId: string): void {
  const idx = gridSelected.value.indexOf(fileId)
  if (idx > -1) gridSelected.value.splice(idx, 1)
  else gridSelected.value.push(fileId)
}

const imageUrls = computed(() => gridRows.value.filter(isImage).map((r) => r.fileUrl))
</script>

<template>
  <div class="wb-page wb-tool-file">
    <SearchForm v-model="queryParams" :schemas="searchSchemas" @search="refresh()" />

    <div class="wb-card">
      <div class="wb-tool-file__bar">
        <div class="wb-flex wb-gap8">
          <ProUpload v-hasPermi="['system:file:add']" list-type="text" @success="onUploadSuccess" />
          <el-button v-hasPermi="['system:file:add']" plain @click="mkdir">
            <el-icon><FolderAdd /></el-icon>新建文件夹
          </el-button>
          <el-button
            v-hasPermi="['system:file:remove']"
            type="danger"
            plain
            :disabled="viewMode === 'list' ? !selected.length : !gridSelected.length"
            @click="remove()"
          >
            <el-icon><Delete /></el-icon>{{ t('common.delete') }}
          </el-button>
        </div>

        <el-radio-group :model-value="viewMode" size="default" @change="onChangeView">
          <el-radio-button value="list">
            <el-icon><List /></el-icon>列表
          </el-radio-button>
          <el-radio-button value="grid">
            <el-icon><Grid /></el-icon>网格
          </el-radio-button>
        </el-radio-group>
      </div>

      <ProTable
        v-if="viewMode === 'list'"
        ref="tableRef"
        row-key="fileId"
        :columns="columns"
        :request="listRequest"
        :selection="true"
        export-name="wb-file"
        print-title="文件列表"
        @selection-change="onSelectionChange"
      >
        <template #fileUrl="{ row }">
          <el-link type="primary" :underline="false" @click="openUrl(row as SysFile)">
            <el-icon><Download /></el-icon>{{ row.fileUrl }}
          </el-link>
        </template>

        <template #fileSize="{ row }">
          <span>{{ formatSize(row.fileSize) }}</span>
        </template>

        <template #fileType="{ row }">
          <el-tag size="small" disable-transitions effect="plain">{{ row.fileType || fileExt(row.fileName) }}</el-tag>
        </template>

        <template #operation="{ row }">
          <el-button v-hasPermi="['system:file:list']" link type="primary" @click="openPreview(row as SysFile)">
            <el-icon><View /></el-icon>{{ t('tool.file.preview') }}
          </el-button>
          <el-button v-hasPermi="['system:file:remove']" link type="warning" @click="rename(row as SysFile)">
            <el-icon><Edit /></el-icon>重命名
          </el-button>
          <el-button v-hasPermi="['system:file:remove']" link type="danger" @click="remove(row.fileId)">
            <el-icon><Delete /></el-icon>{{ t('common.delete') }}
          </el-button>
        </template>
      </ProTable>

      <!-- 网格视图 -->
      <div v-else v-loading="gridLoading" class="wb-tool-file__grid">
        <el-row :gutter="12">
          <el-col v-for="row in gridRows" :key="row.fileId" :span="4" :xs="12" :sm="8" :md="6" :lg="4">
            <el-card shadow="hover" :body-style="{ padding: '8px' }" class="wb-tool-file__card">
              <el-checkbox
                :model-value="gridSelected.includes(row.fileId)"
                class="wb-tool-file__check"
                @change="toggleGridSelect(row.fileId)"
              />
              <div class="wb-tool-file__thumb" @click="openPreview(row)">
                <el-image
                  v-if="isImage(row)"
                  :src="row.fileUrl"
                  :preview-src-list="imageUrls"
                  preview-teleported
                  fit="cover"
                  class="wb-tool-file__pic"
                />
                <div v-else class="wb-tool-file__ext">
                  <el-icon :size="26"><Document /></el-icon>
                  <span>{{ fileExt(row.fileName) }}</span>
                </div>
              </div>
              <div class="wb-tool-file__meta">
                <div class="wb-ellipsis" :title="row.fileName">{{ row.fileName }}</div>
                <div class="wb-text-muted">{{ formatSize(row.fileSize) }}</div>
              </div>
              <div class="wb-tool-file__ops">
                <el-button link type="primary" size="small" @click="rename(row)">重命名</el-button>
                <el-button link type="danger" size="small" @click="remove(row.fileId)">{{ t('common.delete') }}</el-button>
              </div>
            </el-card>
          </el-col>
        </el-row>

        <el-empty v-if="!gridRows.length && !gridLoading" :description="t('common.noData')" :image-size="90" />
      </div>
    </div>

    <el-image-viewer
      v-if="viewerVisible"
      :url-list="viewerList"
      teleported
      @close="viewerVisible = false"
    />
  </div>
</template>

<style scoped lang="scss">
.wb-tool-file {
  &__bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    margin-bottom: 12px;
  }

  &__grid {
    min-height: 240px;
  }

  &__card {
    position: relative;
    margin-bottom: 12px;
  }

  &__check {
    position: absolute;
    top: 6px;
    right: 8px;
    z-index: 2;
  }

  &__thumb {
    height: 96px;
    border-radius: 6px;
    overflow: hidden;
    background: var(--el-fill-color-light);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &__pic {
    width: 100%;
    height: 100%;
    display: block;
  }

  &__ext {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }

  &__meta {
    margin-top: 6px;
    font-size: 12px;
    line-height: 1.6;
  }

  &__ops {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 4px;
    margin-top: 2px;
  }
}
</style>
