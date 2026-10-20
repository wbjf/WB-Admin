# DeviceTree 区域-设备树

两级树（父 = 区域，子 = 设备），内置**按拼音首字母排序**与**偏好（收藏）**：收藏项在所属区域内自动置顶并高亮，收藏状态按登录人隔离、暂存本地，不需要后端参与。

```vue
<DeviceTree :areas="areas" :loading="loading" @device-click="onDeviceClick" />
```

## 排序规则

排序在 `src/utils/device-sort.ts` 里集中定义，父节点与设备共用同一个比较器：

1. **收藏过的排最前**
2. **数字开头的按数值排**（`1 < 2 < 10`，不是字符串序的 `1 < 10 < 2`）
3. **字母开头的按 A-Z 排**，同一字母内数字部分同样按数值（`A2 < A10`）
4. **其它（中文等）排最后**，按拼音首字母兜底

区域节点按同一口径排：中文区域名取拼音首字母，所以「包装车间 / 冲压车间 / 总装车间」会按 B / C / Z 排列。

> 为什么必须显式分档：`new Intl.Collator('zh-CN', { numeric: true })` 能把 `A9` 排在 `A10` 前，但在 zh-CN 规则下**汉字排在拉丁字母之前**（实测 `collator.compare('冷水机组', 'A1') === -1`）。想让中文垫底就只能先分档再比较，不能直接丢给 collator。

取消收藏后不需要任何「归位」动作：位置完全由比较器里的收藏权重决定，状态一变，`computed` 重算，自然回到原位置。

## props

| prop | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `areas` | `DeviceArea[]` | `[]` | 区域树数据 |
| `loading` | `boolean` | `false` | 加载态 |
| `sortable` | `boolean` | `true` | 关掉则完全沿用后端顺序 |
| `groupByInitial` | `boolean` | `false` | 区域内再插一层首字符分组节点 |
| `showToolbar` | `boolean` | `true` | 搜索框、只看收藏、排序规则提示、统计 |
| `defaultExpandAll` | `boolean` | `true` | 首次渲染是否展开全部区域 |
| `height` | `string` | `''` | 传值则树内部滚动（如 `360px`） |

`groupByInitial` 默认关闭是有意的：分组会把收藏项关进各自的字母桶里，打断「收藏置顶」的观感。设备量特别大、需要靠折叠收纳时才打开。

## events

| 事件 | 参数 | 说明 |
| --- | --- | --- |
| `favorite-change` | `{ id, favorited }` | 收藏状态变化（用于埋点或同步到自己的状态栏） |
| `device-click` | `DeviceTreeNode` | 点击设备行，`payload.device` 是原始设备对象 |

## 数据结构

```ts
interface DeviceArea {
  id: string
  name: string
  children: DeviceItem[]
}

interface DeviceItem {
  id: string
  name: string
  areaId?: string
  status?: 'available' | 'unavailable' | 'offline'
}
```

状态圆点集中在 `DEVICE_STATUS_META` 里定义：绿 = 可用、黄 = 不可用、灰 = 未连接。**页面里不要自己写色值**，否则改主题时必然漏改某一处。

## 偏好（收藏）

`useDevicePreference()` 是模块级单例，组件、页面、自定义入口操作的是同一份数据：

```ts
const { favorites, favoriteIds, count, isFavorite, toggle, prune, clear, flush } =
  useDevicePreference()

isFavorite('d1') // O(1)
toggle({ id: 'd1', name: 'A1' })
```

| 成员 | 说明 |
| --- | --- |
| `favorites` | 收藏记录（最近收藏在前），含 `id / name / areaId / name / createdAt` |
| `favoriteIds` | `Set<string>`，给模板与排序做 O(1) 判定 |
| `count` | 收藏总数 |
| `toggle(device)` / `add` / `remove` | 增删，返回操作后的状态 |
| `prune(validIds)` | 清理「设备已不存在」的失效收藏，返回清理数量 |
| `clear()` | 清空当前登录人的收藏 |
| `flush()` | 立即落盘（默认 300ms 防抖） |

- **按登录人隔离**：key 为 `wb-admin:device-favorite:{userId}`，未登录落 `guest`。切换账号自动重新加载，不会看到上一个人的收藏。
- **落盘时机**：300ms 防抖 + `pagehide` / `visibilitychange` 兜底；`localStorage.setItem` 包了 `try/catch`，隐私模式或配额满时收藏只存在内存里，**不会把界面打断**。
- **失效收藏**：树上方会提示「N 个收藏的设备已不存在」并可一键清理；对应设备节点仍会以「已失效」标记显示，避免收藏凭空消失。

### 换成后端存储

```ts
import { configureDevicePreference, type PreferenceAdapter } from '@/composables'

const remote: PreferenceAdapter = {
  async load(userId) {
    return await api.get(`/device/favorite/${userId}`)
  },
  async save(userId, records) {
    await api.put(`/device/favorite/${userId}`, records)
  }
}

configureDevicePreference({ adapter: remote })
```

适配器只需 `load` / `save` 两个方法；换掉之后组件与排序逻辑一行都不用改。

## 接入已有的树（父节点没有 id）

老项目里常见这种结构：父节点只有 `label`，设备有 `id`，切 tab 时整棵树换数据源。**不要用数组下标做 `node-key`** —— 切数据源后同一位置换成了别的节点，`el-tree` 会认为「还是它」，展开态、高亮全错位。派生一个稳定 key：

```ts
const keyOf = (node: any) => (node.type === 0 ? `p:${node.label}` : `d:${node.id}`)
```

排序可以直接复用比较器，注意**先复制再 sort**，不要就地改后端返回的数组（否则下一次重算时「已经排过序」会掩盖掉排序失效的 bug）。

## 两个必须知道的坑

### 1. `treeData` 变化会导致整树重建，展开态丢失

`el-tree` 的 `setData` 是引用比较（`newVal !== this.root.data`）。`treeData` 是 `computed`，点一下收藏就返回新数组 → 命中「整树重建」分支 → `nodesMap` 清空、节点对象重建，节点上的 `expanded` 随旧对象一起丢掉。表现是：手动折叠的区域，点个收藏又全部弹开。

组件因此自己托管展开态：`:default-expanded-keys="expandedKeys"` + `@node-expand` / `@node-collapse` 维护。重建时 Element Plus 会按这份列表逐个 `expand()`，折叠过的 key 不在里面，就保持折叠。

### 2. 组件库内部的 `setData` 引用比较不受 `node-key` 影响

`node-key` 只决定节点标识与选中逻辑，**不能**让 `setData` 变聪明。换成稳定 key 解决的是「切数据源后同位置错位」，解决不了「重建丢展开态」，两件事要分别处理。
