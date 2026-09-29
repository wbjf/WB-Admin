# SearchForm 查询区

表格上方的查询条件区。字段一多就自动折叠，避免把表格挤下去。

## 用法

```vue
<script setup lang="ts">
const queryParams = reactive({ userName: '', status: '', dateRange: [] })

const searchSchemas: FormSchema[] = [
  { prop: 'userName', label: '用户名', type: 'input' },
  { prop: 'phonenumber', label: '手机号', type: 'input' },
  { prop: 'status', label: '状态', type: 'dict', dictType: 'sys_normal_disable' },
  { prop: 'dateRange', label: '创建时间', type: 'daterange' }
]
</script>

<template>
  <SearchForm v-model="queryParams" :schemas="searchSchemas" @search="tableRef?.reload()" @reset="onReset" />
</template>
```

## props

| prop | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `modelValue` | `object` | 必填 | 查询参数对象，双向绑定 |
| `schemas` | `FormSchema[]` | 必填 | 字段配置 |
| `columns` | `number` | `3` | 每行几个 |
| `collapse` | `boolean` | `true` | 是否开启折叠 |
| `defaultCollapsed` | `boolean` | `true` | 初始是否折叠 |
| `showReset` | `boolean` | `true` | 是否显示重置 |

## 事件

| 事件 | 说明 |
| --- | --- |
| `search` | 点查询，或按回车 |
| `reset` | 点重置。**注意：组件只清空字段，不会自动重新查询**，需要自己触发 |

## 重置的正确姿势

```ts
function onReset() {
  queryParams.deptId = undefined      // 清掉不在表单里的附加条件
  tableRef.value?.reload()
}
```

有隐藏查询条件（比如从左侧部门树点进来的 `deptId`）时，重置只清表单字段是不够的，那些额外条件要手动清。

## 日期区间

`daterange` 给的是 `['2026-01-01', '2026-01-31']`。后端通常要 `beginTime` / `endTime` 两个字段，用工具函数转换：

```ts
const { dateRange, ...rest } = queryParams
const params = addDateRange(rest, dateRange)
// → { ...rest, beginTime: '2026-01-01 00:00:00', endTime: '2026-01-31 23:59:59' }
```
