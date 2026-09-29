<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { CirclePlus, Edit, Plus } from '@element-plus/icons-vue'
import type { FormSchema } from '@/components/ProForm/types'
import SearchForm from '@/components/SearchForm/index.vue'
import ProTable from '@/components/ProTable/index.vue'
import ProDialog from '@/components/ProDialog.vue'
import type { TableColumn } from '@/components/ProTable/types'
import { deptApi, type DeptQuery } from '@/api/dept'
import { buildTree, toArray } from '@/utils'
import { useI18n } from 'vue-i18n'
import type { DeptInfo } from '@/types'

defineOptions({ name: 'SystemDept' })

const { t } = useI18n()

/** ---------- 查询条件 ---------- */
const queryParams = reactive<DeptQuery>({})

const searchSchemas = computed<FormSchema[]>(() => [
  { prop: 'deptName', label: t('dept.name'), type: 'input' },
  { prop: 'status', label: t('common.status'), type: 'dict', dictType: 'sys_normal_disable' }
])

/** ---------- 数据 ---------- */
const deptList = ref<DeptInfo[]>([])

async function loadDepts(): Promise<void> {
  // 后端对 /system/dept/list 同时支持「分页对象 / 纯数组」两种返回，这里统一取数组
  deptList.value = toArray<DeptInfo>(await deptApi.list({}))
}

function filterTree(nodes: DeptInfo[], keyword: string, status: string): DeptInfo[] {
  const out: DeptInfo[] = []
  nodes.forEach((node) => {
    const children = filterTree(node.children ?? [], keyword, status)
    const selfMatched =
      (!keyword || node.deptName.includes(keyword)) && (!status || (node.status ?? '0') === status)
    if (selfMatched || children.length) {
      out.push({ ...node, children: children.length ? children : undefined })
    }
  })
  return out
}

const deptTree = computed(() => buildTree(deptList.value, { id: 'deptId', parentId: 'parentId', rootValue: '0' }))

const tableData = computed(() => filterTree(deptTree.value, queryParams.deptName ?? '', queryParams.status ?? ''))

/** ---------- 表格 ---------- */
const expandAll = ref(true)
const tableKey = ref(0)

const columns = ref<TableColumn[]>([
  { label: t('dept.name'), prop: 'deptName', minWidth: 200, sortable: false },
  { label: t('dept.sort'), prop: 'orderNum', width: 100, sortable: false },
  { label: t('dept.leader'), prop: 'leader', width: 120, sortable: false },
  { label: t('dept.phone'), prop: 'phone', width: 140, sortable: false },
  { label: t('dept.email'), prop: 'email', minWidth: 180, sortable: false },
  { label: t('common.status'), prop: 'status', slot: 'status', width: 90, sortable: false },
  {
    label: t('common.operate'),
    prop: 'operation',
    slot: 'operation',
    width: 240,
    fixed: 'right',
    sortable: false
  }
])

function toggleExpandAll(): void {
  expandAll.value = !expandAll.value
  tableKey.value += 1
}

/** ---------- 表单 ---------- */
const formVisible = ref(false)
const formTitle = ref('')
const submitting = ref(false)
const currentId = ref('')
const form = reactive<Partial<DeptInfo>>({})

const treeProps = { children: 'children', label: 'deptName' }
/** 上级部门下拉：补一个顶级节点，保证 parentId 为 0 的部门也能回显 */
const parentOptions = computed(
  () => [{ deptId: '0', deptName: '顶级部门', children: deptTree.value }] as DeptInfo[]
)

async function openAdd(row?: DeptInfo): Promise<void> {
  currentId.value = ''
  Object.assign(form, {
    parentId: row?.deptId ?? '0',
    deptName: '',
    orderNum: 1,
    leader: '',
    phone: '',
    email: '',
    status: '0'
  })
  formTitle.value = `${t('common.add')}${t('menu.dept')}`
  formVisible.value = true
}

async function openEdit(row: DeptInfo): Promise<void> {
  currentId.value = row.deptId
  const detail = await deptApi.detail(row.deptId)
  Object.assign(form, detail, { parentId: detail?.parentId ?? row.parentId })
  formTitle.value = `${t('common.edit')}${t('menu.dept')}`
  formVisible.value = true
}

async function submitForm(): Promise<void> {
  submitting.value = true
  try {
    if (currentId.value) {
      await deptApi.update({ ...form, deptId: currentId.value })
    } else {
      await deptApi.add(form)
    }
    ElMessage.success(t('common.success'))
    formVisible.value = false
    await loadDepts()
  } catch (e: any) {
    ElMessage.error(e?.message || t('common.failed'))
  } finally {
    submitting.value = false
  }
}

/** ---------- 操作 ---------- */
async function remove(row: DeptInfo): Promise<void> {
  if (row.children?.length) {
    ElMessage.warning('存在下级部门，请先删除下级') // zh-CN.ts 未收录该提示，按约定直接写中文
    return
  }
  try {
    await ElMessageBox.confirm(t('common.confirmDelete'), t('common.tip'), { type: 'warning' })
  } catch {
    return
  }
  await deptApi.remove(row.deptId)
  ElMessage.success(t('common.success'))
  await loadDepts()
}

loadDepts()
</script>

<template>
  <div class="wb-page wb-dept">
    <SearchForm v-model="queryParams" :schemas="searchSchemas" @search="loadDepts()" />

    <div class="wb-card">
      <ProTable
        :key="tableKey"
        row-key="deptId"
        children-field="children"
        :show-index="false"
        :selection="false"
        :pagination="false"
        :expand-all="expandAll"
        :columns="columns"
        :data="tableData"
        export-name="dept"
        print-title="部门列表"
      >
        <template #toolbar-left>
          <el-button v-hasPermi="['system:dept:add']" type="primary" @click="openAdd()">
            <el-icon><Plus /></el-icon>{{ t('common.add') }}
          </el-button>
          <!-- 展开/折叠：沿用已有的 dept.expandAll（展开/折叠） -->
          <el-button plain @click="toggleExpandAll">{{ t('dept.expandAll') }}</el-button>
        </template>

        <template #status="{ row }">
          <el-tag :type="row.status === '1' ? 'danger' : 'success'" size="small" disable-transitions>
            {{ row.status === '1' ? t('common.disabled') : t('common.enabled') }}
          </el-tag>
        </template>

        <template #operation="{ row }">
          <el-button v-hasPermi="['system:dept:add']" link type="primary" @click="openAdd(row as DeptInfo)">
            <el-icon><CirclePlus /></el-icon>{{ t('common.add') }}
          </el-button>
          <el-button v-hasPermi="['system:dept:edit']" link type="primary" @click="openEdit(row as DeptInfo)">
            <el-icon><Edit /></el-icon>{{ t('common.edit') }}
          </el-button>
          <el-button v-hasPermi="['system:dept:remove']" link type="danger" @click="remove(row as DeptInfo)">
            {{ t('common.delete') }}
          </el-button>
        </template>
      </ProTable>
    </div>

    <ProDialog v-model="formVisible" :title="formTitle" width="640px" :loading="submitting" @confirm="submitForm">
      <el-form :model="form" label-width="90px">
        <el-row :gutter="12">
          <el-col :span="24">
            <!-- 上级部门：zh-CN.ts 未收录该文案，按约定直接写中文 -->
            <el-form-item label="上级部门" prop="parentId">
              <el-tree-select
                v-model="form.parentId"
                :data="parentOptions as any"
                :props="treeProps"
                node-key="deptId"
                check-strictly
                :render-after-expand="false"
                default-expand-all
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('dept.name')" prop="deptName">
              <el-input v-model="form.deptName" clearable />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('dept.sort')" prop="orderNum">
              <el-input-number v-model="form.orderNum" :min="1" controls-position="right" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('dept.leader')" prop="leader">
              <el-input v-model="form.leader" clearable />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('dept.phone')" prop="phone">
              <el-input v-model="form.phone" clearable />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('dept.email')" prop="email">
              <el-input v-model="form.email" clearable />
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
        </el-row>
      </el-form>
    </ProDialog>
  </div>
</template>

<style scoped lang="scss">
.wb-dept {
  &__tree {
    width: 100%;
    max-height: 320px;
    overflow: auto;
  }
}
</style>
