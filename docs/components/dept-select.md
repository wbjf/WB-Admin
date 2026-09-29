# DeptSelect 部门选择

部门树下拉，数据源是 `/system/dept/list`，内部用 `buildTree` 转成树。

```vue
<DeptSelect v-model="queryParams.deptId" clearable />
<DeptSelect v-model="form.deptId" :disabled="!editable" @change="onDeptChange" />
```

## props

| prop | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `modelValue` | `string \| number` | — | 选中部门 ID |
| `placeholder` | `string` | 请选择部门 | 占位文案 |
| `clearable` | `boolean` | `true` | 可清空 |
| `disabled` | `boolean` | `false` | 禁用 |
| `checkStrictly` | `boolean` | `true` | 是否允许选非叶子节点 |
| `excludeId` | `string` | — | 排除某节点及其子树（编辑部门时排除自己） |

## 暴露的方法

```ts
const deptRef = ref()
deptRef.value.load()      // 手动重新拉取（部门结构变化后）
```

## 数据归一化

`/system/dept/list` 在不同后端实现里可能返回**分页对象**或**纯数组**。组件内部统一用 `toArray()` 归一化：

```ts
depts.value = toArray<DeptInfo>(await deptApi.list({}))
```

> 这个坑很典型：直接 `depts.value = await deptApi.list({})` 会在后端返回分页对象时崩在 `buildTree` 的 `.map` 上。全站凡是要「数组」的地方都走 `toArray()`，别手动判断。

## 编辑部门的场景

编辑部门时，「上级部门」下拉必须排除自己，否则能把自己设成自己的父节点，形成环。

```vue
<DeptSelect v-model="form.parentId" :exclude-id="form.deptId" />
```
