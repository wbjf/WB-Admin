<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { CirclePlus, Edit, Plus } from '@element-plus/icons-vue'
import ProTable from '@/components/ProTable/index.vue'
import ProDialog from '@/components/ProDialog.vue'
import IconSelect from '@/components/IconSelect/index.vue'
import type { TableColumn } from '@/components/ProTable/types'
import { menuApi, type MenuQuery } from '@/api/menu'
import { useI18n } from 'vue-i18n'
import type { MenuInfo } from '@/types'

defineOptions({ name: 'SystemMenu' })

const { t } = useI18n()

/** ---------- 查询条件（自定义 el-form） ---------- */
const queryParams = reactive<MenuQuery>({})

function resetQuery(): void {
  queryParams.menuName = undefined
  queryParams.status = undefined
}

/** ---------- 数据 ---------- */
const menuList = ref<MenuInfo[]>([])

async function loadMenus(): Promise<void> {
  menuList.value = (await menuApi.list({})) ?? []
}

/** 后端返回的是整棵树，关键字 / 状态在本地过滤，命中子节点时保留父节点 */
function filterTree(nodes: MenuInfo[], keyword: string, status: string): MenuInfo[] {
  const out: MenuInfo[] = []
  nodes.forEach((node) => {
    const children = filterTree(node.children ?? [], keyword, status)
    const selfMatched =
      (!keyword || node.title.includes(keyword)) && (!status || (node.status ?? '0') === status)
    if (selfMatched || children.length) {
      out.push({ ...node, children: children.length ? children : undefined })
    }
  })
  return out
}

const tableData = computed(() => filterTree(menuList.value, queryParams.menuName ?? '', queryParams.status ?? ''))

/** ---------- 表格 ---------- */
const expandAll = ref(true)
const tableKey = ref(0)
const tableRef = ref<any>(null)

const columns = ref<TableColumn[]>([
  { label: t('menuMgmt.name'), prop: 'title', minWidth: 180, sortable: false },
  { label: t('menuMgmt.icon'), prop: 'icon', slot: 'icon', width: 90, sortable: false },
  { label: t('common.sort'), prop: 'sort', width: 90, sortable: false },
  { label: t('menuMgmt.perms'), prop: 'perms', minWidth: 160, sortable: false },
  { label: t('menuMgmt.component'), prop: 'component', minWidth: 180, sortable: false },
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
const form = reactive<Partial<MenuInfo>>({})

const treeProps = { children: 'children', label: 'title' }
/** 上级菜单下拉：补一个顶级节点，保证 parentId 为 0 的菜单也能回显 */
const parentOptions = computed(() => [{ id: '0', title: '顶级菜单', children: menuList.value }] as MenuInfo[])

const typeOptions = computed(() => [
  { label: t('menuMgmt.typeDir'), value: 'M' },
  { label: t('menuMgmt.typeMenu'), value: 'C' },
  { label: t('menuMgmt.typeButton'), value: 'F' }
])

/** F 按钮只需要名称 + 权限标识 */
const isButton = computed(() => form.type === 'F')

async function openAdd(row?: MenuInfo): Promise<void> {
  currentId.value = ''
  Object.assign(form, {
    parentId: row?.id ?? '0',
    type: row ? 'C' : 'M',
    title: '',
    icon: '',
    path: '',
    component: '',
    perms: '',
    sort: 1,
    visible: '0',
    status: '0',
    isCache: '0',
    isFrame: '1'
  })
  formTitle.value = `${t('common.add')}${t('menu.menu')}`
  formVisible.value = true
}

async function openEdit(row: MenuInfo): Promise<void> {
  currentId.value = row.id
  const detail = await menuApi.detail(row.id)
  Object.assign(form, detail, { parentId: detail?.parentId ?? row.parentId })
  formTitle.value = `${t('common.edit')}${t('menu.menu')}`
  formVisible.value = true
}

async function submitForm(): Promise<void> {
  submitting.value = true
  try {
    const payload: Partial<MenuInfo> = {
      ...form,
      // 路由名称缺失时用菜单名称兜底，保证动态路由可正常注册
      name: form.name || form.title
    }
    if (currentId.value) {
      await menuApi.update({ ...payload, id: currentId.value })
    } else {
      await menuApi.add(payload)
    }
    ElMessage.success(t('common.success'))
    formVisible.value = false
    await loadMenus()
  } catch (e: any) {
    ElMessage.error(e?.message || t('common.failed'))
  } finally {
    submitting.value = false
  }
}

/** ---------- 操作 ---------- */
async function remove(row: MenuInfo): Promise<void> {
  if (row.children?.length) {
    ElMessage.warning('存在下级菜单，请先删除下级') // zh-CN.ts 未收录该提示，按约定直接写中文
    return
  }
  try {
    await ElMessageBox.confirm(t('common.confirmDelete'), t('common.tip'), { type: 'warning' })
  } catch {
    return
  }
  await menuApi.remove(row.id)
  ElMessage.success(t('common.success'))
  await loadMenus()
}

loadMenus()
</script>

<template>
  <div class="wb-page wb-menu">
    <!-- 搜索区：菜单接口返回整棵树，这里用自定义 el-form 做本地检索 -->
    <el-form :model="queryParams" class="wb-card wb-menu__search" label-width="70px" @submit.prevent>
      <el-row :gutter="16">
        <el-col :span="6" :xs="24">
          <el-form-item :label="t('menuMgmt.name')">
            <el-input v-model="queryParams.menuName" :placeholder="t('common.searchPlaceholder')" clearable />
          </el-form-item>
        </el-col>
        <el-col :span="6" :xs="24">
          <el-form-item :label="t('common.status')">
            <el-select v-model="queryParams.status" :placeholder="t('common.status')" clearable style="width: 100%">
              <el-option :label="t('common.enabled')" value="0" />
              <el-option :label="t('common.disabled')" value="1" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="6" :xs="24">
          <el-button type="primary" @click="loadMenus">{{ t('common.query') }}</el-button>
          <el-button @click="resetQuery">{{ t('common.reset') }}</el-button>
        </el-col>
      </el-row>
    </el-form>

    <div class="wb-card">
      <ProTable
        :key="tableKey"
        ref="tableRef"
        row-key="id"
        children-field="children"
        :show-index="false"
        :selection="false"
        :pagination="false"
        :expand-all="expandAll"
        :columns="columns"
        :data="tableData"
        export-name="menu"
        print-title="菜单列表"
      >
        <template #toolbar-left>
          <el-button v-hasPermi="['system:menu:add']" type="primary" @click="openAdd()">
            <el-icon><Plus /></el-icon>{{ t('common.add') }}
          </el-button>
          <!-- 展开/折叠：沿用已有的 role.expandAll（展开/折叠） -->
          <el-button plain @click="toggleExpandAll">{{ t('role.expandAll') }}</el-button>
        </template>

        <template #icon="{ row }">
          <el-icon v-if="row.icon"><component :is="row.icon" /></el-icon>
          <span v-else>-</span>
        </template>

        <template #status="{ row }">
          <el-tag :type="row.status === '1' ? 'danger' : 'success'" size="small" disable-transitions>
            {{ row.status === '1' ? t('common.disabled') : t('common.enabled') }}
          </el-tag>
        </template>

        <template #operation="{ row }">
          <el-button v-hasPermi="['system:menu:add']" link type="primary" @click="openAdd(row as MenuInfo)">
            <el-icon><CirclePlus /></el-icon>{{ t('common.add') }}
          </el-button>
          <el-button v-hasPermi="['system:menu:edit']" link type="primary" @click="openEdit(row as MenuInfo)">
            <el-icon><Edit /></el-icon>{{ t('common.edit') }}
          </el-button>
          <el-button v-hasPermi="['system:menu:remove']" link type="danger" @click="remove(row as MenuInfo)">
            {{ t('common.delete') }}
          </el-button>
        </template>
      </ProTable>
    </div>

    <ProDialog v-model="formVisible" :title="formTitle" width="720px" :loading="submitting" @confirm="submitForm">
      <el-form :model="form" label-width="100px">
        <el-row :gutter="12">
          <el-col :span="24">
            <el-form-item :label="t('menuMgmt.parent')" prop="parentId">
              <el-tree-select
                v-model="form.parentId"
                :data="parentOptions as any"
                :props="treeProps"
                node-key="id"
                check-strictly
                :render-after-expand="false"
                default-expand-all
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item :label="t('menuMgmt.type')" prop="type">
              <el-radio-group v-model="form.type">
                <el-radio v-for="opt in typeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('menuMgmt.name')" prop="title">
              <el-input v-model="form.title" clearable />
            </el-form-item>
          </el-col>
          <el-col v-if="!isButton" :span="12">
            <el-form-item :label="t('menuMgmt.icon')" prop="icon">
              <IconSelect v-model="form.icon" />
            </el-form-item>
          </el-col>
          <el-col v-if="!isButton" :span="12">
            <el-form-item :label="t('menuMgmt.path')" prop="path">
              <el-input v-model="form.path" clearable />
            </el-form-item>
          </el-col>
          <el-col v-if="!isButton" :span="12">
            <el-form-item :label="t('menuMgmt.component')" prop="component">
              <el-input v-model="form.component" placeholder="system/user/index" clearable />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('menuMgmt.perms')" prop="perms">
              <el-input v-model="form.perms" placeholder="system:user:list" clearable />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('common.sort')" prop="sort">
              <el-input-number v-model="form.sort" :min="1" controls-position="right" style="width: 100%" />
            </el-form-item>
          </el-col>
          <!-- 显示状态：显示 / 隐藏（zh-CN.ts 未收录，按约定直接写中文） -->
          <el-col v-if="!isButton" :span="12">
            <el-form-item :label="t('menuMgmt.visible')" prop="visible">
              <el-radio-group v-model="form.visible">
                <el-radio value="0">显示</el-radio>
                <el-radio value="1">隐藏</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
          <el-col v-if="!isButton" :span="12">
            <el-form-item :label="t('menuMgmt.cache')" prop="isCache">
              <el-radio-group v-model="form.isCache">
                <el-radio value="0">{{ t('common.no') }}</el-radio>
                <el-radio value="1">{{ t('common.yes') }}</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
          <el-col v-if="!isButton" :span="12">
            <el-form-item :label="t('menuMgmt.frame')" prop="isFrame">
              <el-radio-group v-model="form.isFrame">
                <el-radio value="0">{{ t('common.yes') }}</el-radio>
                <el-radio value="1">{{ t('common.no') }}</el-radio>
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
        </el-row>
      </el-form>
    </ProDialog>
  </div>
</template>

<style scoped lang="scss">
.wb-menu {
  &__search {
    :deep(.el-form-item) {
      margin-bottom: 14px;
    }
  }
}
</style>
