# ProTable 高级表格

**设计原则：配置 + 插槽，绝不做黑盒。** 列由 props 声明，单元格由插槽渲染，你需要 `el-table-column` 的任何原生能力都能透传。

## 最简用法

```vue
<script setup lang="ts">
import type { ProTableColumn } from '@/components/ProTable/types'

const columns: ProTableColumn[] = [
  { label: 'ID', prop: 'id', width: 90 },
  { label: '名称', prop: 'name', minWidth: 160 },
  { label: '状态', prop: 'status', slot: 'status', width: 100 },
  { label: '操作', prop: 'operation', slot: 'operation', width: 180, fixed: 'right' }
]

async function request(params: Record<string, any>) {
  const res = await myApi.list(params)
  return { list: res.list ?? [], total: res.total ?? 0 }
}
</script>

<template>
  <ProTable :columns="columns" :request="request" row-key="id">
    <template #status="{ row }">
      <DictTag :value="row.status" dict-type="sys_normal_disable" />
    </template>
    <template #operation="{ row }">
      <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
    </template>
  </ProTable>
</template>
```

## props

| prop | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `columns` | `ProTableColumn[]` | 必填 | 列配置 |
| `request` | `(params) => Promise<{list,total}>` | 必填 | 数据源，组件负责分页参数 |
| `rowKey` | `string` | `id` | 行唯一键 |
| `selection` | `boolean` | `false` | 是否显示多选列 |
| `showIndex` | `boolean` | `true` | 是否显示序号列 |
| `stripe` | `boolean` | `true` | 斑马纹 |
| `border` | `boolean` | `false` | 边框 |
| `height` | `string \| number` | — | 固定表头高度 |
| `expandAll` | `boolean` | `false` | 树表默认全展开 |
| `childrenField` | `string` | — | 树表子节点字段（如 `children`） |
| `showRefresh` | `boolean` | `true` | 显示刷新按钮 |
| `exportName` | `string` | — | 传了才显示导出按钮，值作为文件名 |
| `printTitle` | `string` | — | 传了才显示打印按钮 |
| `initParams` | `object` | — | 首次查询的附加参数 |

## 列配置

```ts
interface ProTableColumn {
  label: string
  prop: string
  width?: number | string
  minWidth?: number | string
  align?: 'left' | 'center' | 'right'
  sortable?: boolean | 'custom'
  fixed?: 'left' | 'right' | boolean
  hidden?: boolean          // 默认隐藏，列设置里可勾回来
  slot?: string             // 渲染该列用的插槽名
  formatter?: (row: any) => string
  children?: ProTableColumn[]   // 多级表头
}
```

## 暴露的方法（`ref`）

```ts
const tableRef = ref()
tableRef.value.reload()                 // 回到第一页重新查
tableRef.value.refresh()                // 保持当前页重新查
tableRef.value.getSelection()           // 当前选中行
tableRef.value.exportExcel()            // 手动触发导出
tableRef.value.clearSelection()
```

## 事件

| 事件 | 参数 | 说明 |
| --- | --- | --- |
| `selection-change` | `rows` | 多选变化 |
| `row-click` | `row` | 行点击 |
| `sort-change` | `{ prop, order }` | 排序变化（需自行把参数拼进 request） |

## 列设置

工具栏右侧的齿轮按钮打开列设置：勾选显隐、上下移动调序、设置左右固定。用户拖出来的顺序与显隐**不会**自动持久化到 localStorage——需要持久化的话监听 `change` 事件自己存。

## 树形表格

```vue
<ProTable :columns="columns" :request="request" row-key="deptId" children-field="children" />
```

后端返回嵌套 `children` 即可，不必拍平。

## 内嵌工具栏

```vue
<ProTable :columns="columns" :request="request" export-name="用户列表.xlsx">
  <template #toolbar-left>
    <el-button type="primary" @click="openAdd">新增</el-button>
    <el-button type="danger" :disabled="!selected.length">批量删除</el-button>
  </template>
  <template #toolbar-right>
    <el-button @click="doImport">导入</el-button>
  </template>
</ProTable>
```
