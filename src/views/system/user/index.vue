<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox, ElTree, type FormItemRule } from 'element-plus'
import { Edit, Key, Search } from '@element-plus/icons-vue'
import type { FormSchema } from '@/components/ProForm/types'
import DeptSelect from '@/components/DeptSelect/index.vue'
import DictTag from '@/components/Dict/DictTag.vue'
import ProUpload from '@/components/ProUpload/index.vue'
import SearchForm from '@/components/SearchForm/index.vue'
import ProTable from '@/components/ProTable/index.vue'
import ProDialog from '@/components/ProDialog.vue'
import type { TableColumn } from '@/components/ProTable/types'
import { userApi, type UserQuery, type UserVO } from '@/api/user'
import { deptApi } from '@/api/dept'
import { roleApi } from '@/api/role'
import { postApi } from '@/api/post'
import { buildTree, addDateRange, flattenTree, toArray } from '@/utils'
import { download } from '@/utils/download'
import { hasPermi } from '@/utils/permission'
import { useI18n } from 'vue-i18n'
import type { DeptInfo, RoleInfo } from '@/types'

defineOptions({ name: 'SystemUser' })

const { t } = useI18n()

/** ---------- 左侧部门树 ---------- */
const deptTree = ref<DeptInfo[]>([])
const deptKeyword = ref('')
const currentDeptId = ref('')
const treeRef = ref<InstanceType<typeof ElTree>>()

const treeProps = { children: 'children', label: 'deptName' }

async function loadDeptTree(): Promise<void> {
  const list = toArray<DeptInfo>(await deptApi.list({}))
  deptTree.value = buildTree(list, { id: 'deptId', parentId: 'parentId', rootValue: '0' })
}

function onDeptNodeClick(node: DeptInfo): void {
  currentDeptId.value = node.deptId
  queryParams.deptId = node.deptId
  tableRef.value?.reload()
}

/** ---------- 查询条件 ---------- */
const queryParams = reactive<UserQuery & { dateRange?: [string, string] }>({})

const searchSchemas = computed<FormSchema[]>(() => [
  { prop: 'userName', label: t('user.name'), type: 'input' },
  { prop: 'phonenumber', label: t('user.phone'), type: 'input' },
  { prop: 'status', label: t('common.status'), type: 'dict', dictType: 'sys_normal_disable' },
  { prop: 'dateRange', label: t('common.dateRange'), type: 'daterange' }
])

/** ---------- 表格 ---------- */
const tableRef = ref<any>(null)
const selected = ref<UserVO[]>([])

const columns = ref<TableColumn[]>([
  { label: t('user.id'), prop: 'userId', width: 90 },
  { label: t('user.name'), prop: 'userName', minWidth: 120 },
  { label: t('user.nick'), prop: 'nickName', minWidth: 120 },
  { label: t('user.dept'), prop: 'deptName', minWidth: 130 },
  { label: t('user.phone'), prop: 'phonenumber', minWidth: 130 },
  { label: t('common.status'), prop: 'status', slot: 'status', width: 90, sortable: false },
  { label: t('common.createTime'), prop: 'createTime', minWidth: 170 },
  { label: t('common.operate'), prop: 'operation', slot: 'operation', width: 240, fixed: 'right', sortable: false }
])

async function request(params: Record<string, any>): Promise<{ list: UserVO[]; total: number }> {
  const { dateRange, ...rest } = queryParams
  const finalParams = addDateRange(rest, dateRange ? ([dateRange[0], dateRange[1]] as [string, string]) : undefined)
  const res = await userApi.list({ ...finalParams, ...params })
  return { list: res.list ?? [], total: res.total ?? 0 }
}

function onSelectionChange(rows: UserVO[]): void {
  selected.value = rows
}

/** ---------- 表单 ---------- */
const roles = ref<RoleInfo[]>([])
const posts = ref<any[]>([])

const formVisible = ref(false)
const formTitle = ref('')
const submitting = ref(false)
const currentId = ref('')
const form = reactive<Partial<UserVO>>({})

const formSchemas = computed<FormSchema[]>(() => [
  { prop: 'nickName', label: t('user.nick'), type: 'input', span: 12, required: true },
  { prop: 'deptId', label: t('user.dept'), type: 'slot', slot: 'dept', span: 12, required: true },
  { prop: 'phonenumber', label: t('user.phone'), type: 'input', span: 12 },
  { prop: 'email', label: t('user.email'), type: 'input', span: 12 },
  {
    prop: 'userName',
    label: t('user.name'),
    type: 'input',
    span: 12,
    required: true,
    hidden: !!currentId.value
  },
  {
    prop: 'password',
    label: t('user.password'),
    type: 'password',
    span: 12,
    hidden: !!currentId.value
  },
  { prop: 'sex', label: t('user.sex'), type: 'select', span: 12, options: [
    { label: t('user.sexMale'), value: '0' },
    { label: t('user.sexFemale'), value: '1' },
    { label: t('user.sexUnknown'), value: '2' }
  ] },
  { prop: 'status', label: t('common.status'), type: 'radio', span: 12, options: [
    { label: t('common.enabled'), value: '0' },
    { label: t('common.disabled'), value: '1' }
  ] },
  { prop: 'postIds', label: t('user.post'), type: 'select', span: 12, props: { multiple: true }, options: posts.value.map((p) => ({ label: p.postName, value: p.postId })) },
  { prop: 'roleIds', label: t('user.role'), type: 'select', span: 12, props: { multiple: true }, options: roles.value.map((r) => ({ label: r.roleName, value: r.roleId })) },
  { prop: 'avatar', label: t('user.avatar'), type: 'slot', slot: 'avatar', span: 12 },
  { prop: 'remark', label: t('common.remark'), type: 'textarea', span: 24 }
])

const emailRule: FormItemRule[] = [
  { type: 'email', message: '邮箱格式不正确', trigger: 'blur' }
]

async function openAdd(): Promise<void> {
  currentId.value = ''
  Object.assign(form, {
    status: '0',
    sex: '0',
    roleIds: [],
    postIds: [],
    deptId: currentDeptId.value || undefined
  })
  formTitle.value = `${t('common.add')}${t('menu.user')}`
  formVisible.value = true
}

async function openEdit(row: UserVO): Promise<void> {
  currentId.value = row.userId
  const detail = await userApi.detail(row.userId)
  Object.assign(form, detail, {
    roleIds: detail.roles?.map((r) => r.roleId) ?? [],
    postIds: detail.postIds ?? []
  })
  formTitle.value = `${t('common.edit')}${t('menu.user')}`
  formVisible.value = true
}

async function submitForm(): Promise<void> {
  submitting.value = true
  try {
    if (currentId.value) {
      await userApi.update({ ...form, userId: currentId.value })
    } else {
      await userApi.add(form)
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
  const targets = ids ?? selected.value.map((u) => u.userId).join(',')
  if (!targets) {
    ElMessage.warning(t('common.selectAtLeastOne'))
    return
  }
  try {
    await ElMessageBox.confirm(t('common.confirmDelete'), t('common.tip'), { type: 'warning' })
  } catch {
    return
  }
  await userApi.remove(targets.split(','))
  ElMessage.success(t('common.success'))
  tableRef.value?.reload()
}

async function resetPwd(row: UserVO): Promise<void> {
  const { value } = await ElMessageBox.prompt(`${t('user.resetTip')}`, t('user.resetPassword'), {
    inputValue: '123456',
    confirmButtonText: t('common.confirm'),
    cancelButtonText: t('common.cancel')
  })
  await userApi.resetPwd(row.userId, value)
  ElMessage.success(t('common.success'))
}

async function exportData(): Promise<void> {
  await download('/system/user/export', { method: 'post', data: { ...queryParams }, filename: 'user' })
}

function printTable(): void {
  ElMessage.success('已在打印预览区展开，可用浏览器打印/PDF 导出')
}

loadDeptTree()
roleApi.all().then((r) => (roles.value = toArray<RoleInfo>(r)))
postApi.list({ pageSize: 100 }).then((r) => (posts.value = toArray(r)))

const flatDepts = computed(() => flattenTree(deptTree.value, 'children'))
</script>

<template>
  <div class="wb-page wb-user">
    <el-row :gutter="12">
      <el-col :span="5" :xs="24">
        <div class="wb-card wb-card--fill">
          <el-input v-model="deptKeyword" :placeholder="t('dept.searchPlaceholder')" clearable size="default">
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
          <el-tree
            ref="treeRef"
            :data="deptTree as any"
            :props="treeProps"
            node-key="deptId"
            :filter-node-method="(value: string, data: any) => !value || data.deptName.includes(value)"
            default-expand-all
            highlight-current
            class="wb-user__tree"
            @node-click="onDeptNodeClick"
          />
        </div>
      </el-col>

      <el-col :span="19" :xs="24">
        <SearchForm v-model="queryParams" :schemas="searchSchemas" @search="tableRef?.reload()" />

        <div class="wb-card wb-card--fill">
          <ProTable
            ref="tableRef"
            row-key="userId"
            :columns="columns"
            :request="request"
            :selection="true"
            export-name="user"
            print-title="用户列表"
            @selection-change="onSelectionChange"
          >
            <template #toolbar-left>
              <el-button v-hasPermi="['system:user:add']" type="primary" @click="openAdd">
                + {{ t('common.add') }}
              </el-button>
              <el-button v-hasPermi="['system:user:remove']" plain :disabled="!selected.length" @click="remove()">
                {{ t('common.delete') }}
              </el-button>
              <el-button plain @click="printTable">{{ t('common.print') }}</el-button>
            </template>

            <template #toolbar-right>
              <el-button v-hasPermi="['system:user:export']" plain @click="exportData">
                {{ t('common.export') }}
              </el-button>
            </template>

            <template #status="{ row }">
              <el-switch
                :model-value="row.status === '0'"
                :disabled="!hasPermi(['system:user:edit'])"
                @change="
                  async (v: any) => {
                    await userApi.changeStatus(row.userId, Boolean(v) ? '0' : '1')
                    ElMessage.success(t('common.success'))
                  }
                "
              />
            </template>

            <template #operation="{ row }">
              <el-button v-hasPermi="['system:user:edit']" link type="primary" @click="openEdit(row as UserVO)">
                <el-icon><Edit /></el-icon>{{ t('common.edit') }}
              </el-button>
              <el-button v-hasPermi="['system:user:resetPwd']" link type="warning" @click="resetPwd(row as UserVO)">
                <el-icon><Key /></el-icon>{{ t('user.resetPassword') }}
              </el-button>
              <el-button v-hasPermi="['system:user:remove']" link type="danger" @click="remove(row.userId)">
                {{ t('common.delete') }}
              </el-button>
            </template>
          </ProTable>
        </div>
      </el-col>
    </el-row>

    <ProDialog v-model="formVisible" :title="formTitle" width="760px" :loading="submitting" @confirm="submitForm">
      <el-form :model="form" label-width="90px">
        <el-row :gutter="12">
          <template v-for="schema in formSchemas" :key="schema.prop">
            <el-col v-if="!schema.hidden" :span="schema.span ?? 12">
              <el-form-item :label="schema.label" :prop="schema.prop" :rules="schema.prop === 'email' ? emailRule : undefined">
                <slot v-if="schema.type === 'slot'" :name="schema.slot" />
                <DeptSelect v-if="schema.prop === 'deptId'" v-model="form.deptId!" style="width: 100%" />
                <ProUpload
                  v-else-if="schema.prop === 'avatar'"
                  v-model="form.avatar"
                  list-type="picture-card"
                  style="width: 100%"
                />
                <el-select
                  v-else-if="schema.type === 'select'"
                  v-model="(form as any)[schema.prop]"
                  :multiple="schema.props?.multiple"
                  clearable
                  style="width: 100%"
                >
                  <el-option v-for="opt in schema.options" :key="String(opt.value)" :label="opt.label" :value="opt.value" />
                </el-select>
                <el-radio-group v-else-if="schema.type === 'radio'" v-model="(form as any)[schema.prop]">
                  <el-radio v-for="opt in schema.options" :key="String(opt.value)" :value="opt.value">{{ opt.label }}</el-radio>
                </el-radio-group>
                <el-input
                  v-else-if="schema.type === 'textarea'"
                  v-model="(form as any)[schema.prop]"
                  type="textarea"
                  :rows="3"
                />
                <el-input v-else v-model="(form as any)[schema.prop]" :type="schema.type === 'password' ? 'password' : 'text'" clearable />
              </el-form-item>
            </el-col>
          </template>
        </el-row>
        <div class="wb-text-muted" style="font-size: 12px">
          共 {{ flatDepts.length }} 个部门 · 演示环境可直接提交
        </div>
      </el-form>
    </ProDialog>

    <div class="wb-card wb-mt12" v-if="false">
      <DictTag dict-type="sys_normal_disable" value="0" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.wb-user {
  /**
   * 树区撑满卡片剩余高度并在内部滚动。
   * 原来写的是 max-height: calc(100vh - 260px)，既没让卡片背景撑满，
   * 数值也随导航栏/tags/页脚高度漂移 —— 交给 flex 计算。
   */
  &__tree {
    margin-top: 10px;
    flex: 1;
    min-height: 0;
    overflow: auto;
  }
}
</style>
