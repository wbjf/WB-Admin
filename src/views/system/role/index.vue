<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox, ElTree } from 'element-plus'
import { Edit, Key } from '@element-plus/icons-vue'
import type { FormSchema } from '@/components/ProForm/types'
import SearchForm from '@/components/SearchForm/index.vue'
import ProTable from '@/components/ProTable/index.vue'
import ProDialog from '@/components/ProDialog.vue'
import type { TableColumn } from '@/components/ProTable/types'
import { roleApi, type RoleQuery, type RoleVO } from '@/api/role'
import { menuApi } from '@/api/menu'
import { deptApi } from '@/api/dept'
import { addDateRange, buildTree, toArray } from '@/utils'
import { download } from '@/utils/download'
import { hasPermi } from '@/utils/permission'
import { useI18n } from 'vue-i18n'
import type { DataScopeType, DeptInfo, MenuInfo } from '@/types'

defineOptions({ name: 'SystemRole' })

const { t } = useI18n()

/** ---------- 查询条件 ---------- */
const queryParams = reactive<RoleQuery & { dateRange?: [string, string] }>({})

const searchSchemas = computed<FormSchema[]>(() => [
  { prop: 'roleName', label: t('role.name'), type: 'input' },
  { prop: 'roleKey', label: t('role.key'), type: 'input' },
  { prop: 'status', label: t('common.status'), type: 'dict', dictType: 'sys_normal_disable' },
  { prop: 'dateRange', label: t('common.dateRange'), type: 'daterange' }
])

/** ---------- 表格 ---------- */
const tableRef = ref<any>(null)
const selected = ref<RoleVO[]>([])

const columns = ref<TableColumn[]>([
  { label: t('role.id'), prop: 'roleId', width: 100 },
  { label: t('role.name'), prop: 'roleName', minWidth: 130 },
  { label: t('role.key'), prop: 'roleKey', minWidth: 130 },
  { label: t('role.sort'), prop: 'roleSort', width: 100, sortable: false },
  { label: t('common.status'), prop: 'status', slot: 'status', width: 100, sortable: false },
  { label: t('common.remark'), prop: 'remark', minWidth: 160, sortable: false },
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

async function request(params: Record<string, any>): Promise<{ list: RoleVO[]; total: number }> {
  const { dateRange, ...rest } = queryParams
  const finalParams = addDateRange(rest, dateRange ? ([dateRange[0], dateRange[1]] as [string, string]) : undefined)
  const res = await roleApi.list({ ...finalParams, ...params })
  return { list: res?.list ?? [], total: res?.total ?? 0 }
}

function onSelectionChange(rows: RoleVO[]): void {
  selected.value = rows
}

/** ---------- 菜单树 / 部门树 ---------- */
const menuTree = ref<MenuInfo[]>([])
const menuTreeProps = { children: 'children', label: 'title' }
const menuTreeRef = ref<InstanceType<typeof ElTree>>()
const menuCheckedKeys = ref<string[]>([])

const deptList = ref<DeptInfo[]>([])
const deptTreeProps = { children: 'children', label: 'deptName' }
const deptTreeRef = ref<InstanceType<typeof ElTree>>()
const deptTree = computed(() => buildTree(deptList.value, { id: 'deptId', parentId: 'parentId', rootValue: '0' }))

async function loadMenuTree(): Promise<void> {
  menuTree.value = (await menuApi.userMenus()) ?? []
}

async function loadDepts(): Promise<void> {
  // 后端对 /system/dept/list 同时支持「分页对象 / 纯数组」两种返回，这里统一取数组
  deptList.value = toArray<DeptInfo>(await deptApi.list({}))
}

/** ---------- 表单 ---------- */
const formVisible = ref(false)
const formTitle = ref('')
const submitting = ref(false)
const currentId = ref('')
const form = reactive<Partial<RoleVO>>({})

const dataScopeOptions = computed(() => [
  { label: t('role.scopeAll'), value: '1' },
  { label: t('role.scopeCustom'), value: '2' },
  { label: t('role.scopeDept'), value: '3' },
  { label: t('role.scopeDeptBelow'), value: '4' },
  { label: t('role.scopeSelf'), value: '5' }
])

async function openAdd(): Promise<void> {
  currentId.value = ''
  Object.assign(form, { roleName: '', roleKey: '', roleSort: 1, status: '0', remark: '' })
  menuCheckedKeys.value = []
  formTitle.value = `${t('common.add')}${t('menu.role')}`
  formVisible.value = true
}

async function openEdit(row: RoleVO): Promise<void> {
  currentId.value = row.roleId
  const detail = await roleApi.detail(row.roleId)
  Object.assign(form, detail)
  menuCheckedKeys.value = detail?.menuIds ?? []
  formTitle.value = `${t('common.edit')}${t('menu.role')}`
  formVisible.value = true
}

/** 勾选结果 = 全选中的叶子 + 半选中的父节点 */
function checkedMenuIds(): string[] {
  const tree = menuTreeRef.value
  if (!tree) return []
  return [...tree.getCheckedKeys(false), ...tree.getHalfCheckedKeys()].map((k) => String(k))
}

async function submitForm(): Promise<void> {
  submitting.value = true
  try {
    const payload = { ...form, menuIds: checkedMenuIds() }
    if (currentId.value) {
      await roleApi.update({ ...payload, roleId: currentId.value })
    } else {
      await roleApi.add(payload)
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

/** ---------- 数据权限 ---------- */
const scopeVisible = ref(false)
const scopeRoleId = ref('')
const scopeForm = reactive<{ dataScope: DataScopeType; deptIds: string[] }>({ dataScope: '1', deptIds: [] })

async function openDataScope(row: RoleVO): Promise<void> {
  scopeRoleId.value = row.roleId
  const detail = await roleApi.detail(row.roleId)
  scopeForm.dataScope = detail?.dataScope ?? '1'
  scopeForm.deptIds = detail?.deptIds ?? []
  scopeVisible.value = true
}

function checkedDeptIds(): string[] {
  const tree = deptTreeRef.value
  if (!tree) return scopeForm.deptIds
  return [...tree.getCheckedKeys(false), ...tree.getHalfCheckedKeys()].map((k) => String(k))
}

async function submitDataScope(): Promise<void> {
  submitting.value = true
  try {
    await roleApi.setDataScope(scopeRoleId.value, scopeForm.dataScope, checkedDeptIds())
    ElMessage.success(t('common.success'))
    scopeVisible.value = false
    tableRef.value?.reload()
  } catch (e: any) {
    ElMessage.error(e?.message || t('common.failed'))
  } finally {
    submitting.value = false
  }
}

/** ---------- 操作 ---------- */
async function remove(ids?: string): Promise<void> {
  const targets = ids ?? selected.value.map((r) => r.roleId).join(',')
  if (!targets) {
    ElMessage.warning(t('common.selectAtLeastOne'))
    return
  }
  try {
    await ElMessageBox.confirm(t('common.confirmDelete'), t('common.tip'), { type: 'warning' })
  } catch {
    return
  }
  await roleApi.remove(targets.split(','))
  ElMessage.success(t('common.success'))
  tableRef.value?.reload()
}

async function exportData(): Promise<void> {
  await download('/system/role/export', { method: 'post', data: { ...queryParams }, filename: 'role' })
}

loadMenuTree()
loadDepts()
</script>

<template>
  <div class="wb-page wb-role">
    <SearchForm v-model="queryParams" :schemas="searchSchemas" @search="tableRef?.reload()" />

    <div class="wb-card">
      <ProTable
        ref="tableRef"
        row-key="roleId"
        :columns="columns"
        :request="request"
        :selection="true"
        export-name="role"
        print-title="角色列表"
        @selection-change="onSelectionChange"
      >
        <template #toolbar-left>
          <el-button v-hasPermi="['system:role:add']" type="primary" @click="openAdd">
            + {{ t('common.add') }}
          </el-button>
          <el-button v-hasPermi="['system:role:remove']" plain :disabled="!selected.length" @click="remove()">
            {{ t('common.delete') }}
          </el-button>
        </template>

        <template #toolbar-right>
          <el-button v-hasPermi="['system:role:export']" plain @click="exportData">
            {{ t('common.export') }}
          </el-button>
        </template>

        <template #status="{ row }">
          <el-switch
            :model-value="row.status === '0'"
            :disabled="!hasPermi(['system:role:edit'])"
            @change="
              async (v: any) => {
                await roleApi.changeStatus(row.roleId, Boolean(v) ? '0' : '1')
                ElMessage.success(t('common.success'))
              }
            "
          />
        </template>

        <template #operation="{ row }">
          <el-button v-hasPermi="['system:role:edit']" link type="primary" @click="openEdit(row as RoleVO)">
            <el-icon><Edit /></el-icon>{{ t('common.edit') }}
          </el-button>
          <!-- 分配数据权限：文案沿用已有的 role.scope（数据范围） -->
          <el-button v-hasPermi="['system:role:edit']" link type="warning" @click="openDataScope(row as RoleVO)">
            <el-icon><Key /></el-icon>{{ t('role.scope') }}
          </el-button>
          <el-button v-hasPermi="['system:role:remove']" link type="danger" @click="remove(row.roleId)">
            {{ t('common.delete') }}
          </el-button>
        </template>
      </ProTable>
    </div>

    <ProDialog v-model="formVisible" :title="formTitle" width="720px" :loading="submitting" @confirm="submitForm">
      <el-form :model="form" label-width="90px">
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item :label="t('role.name')" prop="roleName">
              <el-input v-model="form.roleName" clearable />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('role.key')" prop="roleKey">
              <el-input v-model="form.roleKey" clearable />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('role.sort')" prop="roleSort">
              <el-input-number v-model="form.roleSort" :min="1" controls-position="right" style="width: 100%" />
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
            <el-form-item :label="t('role.menuPermission')" prop="menuIds">
              <el-tree
                ref="menuTreeRef"
                :data="menuTree as any"
                :props="menuTreeProps"
                node-key="id"
                show-checkbox
                :default-checked-keys="menuCheckedKeys"
                default-expand-all
                class="wb-role__tree"
              />
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

    <ProDialog
      v-model="scopeVisible"
      :title="t('role.scope')"
      width="560px"
      :loading="submitting"
      @confirm="submitDataScope"
    >
      <el-form :model="scopeForm" label-width="90px">
        <el-form-item :label="t('role.scope')" prop="dataScope">
          <el-select v-model="scopeForm.dataScope" style="width: 100%">
            <el-option
              v-for="opt in dataScopeOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item v-if="scopeForm.dataScope === '2'" :label="t('role.deptPermission')" prop="deptIds">
          <el-tree
            ref="deptTreeRef"
            :data="deptTree as any"
            :props="deptTreeProps"
            node-key="deptId"
            show-checkbox
            :default-checked-keys="scopeForm.deptIds"
            default-expand-all
            class="wb-role__tree"
          />
        </el-form-item>
      </el-form>
    </ProDialog>
  </div>
</template>

<style scoped lang="scss">
.wb-role {
  &__tree {
    width: 100%;
    max-height: 320px;
    overflow: auto;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 6px;
    padding: 6px;
  }
}
</style>
