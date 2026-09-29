# ProDialog 弹窗

在 `el-dialog` 外面包一层，统一处理这几件麻烦事：**宽度自适应、内容区滚动、窗口状态（全屏 / 最大化 / 最小化）、标题栏拖动、多弹窗共存**。

## 用法

```vue
<ProDialog v-model="visible" :title="formTitle" width="640px" :loading="submitting" @confirm="submit">
  <ProForm v-model="form" :schemas="schemas" :columns="2" />
</ProDialog>
```

不传任何能力相关的 prop 时，四项能力都按 **全局默认**（默认全开）走 —— 也就是说既有的弹窗不用改一行代码，就自动带上了全屏 / 最大化 / 最小化按钮和标题栏拖动。

## 四项能力

| 能力 | 表现 | 关掉的开关 |
| --- | --- | --- |
| 全屏 | 铺满整个浏览器视口，无外边距、无圆角 | `fullscreenable` |
| 拖动 | 按住标题栏移动弹窗 | `draggable` |
| 多弹窗 | 可以同时开着多个，第 2 个起向右下错位，点哪个哪个到最前 | `stackable` |
| 最大化 | 铺满视口但保留四周留白与圆角 | `maximizable` |
| 最小化 | 收成一条标题栏钉在右下角，遮罩一并撤掉 | `minimizable` |

几个容易踩到的行为，写在这里省得踩：

- **最大化 / 最小化 / 全屏是互斥的**。从最小化还原时会回到最小化之前的状态。
- **拖动在三种铺满状态下自动失效** —— 那时弹窗已经没有可移动的余地。
- **弹窗比视口高时纵向拖不动多少**：默认位移被夹在「四条边都不出视口」的范围内，能往下走的距离就是 `视口高 − 弹窗高`。这种长表单场景把 `overflow` 打开即可。
- **最小化后整条横条都可以点**，点一下还原。同时遮罩会被撤掉（否则一条收起来的横条会把整个页面挡死）。

## props

| prop | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `modelValue` | `boolean` | — | 显隐 |
| `title` | `string` | — | 标题 |
| `width` | `string \| number` | `'640px'` | 宽度，小屏自动收窄 |
| `loading` | `boolean` | `false` | 确认按钮 loading |
| `confirmText` | `string` | 确定 | 确认按钮文案 |
| `cancelText` | `string` | 取消 | 取消按钮文案 |
| `showFooter` | `boolean` | `true` | 是否显示底部 |
| `fullscreen` | `boolean` | `false` | 受控全屏（`v-model:fullscreen` 也可） |
| `destroyOnClose` | `boolean` | `true` | 关闭销毁内容（表单状态会重置） |
| `closeOnClickModal` | `boolean` | `false` | 点遮罩关闭 |
| `appendToBody` | `boolean` | `true` | 挂到 body |
| `draggable` | `boolean` | 全局默认 | 标题栏可拖动 |
| `overflow` | `boolean` | 全局默认（`false`） | 拖动时允许越出视口 |
| `fullscreenable` | `boolean` | 全局默认 | 显示全屏按钮 |
| `maximizable` | `boolean` | 全局默认 | 显示最大化按钮 |
| `minimizable` | `boolean` | 全局默认 | 显示最小化按钮 |
| `stackable` | `boolean` | 全局默认 | 参与多弹窗的层叠错位与点击置顶 |
| `headerActions` | `boolean` | 全局默认 | 标题栏右侧操作区的总开关 |
| `defaultMaximized` | `boolean` | `false` | 打开时就最大化 |
| `defaultMinimized` | `boolean` | `false` | 打开时就最小化 |
| `bodyMaxHeight` | `string` | 自适应 | 正文最大高度；全屏 / 最大化时交给 flex 撑满 |
| `modal` | `boolean` | 自适应 | 遮罩。显式传入时不再套用「多弹窗自动撤遮罩」的规则 |

> 这些能力 prop 都是 `default: undefined`，**「不传」和「传 false」是两件事**：不传落到全局默认，传 `false` 才强制关闭。

## 事件

| 事件 | 说明 |
| --- | --- |
| `confirm` | 点确定 |
| `update:modelValue` | 显隐变化 |
| `update:fullscreen` / `fullscreen-change` | 全屏状态变化 |
| `maximize` / `restore` | 最大化 / 从最大化还原 |
| `minimize` / `unminimize` | 最小化 / 还原 |
| `opened` / `closed` | 动画结束 |

## 全局默认配置

优先级从低到高：**全局默认 → 单个弹窗的 prop → 运行时的用户操作**。

```ts
// main.ts
import { configureDialog } from '@/config/dialog'

configureDialog({
  draggable: true,
  minimizable: false,   // 全站不要最小化按钮
  cascadeStep: 32       // 层叠错位每层 32px
})
```

可配置项见 `src/config/dialog.ts` 的 `DialogDefaults`：`draggable`、`dragOverflow`、`fullscreenable`、`maximizable`、`minimizable`、`stackable`、`headerActions`、`modal`、`cascadeStep`、`maxCascade`、`minimizedWidth`、`maximizedInset`。

`useDialogConfig()` 拿到的是响应式对象，改完对已挂载的弹窗立即生效。

## 同时开多个弹窗

每个弹窗照旧用各自的 `v-model`，不需要额外 API：

```vue
<ProDialog v-model="aVisible" title="弹窗 A" />
<ProDialog v-model="bVisible" title="弹窗 B" />

<el-button @click="aVisible = true">打开 A</el-button>
<el-button @click="bVisible = true">打开 B</el-button>
```

- **只开一个时行为与改造前完全一致**：带遮罩、锁住背景。
- 开第二个时，**两个弹窗都自动撤掉遮罩**，否则后开的那个会连着把先开的也一起盖住，两个都动不了。
- 想强制保留遮罩，显式传 `:modal="true"`。

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

想做「有未保存修改时拦截关闭」，监听 `update:modelValue`（或自己在关闭入口处判断），在用户确认放弃前把值再置回 `true` 即可。

## 实现备忘

- 标题栏上的自定义按钮必须 `@mousedown.stop` —— Element Plus 的拖动是挂在整个 `<header>` 上的 `mousedown`，不拦的话点按钮会顺带把弹窗拖走。
- 覆盖 Element Plus 的弹窗样式要写到 **0,3,0**（`.el-dialog.pro-dialog.is-maximized`）。EP 的按需样式是运行时注入的，排在 `src/styles/index.scss` **之后**，同特异性会被它盖掉，而且**静默失效**。
- 全屏 / 最大化时弹窗高度是确定的，正文最大高度给 `none`、由 flex 撑满，比硬编码「视口减去头尾」稳。
