# ProForm 表单

用 schema 声明字段，覆盖 19 种控件。校验规则、栅格布局、字典联动都在 schema 里表达。

## 用法

```vue
<script setup lang="ts">
import type { FormSchema } from '@/components/ProForm/types'

const form = reactive({ userName: '', status: '0', roleIds: [] })

const schemas: FormSchema[] = [
  { prop: 'userName', label: '用户名', type: 'input', required: true, span: 12 },
  { prop: 'password', label: '密码', type: 'password', span: 12, rules: [{ min: 5, message: '至少 5 位' }] },
  { prop: 'status', label: '状态', type: 'radio', span: 12, options: [
    { label: '正常', value: '0' },
    { label: '停用', value: '1' }
  ] },
  { prop: 'roleIds', label: '角色', type: 'select', span: 12, multiple: true, options: roleOptions },
  { prop: 'deptId', label: '部门', type: 'tree-select', span: 12, options: deptTree },
  { prop: 'avatar', label: '头像', type: 'upload', span: 12 },
  { prop: 'remark', label: '备注', type: 'textarea', span: 24, rows: 3 }
]
</script>

<template>
  <ProForm ref="formRef" v-model="form" :schemas="schemas" label-width="90px" :columns="2" />
</template>
```

## 支持的控件类型

| type | 说明 |
| --- | --- |
| `input` | 文本输入 |
| `password` | 密码框（带显隐切换） |
| `textarea` | 多行文本 |
| `number` | 数字（可设 `min` `max` `precision`） |
| `select` | 下拉（`multiple` 支持多选） |
| `radio` | 单选按钮组 |
| `checkbox` | 多选组 |
| `switch` | 开关 |
| `date` | 日期 |
| `datetime` | 日期时间 |
| `daterange` | 日期区间 |
| `datetimerange` | 日期时间区间 |
| `time` | 时间 |
| `tree-select` | 树形下拉（部门、分类） |
| `cascader` | 级联选择 |
| `rate` | 评分 |
| `slider` | 滑块 |
| `dict` | **字典下拉**，只需给 `dictType`，选项自动拉 |
| `icon` | 图标选择器 |
| `upload` | 文件/图片上传 |
| `editor` | 富文本 |
| `slot` | 自定义插槽 |

## 字典控件

```ts
{ prop: 'status', label: '状态', type: 'dict', dictType: 'sys_normal_disable' }
```

不用手写 options，字典 store 会自动拉取并按 `dictType` 缓存。这是全站统一入口——**任何地方都不要硬编码枚举值**。

## 动态显隐

```ts
{ prop: 'password', label: '密码', type: 'password', hidden: !!currentId.value }
```

`hidden` 为 true 时该字段不渲染，也不参与校验。

## 插槽

```vue
<ProForm v-model="form" :schemas="schemas">
  <template #avatar="{ model }">
    <ProUpload v-model="model.avatar" type="image" />
  </template>
</ProForm>
```

## 校验

```ts
const formRef = ref()
await formRef.value.validate()          // 通过返回 true，失败抛错
formRef.value.resetFields()
formRef.value.clearValidate()
```

## 常见问题

**Q：字段值改不动？**
`v-model` 绑的是对象本身，确保传进去的是 `reactive` / `ref` 的同一个引用，不要在 computed 里造新对象。

**Q：`span` 怎么算的？**
24 栅格制。`columns=2` 时每行两个字段，此时手动设 `span: 24` 可以让某个字段独占整行（比如备注）。
