# Composables

`src/composables/` 下是把「页面里反复出现的逻辑」抽成的组合式函数。

## useCrud

一个函数搞定表格 + 表单弹窗 + 增删改查。

```ts
import { useCrud } from '@/composables/useCrud'
import { myApi } from '@/api/my'

const {
  tableRef, loading, list, total, queryParams,
  selected, formVisible, formTitle, form, submitting, currentId,
  openAdd, openEdit, submit, remove, batchRemove, onSelectionChange
} = useCrud({
  api: myApi,
  rowKey: 'id',
  defaultForm: { status: '0' },
  nameKey: 'menu.my'
})
```

模板里：

```vue
<SearchForm v-model="queryParams" :schemas="searchSchemas" @search="tableRef?.reload()" />
<ProTable ref="tableRef" :columns="columns" :request="request" @selection-change="onSelectionChange">
  <template #operation="{ row }">
    <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
    <el-button link type="danger" @click="remove(row)">删除</el-button>
  </template>
</ProTable>
<ProDialog v-model="formVisible" :title="formTitle" @confirm="submit">…</ProDialog>
```

`remove` 自带二次确认与成功提示，不用每个页面再写一遍。

## useTable

只想要「查询参数 + 分页 + 排序」时用，比 useCrud 更轻。

```ts
const { queryParams, pagination, reset, onSortChange } = useTable({ pageSize: 20 })
```

## useDownload

统一导出，内置「确认框 → 下载 → 提示」流程。

```ts
const { exportExcel, download } = useDownload()

await exportExcel(() => myApi.export(params), '用户列表.xlsx')
await download('/system/user/export', params, '用户列表.xlsx')
```

## useDict

```ts
const { getLabel, getOptions, dict } = useDict('sys_normal_disable')
```

见 [DictSelect / DictTag](/components/dict)。

## usePermission

```ts
const { hasPermi, hasRole, isSuperAdmin } = usePermission()

if (hasPermi('system:user:add')) { /* … */ }
```

在 script 里做条件判断用它；在模板里做显隐优先用 `v-hasPermi` 指令。
