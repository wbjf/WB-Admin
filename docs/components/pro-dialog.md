# ProDialog 弹窗

在 `el-dialog` 外面包一层，统一处理三件麻烦事：**宽度自适应、内容区滚动、关闭前二次确认**。

## 用法

```vue
<ProDialog v-model="visible" :title="formTitle" width="640px" :loading="submitting" @confirm="submit">
  <ProForm v-model="form" :schemas="schemas" :columns="2" />
</ProDialog>
```

## props

| prop | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `modelValue` | `boolean` | — | 显隐 |
| `title` | `string` | — | 标题 |
| `width` | `string \| number` | `'640px'` | 宽度，小屏自动收窄到 96% |
| `loading` | `boolean` | `false` | 确认按钮 loading |
| `confirmText` | `string` | 确定 | 确认按钮文案 |
| `cancelText` | `string` | 取消 | 取消按钮文案 |
| `showFooter` | `boolean` | `true` | 是否显示底部 |
| `fullscreen` | `boolean` | `false` | 全屏 |
| `destoryOnClose` | `boolean` | `true` | 关闭销毁内容（表单状态会重置） |

## 事件

| 事件 | 说明 |
| --- | --- |
| `confirm` | 点确定 |
| `cancel` | 点取消或右上角关闭 |
| `opened` / `closed` | 动画结束 |

## 表单弹窗的标准写法

```ts
const visible = ref(false)
const currentId = ref('')
const form = reactive<Partial<UserVO>>({})

async function openAdd() {
  currentId.value = ''
  Object.assign(form, { status: '0', roleIds: [] })   // 给默认值
  visible.value = true
}

async function openEdit(row: UserVO) {
  currentId.value = row.userId!
  Object.assign(form, await userApi.detail(row.userId!))
  visible.value = true
}

async function submit() {
  submitting.value = true
  try {
    currentId.value ? await userApi.update(form) : await userApi.add(form)
    ElMessage.success('保存成功')
    visible.value = false
    tableRef.value?.refresh()
  } finally {
    submitting.value = false
  }
}
```

> `openAdd` 一定要 `Object.assign` 重置字段。直接 `form = {}` 会丢掉 `reactive` 引用，`v-model` 就失效了。

## 关闭前确认

想做「有未保存修改时拦截关闭」，监听 `cancel` 事件并调用 `ElMessageBox.confirm`，取消时把 `modelValue` 再置回 true 即可。
