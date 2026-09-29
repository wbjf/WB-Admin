<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Edit, Search } from '@element-plus/icons-vue'
import DictTag from '@/components/Dict/DictTag.vue'
import ProTable from '@/components/ProTable/index.vue'
import ProDialog from '@/components/ProDialog.vue'
import type { TableColumn } from '@/components/ProTable/types'
import { dictApi } from '@/api/dept'
import { hasPermi } from '@/utils/permission'
import { useDictStore } from '@/stores/modules/dict'
import { useI18n } from 'vue-i18n'
import type { DictType } from '@/types'

defineOptions({ name: 'SystemDict' })

const { t } = useI18n()
const dictStore = useDictStore()

/** 后端对 list 接口同时支持「分页对象 / 纯数组」两种返回，这里统一归一 */
function normalize(res: unknown): { list: any[]; total: number } {
  if (Array.isArray(res)) return { list: res as any[], total: (res as any[]).length }
  const page = (res ?? {}) as { list?: any[]; total?: number }
  return { list: page.list ?? [], total: page.total ?? page.list?.length ?? 0 }
}

/** ---------- 左栏：字典类型 ---------- */
const typeTableRef = ref<any>(null)
const typeSelected = ref<DictType[]>([])
const typeQuery = ref<{ dictName?: string; dictType?: string }>({})

const typeColumns = ref<TableColumn[]>([
  { label: t('dict.typeName'), prop: 'dictName', minWidth: 120, sortable: false },
  { label: t('dict.typeKey'), prop: 'dictType', minWidth: 150, sortable: false },
  { label: t('common.status'), prop: 'status', slot: 'status', width: 90, sortable: false },
  { label: t('common.remark'), prop: 'remark', minWidth: 120, sortable: false },
  { label: t('common.createTime'), prop: 'createTime', minWidth: 150, sortable: false },
  {
    label: t('common.operate'),
    prop: 'operation',
    slot: 'operation',
    width: 140,
    fixed: 'right',
    sortable: false
  }
])

async function typeRequest(params: Record<string, any>): Promise<{ list: any[]; total: number }> {
  const res = await dictApi.typeList({ ...typeQuery.value, ...params })
  return normalize(res)
}

function onTypeSelectionChange(rows: DictType[]): void {
  typeSelected.value = rows
}

/** ---------- 右栏：字典数据 ---------- */
const dataTableRef = ref<any>(null)
const dataSelected = ref<any[]>([])
const currentTypeName = ref('')
const currentDictType = ref('')

const dataColumns = ref<TableColumn[]>([
  { label: t('dict.label'), prop: 'dictLabel', minWidth: 130, sortable: false },
  { label: t('dict.value'), prop: 'dictValue', minWidth: 130, sortable: false },
  { label: t('dict.sort'), prop: 'dictSort', width: 90, sortable: false },
  { label: t('dict.default'), prop: 'isDefault', slot: 'isDefault', width: 90, sortable: false },
  { label: t('common.status'), prop: 'status', slot: 'status', width: 90, sortable: false },
  { label: t('common.remark'), prop: 'remark', minWidth: 140, sortable: false },
  {
    label: t('common.operate'),
    prop: 'operation',
    slot: 'operation',
    width: 140,
    fixed: 'right',
    sortable: false
  }
])

async function dataRequest(params: Record<string, any>): Promise<{ list: any[]; total: number }> {
  if (!currentDictType.value) return { list: [], total: 0 }
  const res = await dictApi.dataList({ dictType: currentDictType.value, ...params })
  return normalize(res)
}

function onDataSelectionChange(rows: any[]): void {
  dataSelected.value = rows
}

/** 点击类型行 → 联动右侧字典数据 */
function onTypeRowClick(row: DictType): void {
  if (!row?.dictType) return
  currentDictType.value = row.dictType
  currentTypeName.value = row.dictName
  dataSelected.value = []
  dataTableRef.value?.reload()
}

/** 首屏默认选中第一条类型 */
function onTypeLoaded(rows: DictType[]): void {
  if (currentDictType.value || !rows?.length) return
  onTypeRowClick(rows[0])
}

/** ---------- 刷新缓存 ---------- */
async function refreshCache(): Promise<void> {
  try {
    await dictApi.refreshCache()
    dictStore.clearCache()
    ElMessage.success(t('dict.cacheCleared'))
    typeTableRef.value?.refresh()
    dataTableRef.value?.refresh()
  } catch (e: any) {
    ElMessage.error(e?.message || t('common.failed'))
  }
}

/** ---------- 字典类型表单 ---------- */
const typeFormVisible = ref(false)
const typeFormTitle = ref('')
const submitting = ref(false)
const currentTypeId = ref('')
const typeForm = ref<Record<string, any>>({})

async function openTypeAdd(): Promise<void> {
  currentTypeId.value = ''
  typeForm.value = { dictName: '', dictType: '', status: '0', remark: '' }
  typeFormTitle.value = `${t('common.add')}${t('menu.dict')}`
  typeFormVisible.value = true
}

async function openTypeEdit(row: DictType): Promise<void> {
  currentTypeId.value = row.dictId
  const detail = await dictApi.typeDetail(row.dictId)
  typeForm.value = { ...detail }
  typeFormTitle.value = `${t('common.edit')}${t('menu.dict')}`
  typeFormVisible.value = true
}

async function submitTypeForm(): Promise<void> {
  submitting.value = true
  try {
    if (currentTypeId.value) {
      await dictApi.typeUpdate({ ...typeForm.value, dictId: currentTypeId.value })
    } else {
      await dictApi.typeAdd(typeForm.value)
    }
    ElMessage.success(t('common.success'))
    typeFormVisible.value = false
    await dictApi.refreshCache()
    dictStore.clearCache()
    typeTableRef.value?.refresh()
  } catch (e: any) {
    ElMessage.error(e?.message || t('common.failed'))
  } finally {
    submitting.value = false
  }
}

async function removeType(id?: string): Promise<void> {
  const targets = id ?? typeSelected.value.map((r) => r.dictId).join(',')
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
    await dictApi.typeRemove(targets.split(','))
    ElMessage.success(t('common.success'))
    await dictApi.refreshCache()
    dictStore.clearCache()
    typeTableRef.value?.reload()
  } catch (e: any) {
    ElMessage.error(e?.message || t('common.failed'))
  }
}

/** ---------- 字典数据表单 ---------- */
const listClassOptions = [
  { label: 'primary', value: 'primary' },
  { label: 'success', value: 'success' },
  { label: 'info', value: 'info' },
  { label: 'warning', value: 'warning' },
  { label: 'danger', value: 'danger' }
]

const dataFormVisible = ref(false)
const dataFormTitle = ref('')
const currentDataId = ref('')
const dataForm = ref<Record<string, any>>({})

async function openDataAdd(): Promise<void> {
  if (!currentDictType.value) {
    ElMessage.warning(t('common.selectAtLeastOne'))
    return
  }
  currentDataId.value = ''
  dataForm.value = {
    dictType: currentDictType.value,
    dictLabel: '',
    dictValue: '',
    dictSort: 1,
    listClass: 'primary',
    isDefault: 'N',
    status: '0',
    remark: ''
  }
  dataFormTitle.value = `${t('common.add')}${t('dict.dataTitle')}`
  dataFormVisible.value = true
}

async function openDataEdit(row: any): Promise<void> {
  currentDataId.value = row.dictCode
  const detail = await dictApi.dataDetail(row.dictCode)
  dataForm.value = { ...detail, dictType: currentDictType.value }
  dataFormTitle.value = `${t('common.edit')}${t('dict.dataTitle')}`
  dataFormVisible.value = true
}

async function submitDataForm(): Promise<void> {
  submitting.value = true
  try {
    const payload = { ...dataForm.value, dictType: currentDictType.value }
    if (currentDataId.value) {
      await dictApi.dataUpdate({ ...payload, dictCode: currentDataId.value })
    } else {
      await dictApi.dataAdd(payload)
    }
    ElMessage.success(t('common.success'))
    dataFormVisible.value = false
    await dictApi.refreshCache()
    dictStore.clearCache()
    dataTableRef.value?.refresh()
  } catch (e: any) {
    ElMessage.error(e?.message || t('common.failed'))
  } finally {
    submitting.value = false
  }
}

async function removeData(id?: string): Promise<void> {
  const targets = id ?? dataSelected.value.map((r) => r.dictCode).join(',')
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
    await dictApi.dataRemove(targets.split(','))
    ElMessage.success(t('common.success'))
    await dictApi.refreshCache()
    dictStore.clearCache()
    dataTableRef.value?.reload()
  } catch (e: any) {
    ElMessage.error(e?.message || t('common.failed'))
  }
}
</script>

<template>
  <div class="wb-page wb-dict">
    <el-row :gutter="12">
      <el-col :span="10" :xs="24">
        <div class="wb-card wb-card--fill">
          <div class="wb-dict__search">
            <el-input
              v-model="typeQuery.dictName"
              :placeholder="t('dict.typeName')"
              clearable
              style="flex: 1"
              @keyup.enter="typeTableRef?.reload()"
            >
              <template #prefix><el-icon><Search /></el-icon></template>
            </el-input>
            <el-input
              v-model="typeQuery.dictType"
              :placeholder="t('dict.typeKey')"
              clearable
              style="flex: 1"
              @keyup.enter="typeTableRef?.reload()"
            />
            <el-button type="primary" @click="typeTableRef?.reload()">{{ t('common.query') }}</el-button>
          </div>

          <ProTable
            ref="typeTableRef"
            row-key="dictId"
            :columns="typeColumns"
            :request="typeRequest"
            :selection="true"
            export-name="dict-type"
            print-title="字典类型列表"
            @selection-change="onTypeSelectionChange"
            @row-click="onTypeRowClick"
            @loaded="onTypeLoaded"
          >
            <template #toolbar-left>
              <el-button v-hasPermi="['system:dict:add']" type="primary" @click="openTypeAdd">
                + {{ t('common.add') }}
              </el-button>
              <el-button
                v-hasPermi="['system:dict:remove']"
                plain
                :disabled="!typeSelected.length"
                @click="removeType()"
              >
                {{ t('common.delete') }}
              </el-button>
              <el-button plain @click="refreshCache">{{ t('common.refresh') }}</el-button>
            </template>

            <template #status="{ row }">
              <DictTag dict-type="sys_normal_disable" :value="row.status" />
            </template>

            <template #operation="{ row }">
              <el-button v-hasPermi="['system:dict:edit']" link type="primary" @click.stop="openTypeEdit(row as DictType)">
                <el-icon><Edit /></el-icon>{{ t('common.edit') }}
              </el-button>
              <el-button v-hasPermi="['system:dict:remove']" link type="danger" @click.stop="removeType(row.dictId)">
                {{ t('common.delete') }}
              </el-button>
            </template>
          </ProTable>
        </div>
      </el-col>

      <el-col :span="14" :xs="24">
        <div class="wb-card wb-card--fill">
          <div class="wb-dict__data-title wb-flex-between">
            <span>
              {{ t('dict.dataTitle') }}
              <span v-if="currentDictType" class="wb-text-muted">· {{ currentTypeName }}（{{ currentDictType }}）</span>
            </span>
            <span v-if="!currentDictType" class="wb-text-muted">{{ t('common.noData') }}</span>
          </div>

          <ProTable
            ref="dataTableRef"
            row-key="dictCode"
            :columns="dataColumns"
            :request="dataRequest"
            :selection="true"
            export-name="dict-data"
            print-title="字典数据列表"
            @selection-change="onDataSelectionChange"
          >
            <template #toolbar-left>
              <el-button v-hasPermi="['system:dict:add']" type="primary" @click="openDataAdd">
                + {{ t('common.add') }}
              </el-button>
              <el-button
                v-hasPermi="['system:dict:remove']"
                plain
                :disabled="!dataSelected.length"
                @click="removeData()"
              >
                {{ t('common.delete') }}
              </el-button>
            </template>

            <template #isDefault="{ row }">
              <el-switch
                :model-value="row.isDefault === 'Y'"
                :disabled="!hasPermi(['system:dict:edit'])"
                @change="
                  async (v: any) => {
                    await dictApi.dataUpdate({
                      dictCode: row.dictCode,
                      dictType: row.dictType,
                      isDefault: Boolean(v) ? 'Y' : 'N'
                    })
                    await dictApi.refreshCache()
                    dictStore.clearCache()
                    ElMessage.success(t('common.success'))
                    dataTableRef?.refresh()
                  }
                "
              />
            </template>

            <template #status="{ row }">
              <DictTag dict-type="sys_normal_disable" :value="row.status" />
            </template>

            <template #operation="{ row }">
              <el-button v-hasPermi="['system:dict:edit']" link type="primary" @click="openDataEdit(row)">
                <el-icon><Edit /></el-icon>{{ t('common.edit') }}
              </el-button>
              <el-button v-hasPermi="['system:dict:remove']" link type="danger" @click="removeData(row.dictCode)">
                {{ t('common.delete') }}
              </el-button>
            </template>
          </ProTable>
        </div>
      </el-col>
    </el-row>

    <!-- 字典类型表单 -->
    <ProDialog v-model="typeFormVisible" :title="typeFormTitle" width="600px" :loading="submitting" @confirm="submitTypeForm">
      <el-form :model="typeForm" label-width="90px">
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item :label="t('dict.typeName')" prop="dictName">
              <el-input v-model="typeForm.dictName" clearable />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('dict.typeKey')" prop="dictType">
              <el-input v-model="typeForm.dictType" :disabled="!!currentTypeId" clearable />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item :label="t('common.status')" prop="status">
              <el-radio-group v-model="typeForm.status">
                <el-radio value="0">{{ t('common.enabled') }}</el-radio>
                <el-radio value="1">{{ t('common.disabled') }}</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item :label="t('common.remark')" prop="remark">
              <el-input v-model="typeForm.remark" type="textarea" :rows="3" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
    </ProDialog>

    <!-- 字典数据表单 -->
    <ProDialog v-model="dataFormVisible" :title="dataFormTitle" width="640px" :loading="submitting" @confirm="submitDataForm">
      <el-form :model="dataForm" label-width="90px">
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item :label="t('dict.label')" prop="dictLabel">
              <el-input v-model="dataForm.dictLabel" clearable />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('dict.value')" prop="dictValue">
              <el-input v-model="dataForm.dictValue" clearable />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('dict.sort')" prop="dictSort">
              <el-input-number v-model="dataForm.dictSort" :min="1" controls-position="right" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('dict.class')" prop="listClass">
              <el-select v-model="dataForm.listClass" style="width: 100%">
                <el-option
                  v-for="opt in listClassOptions"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('dict.default')" prop="isDefault">
              <el-radio-group v-model="dataForm.isDefault">
                <el-radio value="Y">{{ t('common.yes') }}</el-radio>
                <el-radio value="N">{{ t('common.no') }}</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('common.status')" prop="status">
              <el-radio-group v-model="dataForm.status">
                <el-radio value="0">{{ t('common.enabled') }}</el-radio>
                <el-radio value="1">{{ t('common.disabled') }}</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item :label="t('common.remark')" prop="remark">
              <el-input v-model="dataForm.remark" type="textarea" :rows="3" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
    </ProDialog>
  </div>
</template>

<style scoped lang="scss">
.wb-dict {
  &__search {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: var(--wb-gap, 12px);
    /* 撑满型卡片里：工具行固定，剩余高度全部给表格 */
    flex: none;
  }

  &__data-title {
    margin-bottom: var(--wb-gap, 12px);
    font-size: 15px;
    font-weight: 600;
    flex: none;
  }
}
</style>
