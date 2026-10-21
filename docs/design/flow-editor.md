# 流程图编辑器（FlowEditor）· 需求与设计

> **状态：设计稿，尚未实现。** 本文是开工前的对齐材料：需求范围、技术选型、数据模型、接口约定、UI 设计、实施计划。
> UI 原型：[flow-editor-ui.html](/design/flow-editor-ui.html)（静态可交互；本地可双击 `docs/public/design/flow-editor-ui.html` 打开，顶栏右侧可切换配置档位）。

> **核心约束：做成「可配置组件」。**
> 功能可以多做，但具体页面通过配置挑选用哪些 —— 不做「一开全开」的大块头。
> 配置分两层：**全局默认**（`src/config/flow.ts`）+ **单实例 prop**，并内置 `mini / standard / pro` 三档预设。详见「五、可配置组件设计」。

---

## 一、背景与目标

半导体工厂（Fab）的工艺流程是一条几十到几百道工序的长链：清洗 → 氧化/沉积 → 涂胶 → 光刻 → 显影 → 刻蚀 → 去胶 → 离子注入 → CMP → 量测 → …… → 封装测试。目前这类图多画在 Visio / PPT / Draw.io 里，与业务系统是断开的：图上的设备在系统里查不到、改了工艺图没人知道、切换个页面就丢了。

**目标**：在 WB-Admin 里内置一个流程图编辑器，让工艺/设备工程师**在浏览器里**完成：

1. 从左侧元件库拖拽节点到画布，用箭头连线，加名称与备注；
2. 一键导出图片与数据文件，能带走、能打印、能贴进报告；
3. 画到一半切到别的页面再回来，**图还在**（自动草稿）；
4. 后续能把节点与真实设备、真实工艺参数关联起来（见「六、可拓展能力」）。

**非目标**（本期不做）：多人实时协同、工艺仿真求解、BPMN 引擎执行。

---

## 二、用户与场景

| 角色 | 场景 | 关键诉求 |
| --- | --- | --- |
| 工艺工程师（PIE） | 画/改一条产品工艺流程（Route） | 节点语义要懂行（光刻、刻蚀、CMP…），参数要能挂上去，改完要留版本 |
| 设备工程师 | 标注某道工序用哪台设备、当前状态 | 从设备树里选设备，节点上直接看状态 |
| 产线主管 / 新人培训 | 只读浏览、导出培训材料 | 打开就能看，能导出图片，不能误改 |

---

## 三、功能需求

按优先级分档。**P0 是首版必须交付的**，P1 紧随其后，P2 是候选。

> 这里是**能力全集**，不是每个页面都要开。每项都对应一个配置开关（见「五、可配置组件设计」），使用方按 `preset` + 细项挑选。

### P0 · 核心编辑能力

| 编号 | 功能 | 说明 |
| --- | --- | --- |
| F1 | **左侧元件库** | 分组展示（工序 / 设备 / 判定 / 物料 / 辅助），支持搜索、折叠；按住拖到画布即生成节点。**内容与开关全部可配置，见 5.4** |
| F2 | **画布** | 网格背景、缩放（滚轮 + 按钮）、平移（空格拖拽 / 中键）、适应画布、全屏 |
| F3 | **连线** | 从节点锚点拖出连线；支持正交折线（默认）、直线、贝塞尔；箭头方向可切换；选中后可拖调整 |
| F4 | **节点编辑** | 双击改名称；拖动改位置；支持多选（框选 / Shift 点选）、批量移动与删除 |
| F5 | **属性面板** | 右侧面板编辑选中对象：名称、编号、类型、备注、自定义参数；未选中时显示画布属性（网格/背景） |
| F6 | **备注与标签** | 节点备注（悬浮提示 + 面板编辑）；连线上可加文字标签（如 `OK` / `NG`） |
| F7 | **撤销 / 重做** | `Ctrl+Z` / `Ctrl+Shift+Z`，按钮同步显示可用状态 |
| F8 | **删除与复制** | `Delete` 删除；`Ctrl+C` / `Ctrl+V` 复制粘贴（含连线关系） |
| F9 | **导出** | PNG / JPEG / SVG 图片；`.flow.json` 数据文件；打印 |
| F10 | **导入** | 导入 `.flow.json`，校验版本后渲染 |
| F11 | **自动保存草稿** | 编辑即存本地（防抖 + 页面隐藏时强制落盘）；切走页面不丢；重进自动恢复 |
| F12 | **显式保存** | 保存到服务端，生成流程图记录（名称、缩略图、更新时间） |
| F13 | **离开保护** | 有未保存改动时切走/刷新/关闭，弹出确认（Element Plus 确认框 + `beforeunload`） |

### P1 · 工程化与专业性

| 编号 | 功能 | 说明 |
| --- | --- | --- |
| F14 | **半导体节点库** | 预置 20+ 工序/设备节点（光刻机、Track、Etcher、CMP、Implanter、Furnace、量测…），带图标与默认配色。属内置库之一（另有 `basic` / `generic`），可被 `palette.groups` 整体替换 |
| F15 | **对齐与吸附** | 网格吸附、节点对齐线（左/中/右、上/中/下）、等间距分布 |
| F16 | **校验** | 一键检查：孤立节点、无入口/无出口、成环、编号重复、必填字段缺失；结果列表可点击定位 |
| F17 | **缩略图导航（MiniMap）** | 右下角小地图，长流程快速定位 |
| F18 | **分组 / 泳道** | 用区域框把节点归到不同 Bay（光刻区、刻蚀区、薄膜区…）或阶段（FEOL / BEOL / 封装） |
| F19 | **锁定与只读模式** | 节点锁定防误拖；整图只读模式（分享给主管看） |
| F20 | **保存状态可见** | 标题栏显示「已保存 / 未保存 / 保存中 / 保存失败」，失败可重试 |
| F21 | **版本与历史** | 保存快照，可查看历史列表、预览、回滚 |
| F22 | **i18n** | 内置文案走 `zh-CN` / `en-US` 两份语言包 |

### P2 · 候选（见第六节完整清单）

自动布局、设备绑定与实时状态、模板库、AI 生成流程图、版本 diff、协同编辑等。

---

## 四、技术选型

### 4.1 方案对比

| 方案 | 优点 | 缺点 | 结论 |
| --- | --- | --- | --- |
| **LogicFlow 2.x**（`@logicflow/core` + `@logicflow/extension` + `@logicflow/vue-node-registry`） | 滴滴开源、Apache-2.0；开箱即用的拖拽面板（DndPanel）、小地图（MiniMap）、控制面板（Control）、右键菜单（Menu）、框选（SelectionSelect）、快照导出（Snapshot，PNG/JPEG/SVG）；Vue3 组件可直接当节点（Teleport 挂载）；数据就是 JSON，序列化成本低 | 体积约 200KB+（gzip 后约 70KB）；Vue 节点走 `foreignObject`，导出图片时需注意样式内联；深度定制要读源码 | **推荐** |
| AntV X6 | 功能最全（图编辑、DAG、ER 图），官方 Vue 支持 | 体积更大（~500KB+），API 更重，学习成本高；对「只做流程图」是过度设计 | 备选 |
| Vue Flow | Vue 原生、心智负担小 | 生态与社区规模小于 React Flow，插件（小地图/导出/菜单）需自己补 | 备选 |
| 自研 SVG 画布 | 完全可控、零依赖 | 连线路由、吸附对齐、缩放平移、序列化、导出都要自己写，**至少 3000+ 行且极易踩坑** | 不推荐 |

**结论：LogicFlow。** 许可证 Apache-2.0，与仓库 MIT 兼容，但引入时要在 README 的「第三方依赖」与 `THIRD-PARTY-NOTICES` 里补声明。

### 4.2 依赖与体积

```bash
npm i @logicflow/core @logicflow/extension @logicflow/vue-node-registry
```

- `@logicflow/core`：引擎与内置节点/边
- `@logicflow/extension`：DndPanel、Control、MiniMap、Snapshot、Menu、SelectionSelect、Group
- `@logicflow/vue-node-registry`：把 Vue 组件注册为节点（半导体节点用它实现）

**体积控制**：编辑器页面**路由级懒加载**，LogicFlow 不进首屏 chunk；`element-plus` 已全量引入，新增依赖只影响该页面。

### 4.3 与现有架构的关系

- **页面切换会销毁组件**：`AppMain.vue` 只有 `transition` + `component`，没有 `KeepAlive`。所以「切走不丢」**只能靠持久化**，不能指望组件缓存 —— 这是 F11 必须做的原因。
- **Vue 节点的 Teleport 隔离**：`@logicflow/vue-node-registry` 用 `flowId` 隔离 Teleport 容器，一个页面只持有一个实例，销毁时必须 `lf.destroy()`，否则节点组件会残留在别的页面上。
- **复用已有能力**：设备节点绑定可复用 `DeviceTree` 与 `useDevicePreference`；导出 Excel 复用 `utils/excel.ts`；打印复用 `utils/print.ts`；文件下载复用 `utils/download.ts`。

---

## 五、可配置组件设计（核心）

### 5.1 原则

1. **功能做全，默认开一半。** 编辑器内部实现所有能力，但每个能力都有开关；关掉的能力要真的不存在——不显示按钮、不注册快捷键、不注册 LogicFlow 插件、不加载对应代码。
2. **两层开关，不新发明约定。** 沿用仓库 `ProDialog` 已有的套路：`src/config/flow.ts` 提供**全局默认**，组件 `prop` 提供**单实例覆盖**。
3. **预设档位兜底，细项可覆盖。** `preset` 一次选一档，再用 `features` 等细项微调，两者合并（细项优先）。
4. **配置决定依赖。** `ai` / `collab` / `simulate` 这类重能力走**动态 `import()`**，不开就不进包。
5. **使用方只写配置，不碰引擎。** LogicFlow 实例不对外暴露；要用高级能力通过组件暴露的方法与事件。

### 5.2 配置分层

| 层 | 载体 | 典型用途 |
| --- | --- | --- |
| 全局默认 | `configureFlowEditor({ ... })`，写在 `src/config/flow.ts` | 全站统一画法：默认节点库、默认导出项、默认是否自动布局 |
| 单实例 | `<FlowEditor :config="cfg" />` | 某个页面只用其中一部分能力 |
| 预设 | `preset: 'mini' \| 'standard' \| 'pro'` | 80% 场景一句话搞定 |

### 5.3 配置类型

```ts
export interface FlowEditorOptions {
  /** 预设档位，缺省 standard */
  preset?: 'mini' | 'standard' | 'pro'
  /** 功能开关（未列到的继承 preset） */
  features?: {
    minimap?: boolean        // 缩略图导航
    autoLayout?: boolean     // 一键自动布局
    validate?: boolean       // 校验与问题定位
    version?: boolean        // 版本与回滚
    template?: boolean       // 模板库
    lane?: boolean           // 泳道 / 区域框
    lock?: boolean           // 节点锁定
    fullscreen?: boolean     // 全屏编辑
    ai?: boolean             // AI 生成流程图（动态加载）
    collab?: boolean         // 协同编辑（动态加载）
    simulate?: boolean       // 节拍 / 良率仿真（动态加载）
    comment?: boolean        // 节点评论
  }
  /** 左侧元件库：分组/节点内容 + 搜索、折叠、拖拽开关，见 5.4 */
  palette?: PaletteOptions
  /** 顶部工具条：内置项名称数组，或自定义项 */
  toolbar?: {
    items?: Array<'undo' | 'redo' | 'validate' | 'layout' | 'export' | 'import' | 'save' | 'fullscreen' | ToolbarItem>
  }
  /** 导出项 */
  exports?: Array<'png' | 'jpeg' | 'svg' | 'json' | 'excel' | 'print'>
  imports?: boolean
  /** 右侧属性面板：schema 驱动，不同业务挂不同字段 */
  inspector?: {
    fields?: FieldSchema[]   // { key, label, type, options?, required?, unit? }
    showParams?: boolean     // 工艺参数表
    showDevice?: boolean     // 设备绑定（从设备树选）
    showRemark?: boolean
  }
  /** 持久化 */
  persist?: {
    draft?: 'indexeddb' | 'local' | false  // 本地草稿，false 则完全不落盘
    autoSaveRemote?: boolean                // 自动保存到服务端
    debounce?: number                       // 默认 500ms
    leaveGuard?: boolean                    // 离开页面拦截确认
  }
  /** 校验规则（可插拔） */
  validateRules?: ValidateRule[]
  /** 只读视图（列表页 / 详情页嵌入） */
  readonly?: boolean
  /** 画布高度，缺省撑满容器 */
  height?: string
}
```

### 5.4 元件库（palette）配置

元件库是**完全可配置**的：不只是「显不显示」，而是**用哪些分组、哪些节点、节点长什么样、能不能拖**都由配置决定。

#### 5.4.1 类型定义

```ts
/** 元件库中的一个节点模板 */
export interface PaletteItem {
  /** 节点类型，落图后写入 node.type；同一库内唯一 */
  type: string // 'litho' | 'etch' | 'cmp' | 自定义如 'inspect'
  /** 面板显示名 */
  label: string
  /** 搜索用的别名（英文、缩写、别名），不显示在界面上 */
  keywords?: string[]
  /** 图标：svg 字符串 / 图标名 / Vue 组件；不传用默认形状 */
  icon?: string | Component
  /** 默认配色（左侧色条与节点描边） */
  color?: string
  /** 落图后的默认尺寸 */
  size?: { width: number; height: number }
  /** 默认形状，缺省 rect */
  shape?: 'rect' | 'round' | 'diamond' | 'note' | string
  /** 落图时写入节点的默认业务属性（编号前缀、默认参数等） */
  defaults?: Record<string, unknown>
  /** 该节点允许连出的类型白名单，用于连线校验 */
  next?: string[]
  /** 置灰不可拖（该类型已下线但仍需兼容老图） */
  disabled?: boolean
}

/** 一个分组 */
export interface PaletteGroup {
  name: string
  items: PaletteItem[]
  /** 默认是否展开 */
  expanded?: boolean
}

export interface PaletteOptions {
  /** 直接给分组（最高优先级，传了就不走内置库） */
  groups?: PaletteGroup[]
  /** 或引用内置库：'semiconductor' 20+ 工序设备 | 'basic' 基础 6 种 | 'generic' 通用流程图形 */
  preset?: 'semiconductor' | 'basic' | 'generic'
  /** 在所选库基础上追加/覆盖若干节点（改配色、改默认参数常用） */
  extend?: PaletteItem[]
  /** 屏蔽某些类型（黑名单，优先级高于 extend） */
  exclude?: string[]
  /** 搜索框，默认 true */
  searchable?: boolean
  /** 分组可折叠，默认 true */
  collapsible?: boolean
  /** 允许拖拽新建节点；只读场景关掉，默认 true */
  draggable?: boolean
  /** 允许双击画布空白处在光标位置新建（不拖也能加），默认 false */
  quickAdd?: boolean
}
```

#### 5.4.2 三层生效顺序

| 层 | 写法 | 说明 |
| --- | --- | --- |
| 预设档位 | `preset: 'mini' \| 'standard' \| 'pro'` | 决定**默认内置库**：mini → `basic`（6 种），standard/pro → `semiconductor` |
| 全局 | `configureFlowEditor({ palette: {...} })` | `src/config/flow.ts`，全站统一元件库 |
| 单实例 | `<FlowEditor :config="{ palette: {...} }" />` | 覆盖全局，只对当前页面生效 |

合并规则：`groups` 若传则整体替换；否则取 `preset` 内置库 → 应用 `extend`（同 `type` 覆盖、新 `type` 追加）→ 剔除 `exclude`。

#### 5.4.3 用法示例

```ts
// A. 只用 4 种节点（例：简易审批流）
const palette = {
  groups: [
    {
      name: '流程',
      items: [
        { type: 'start', label: '开始', shape: 'round', color: '#606266' },
        { type: 'task', label: '任务', color: '#409eff', size: { width: 130, height: 54 } },
        { type: 'check', label: '审核', shape: 'diamond', color: '#e6a23c' },
        { type: 'end', label: '结束', shape: 'round', color: '#606266' }
      ]
    }
  ],
  searchable: false // 就 4 个，不需要搜索
}

// B. 用半导体库，但去掉「设备」分组里的老型号、给「光刻」换个配色和默认参数
const palette2 = {
  preset: 'semiconductor',
  exclude: ['furnace-old'],
  extend: [
    {
      type: 'litho',
      label: '光刻 Litho',
      color: '#7c5cff',
      keywords: ['photo', 'scanner', 'exposure'],
      defaults: { codePrefix: 'OP-04', params: [{ k: '曝光能量', v: '30', u: 'mJ/cm²' }] }
    }
  ]
}

// C. 详情页嵌入的只读小图：不搜索、不可折叠、不可拖
const palette3 = { preset: 'basic', searchable: false, collapsible: false, draggable: false }
```

```vue
<FlowEditor :config="{ preset: 'mini', readonly: true, palette: palette3 }" :graph="device.flow" />
```

#### 5.4.4 约束与实现约定

1. **不在库里的类型不注册。** 组件只按最终 palette 里的 `type` 调 `lf.register()`；关掉的图标不渲染、不进包。
2. **导入旧图时降级不报错。** `.flow.json` 里出现当前 palette 没有的 `type`，降级渲染为默认矩形节点并提示「N 个节点类型不在当前元件库中（以默认样式显示）」，不允许把图渲染崩掉。
3. **切换 palette 不影响已有节点。** 已画到画布上的节点保留原 `type` 与原样式，只是左侧不再提供新增入口；若 `exclude` 命中已有类型，仅标黄提示，不静默删除数据。
4. **搜索按 `label + keywords + type`** 匹配，中文可直接搜「光刻」，英文搜 `litho` / `cmp`。
5. **`next` 白名单是软校验**：只在校验面板里提示「X → Y 不是推荐连线」，不阻止拖拽连线。
6. **图标资源**：内置库图标以 svg 字符串内联在 `palette.ts`（不引图标库）；自定义图标支持传 svg 字符串或 Vue 组件，24×24 视口。

### 5.5 三档预设对照

| 能力 | mini | standard | pro |
| --- | --- | :-: | :-: |
| 画布 / 拖拽 / 连线 / 改名 | ✅ | ✅ | ✅ |
| 属性面板（名称 + 备注） | ✅ | ✅ | ✅ |
| 导出 PNG / JSON | ✅ | ✅ | ✅ |
| 撤销重做、复制粘贴、删除 | ✅ | ✅ | ✅ |
| 本地草稿（切页不丢） | ✅ | ✅ | ✅ |
| 导出 SVG / JPEG / 打印 | — | ✅ | ✅ |
| 导入 JSON | — | ✅ | ✅ |
| 半导体节点库（20+ 图标） | 基础 6 种 | ✅ | ✅ |
| 校验与问题定位 | — | ✅ | ✅ |
| 小地图 / 全屏 | — | ✅ | ✅ |
| 自动布局 | — | ✅ | ✅ |
| 泳道 / 分组框 | — | ✅ | ✅ |
| 节点锁定 | — | ✅ | ✅ |
| 服务端保存 + 列表页 | — | ✅ | ✅ |
| 版本 / 回滚 / diff | — | — | ✅ |
| 模板库 | — | — | ✅ |
| 工艺参数表 + 设备绑定 | — | — | ✅ |
| AI 生成流程图 | — | — | ✅ |
| 协同编辑 / 仿真 / 评论 | — | — | ✅（默认关，按需开） |

### 5.6 用法示例

```vue
<!-- A. 设备详情页里嵌一张只读小图：极简 + 只读 -->
<FlowEditor :config="{ preset: 'mini', readonly: true, height: '280px' }" :graph="device.flow" />

<!-- B. 工艺工程师编辑工艺路线：标准档 -->
<FlowEditor :config="flowCfg" @save="onSave" />

<!-- C. 流程平台：完整档，再单独关掉协同 -->
<FlowEditor
  :config="{ preset: 'pro', features: { collab: false }, exports: ['png', 'svg', 'json', 'excel'] }"
/>

<!-- D. 全局默认（src/config/flow.ts）：全站统一关掉协同与仿真 -->
configureFlowEditor({
  preset: 'standard',
  features: { collab: false, simulate: false },
  exports: ['png', 'json'],
  persist: { draft: 'indexeddb', leaveGuard: true }
})
```

### 5.7 对外接口

| 类型 | 名称 | 说明 |
| --- | --- | --- |
| `props` | `config` | `FlowEditorOptions` |
| | `graph` | 初始图数据（`FlowGraph`），不传则新建空白图 |
| | `flowId` | 指定加载/保存哪张图 |
| `emits` | `ready(lfApi)` | 引擎就绪，暴露受控 API（不直接给实例） |
| | `change(graph)` | 图数据变化（配置 `persist.draft` 后仍会触发） |
| | `save(graph)` | 用户点击保存 |
| | `validate(issues)` | 校验结果 |
| | `node-click(node)` | 点击节点（业务侧可联动设备详情等） |
| `slots` | `toolbar-left` / `toolbar-right` | 自定义工具条按钮 |
| | `palette-extra` | 元件库底部扩展区（如「从设备树导入」「申请新元件」） |
| | `inspector-extra` | 属性面板扩展区（业务特有字段） |
| | `empty` | 画布空态 |
| `expose` | `getGraph()` / `setGraph()` / `validate()` / `autoLayout()` / `export(type)` / `clear()` | 供父组件调用 |

### 5.8 关掉的能力如何彻底消失

| 能力 | 关闭时的处理 |
| --- | --- |
| 小地图 / 校验 / 自动布局 | 不注册对应 LogicFlow 插件，工具条不渲染按钮，快捷键不绑定 |
| AI / 协同 / 仿真 | 不 `import()`，代码不进该 chunk |
| 本地草稿 | `persist.draft: false` 时不初始化 IndexedDB，也不挂 `pagehide` |
| 设备绑定 | `inspector.showDevice: false` 时不渲染设备选择区（避免在无设备树的环境报错） |
| 只读模式 | `readonly` 时不渲染左侧拖拽、不启用编辑插件，只加载查看所需的极小子集 |
| 元件库节点 | 不在 `palette` 中的 `type` 不 `register()`；`draggable: false` 时禁用 mousedown 且不注册 DnD 面板；`searchable: false` 时不渲染搜索框 |

---

## 六、数据模型

```ts
/** 流程图元信息 */
export interface FlowMeta {
  id: string
  name: string
  /** 业务类型：工艺路线 / 设备布局 / 通用流程 */
  category?: 'process' | 'layout' | 'generic'
  description?: string
  /** 缩略图（dataURL），列表页用 */
  thumbnail?: string
  createdBy?: string
  updatedAt: number
  /** 服务端版本号，草稿与已发布分离 */
  version?: number
}

/** 节点（LogicFlow 原生字段 + 业务属性） */
export interface FlowNode {
  id: string
  type: string // 'litho' | 'etch' | 'cmp' | 'decision' | ...
  x: number
  y: number
  text: { x: number; y: number; value: string }
  properties: {
    /** 工序编号，如 OP-0120 */
    code?: string
    /** 备注 */
    remark?: string
    /** 绑定的设备 id（来自设备树） */
    deviceId?: string
    /** 所属区域 / 泳道 */
    bay?: string
    /** 阶段：FEOL / BEOL / 封装 */
    stage?: string
    /** 标准节拍（分钟） */
    cycleTime?: number
    /** 工艺参数，动态键值对（recipe、温度、气体…） */
    params?: Array<{ key: string; value: string; unit?: string }>
    /** 自定义配色 / 图标 */
    color?: string
    locked?: boolean
  }
}

/** 连线 */
export interface FlowEdge {
  id: string
  type: 'polyline' | 'line' | 'bezier'
  sourceNodeId: string
  targetNodeId: string
  /** 连线标签：OK / NG / 条件表达式 */
  text?: string
  properties: {
    /** main 主流程 / rework 返工 / scrap 报废 / material 物料流 */
    kind?: 'main' | 'rework' | 'scrap' | 'material'
    dashed?: boolean
    remark?: string
  }
}

/** 一张完整的图（导出/导入的单位） */
export interface FlowGraph {
  /** 结构版本，导入时校验，不同版本走迁移 */
  schema: 1
  meta: FlowMeta
  nodes: FlowNode[]
  edges: FlowEdge[]
  /** 泳道 / 区域框 */
  groups?: Array<{ id: string; name: string; x: number; y: number; w: number; h: number }>
}
```

### 存储策略（三层）

| 层 | 介质 | 时机 | 用途 |
| --- | --- | --- | --- |
| 内存 | 页面内 `ref` | 实时 | 编辑态 |
| 本地草稿 | **IndexedDB**（`wb-admin:flow-draft:{userId}:{flowId}`） | 改动后 500ms 防抖；`pagehide` / `visibilitychange(hidden)` 强制写 | 防丢失，含缩略图 |
| 服务端 | 接口 | 用户点「保存」/ 自动保存（可选） | 跨设备、协作、版本 |

> 为什么用 IndexedDB 而不是 localStorage：草稿含缩略图 base64，单张几十到几百 KB，localStorage 5MB 配额容易满，且写入是同步的会卡 UI。规则与 AI 会话一致——**写入必须包 try/catch**，失败只影响持久化，不能让编辑器崩。

### 接口约定

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/flow/list` | 我的流程图列表（id / 名称 / 缩略图 / 更新时间） |
| `GET` | `/flow/{id}` | 详情，返回 `FlowGraph` |
| `POST` | `/flow` | 新建，返回 id |
| `PUT` | `/flow/{id}` | 保存（覆盖当前草稿为正式内容） |
| `PUT` | `/flow/{id}/draft` | 仅保存草稿（可选，服务端草稿便于多端续画） |
| `GET` | `/flow/{id}/versions` | 版本列表 |
| `POST` | `/flow/{id}/versions` | 发布一个版本（快照） |
| `POST` | `/flow/{id}/rollback` | 回滚到某版本 |
| `DELETE` | `/flow/{id}` | 删除 |
| `POST` | `/flow/import` | 上传 `.flow.json` 导入 |

首版**全部走 mock**（`src/mock/index.ts` 加路由），与现有 mock 风格一致；接入真实后端只改 `src/api/flow.ts`。

---

## 七、可拓展能力（我补充的，按价值排序）

用户点名要我补充。以下都是「让这张图从**画着好看**变成**用起来有用**」的方向，按性价比排序：

### 高价值 · 建议进入 P1

| 能力 | 说明 | 为什么值 |
| --- | --- | --- |
| **E1 · 自动布局** | 一键把画歪的图按 DAG 分层重排（dagre / elkjs），支持「从左到右」「从上到下」两种方向 | 几十道工序手排会疯；新导入的 JSON 也能秒变整齐 |
| **E2 · 设备绑定 + 实时状态** | 节点属性里从 `DeviceTree` 选一台真实设备，节点上显示状态圆点；悬浮显示设备详情 | 复用刚做的设备树；图上的工序第一次能「点进真实设备」 |
| **E3 · 模板库** | 预置几条半导体工艺模板（CMOS FEOL、BEOL 金属互连、封装测试流），一键套用再改 | 新人不用从空白开始；也方便统一画法规范 |
| **E4 · 版本对比（diff）** | 两个版本并排/叠加显示，新增节点绿、删除红、修改黄 | 工艺版本评审真正需要的是「改了什么」，不是「存了几次」 |
| **E5 · 工艺参数表** | 节点挂动态参数（recipe 名、温度、时间、气体流量…），支持批量编辑、导出 Excel 工艺卡 | 让图变成数据源，而不是图片 |
| **E6 · 校验规则可配** | 除内置校验外，允许配置「某类节点必须填设备」「编号必须递增」 | 不同工厂规范不同，硬编码会很快过时 |

### 中价值 · P2

| 能力 | 说明 |
| --- | --- |
| **E7 · AI 生成流程图** | 复用现有 `AiChat`：输入「画一条 28nm 逻辑工艺，从清洗到 WAT」→ 大模型产出 `FlowGraph` JSON → 直接渲染，再手工微调。这是本仓库最有辨识度的加分项 |
| **E8 · 协同编辑** | WebSocket + 操作锁（先做「谁在编辑」提示 + 编辑锁，实时光标留到后面） |
| **E9 · 节拍与瓶颈分析** | 每节点填节拍，自动算关键路径（最长链路）并高亮，估算整条 Route 的 cycle time |
| **E10 · 不良/良率传播** | 节点填良率，沿链路累乘得到理论良率，定位良率损失最大的工序 |
| **E11 · 只读分享链接** | 生成带 token 的只读链接，可给车间大屏或外部查看；支持水印 |
| **E12 · 导入 Excel 工序表** | 把 MES 导出的工序表（编号/名称/设备/节拍）直接生成图，免去手工拖 |
| **E13 · 评论与审批** | 节点上挂评论，@人；整图走「草稿 → 评审 → 发布」状态机 |
| **E14 · 搜索与定位** | 按名称/编号/设备搜节点，回车定位并高亮居中 |
| **E15 · 嵌入模式** | 以 `<FlowViewer :graph="..."/>` 形式嵌进别的业务页（如设备详情页显示「该设备参与的流程」） |

### 锦上添花 · P3

| 能力 | 说明 |
| --- | --- |
| E16 · 深色主题（Fab 现场暗环境友好） | 与仓库现有主题机制联动 |
| E17 · 移动端只读浏览（缩放/拖拽手势） | 现场用平板看 |
| E18 · 导出 PDF 工艺卡（含参数表） | 打印/归档 |
| E19 · 图片素材库（自定义 SVG 图标上传） | 工厂自有设备图标 |
| E20 · 图例自动生成 | 按节点类型/连线类型生成图例块 |
| E21 · 操作审计 | 谁在什么时候改了哪道工序 |
| E22 · 批量替换 | 全局替换某台设备为另一台（设备换型场景） |

> 不建议做：BPMN 执行引擎（与工艺场景无关）、Visio 文件解析（格式闭源、成本极高）。

---

## 八、UI 设计

完整原型见 [flow-editor-ui.html](/design/flow-editor-ui.html)。**原型顶栏右侧可切换 `mini / standard / pro` 三档配置**，同一组件在不同配置下的差异会实时体现（工具条按钮、小地图、右侧参数区、模板页签、AI/协同按钮的显隐）。

布局与交互要点：

```
┌───────────────────────────────────────────────────────────────────────┐
│ 顶栏：图名称（可改名） · 保存状态 · [撤销 重做] [校验] [布局] [导出▾] [保存] │
├──────────┬────────────────────────────────────────────┬───────────────┤
│ 左侧      │                                            │ 右侧           │
│ 元件库    │              画布（网格 + 泳道背景）            │ 属性面板       │
│ ├ 搜索    │   节点 · 连线 · 标签 · 便签                  │ ├ 基础         │
│ ├ 工序    │                                            │ ├ 参数表       │
│ ├ 设备    │   右下角：小地图 + 缩放控件                  │ └ 备注         │
│ ├ 判定    │                                            │                │
│ └ 辅助    │                                            │                │
├──────────┴────────────────────────────────────────────┴───────────────┤
│ 状态栏：缩放 100% · 节点 12 · 连线 13 · 最近保存 12:04 · 已保存          │
└───────────────────────────────────────────────────────────────────────┘
```

- **左侧 256px**：固定宽度，可折叠；节点卡片 hover 显示拖拽手势，按下即进入拖动态。
- **右侧 320px**：选中节点时显示该节点属性；选中连线显示连线属性；未选中显示画布设置；可折叠。
- **画布**：默认网格 10px，浅色背景；选中态用主题色描边 + 四角锚点；连线 hover 显示中点可加标签。
- **状态栏**：常驻显示保存状态与统计，**「未保存」必须有视觉标识**（这是用户对数据丢失最敏感的地方）。

### 交互细节

| 操作 | 行为 |
| --- | --- |
| 拖拽左侧节点 → 画布 | 落点即创建，自动选中并聚焦名称可改 |
| 双击节点 | 进入文本编辑 |
| 拖动节点边缘锚点 → 另一节点 | 建立连线；拖到空白处取消 |
| 单击连线 | 选中，可加/改标签、改线型（实线/虚线）、删除 |
| `Delete` | 删除选中（节点会连带删除其连线） |
| `Ctrl+Z` / `Ctrl+Shift+Z` | 撤销 / 重做 |
| `Ctrl+S` | 保存 |
| `Space` + 拖拽 / 中键拖拽 | 平移画布 |
| 滚轮 | 缩放（以光标为中心） |

### 响应式

- ≥1280px：三栏全展开
- 1024–1280px：右侧面板改为抽屉
- <1024px：仅只读浏览（编辑器提示用更大屏幕，避免在小屏上做精确连线）

---

## 九、目录结构与模块拆分

```
src/components/FlowEditor/
├── index.vue                 # 编辑器主组件（三栏布局 + 配置驱动的生命周期编排）
├── config.ts                 # 配置解析：preset → 细项合并 → 最终生效项（唯一真源）
├── useFlowEditor.ts          # 状态与动作：初始化、增删改、撤销重做、校验
├── useFlowDraft.ts           # 草稿持久化：IndexedDB + 防抖 + pagehide flush
├── useFlowExport.ts          # 导出：图片 / JSON / 打印 / 工艺卡
├── palette.ts                # 元件库定义：内置三套（semiconductor / basic / generic）+ 类型 PaletteItem·PaletteGroup
├── nodes/                    # 自定义节点（Vue 组件 + model）
│   ├── ProcessNode.vue       # 工序节点（带图标 + 编号角标）
│   ├── EquipmentNode.vue     # 设备节点（带状态圆点）
│   ├── DecisionNode.vue      # 判定菱形
│   └── ...
├── edges/                    # 自定义连线（返工虚线、物料点线…）
├── validate.ts               # 校验规则
└── types.ts
src/config/flow.ts            # 全局默认配置（与 dialog.ts 同一套路）
src/views/flow/index.vue      # 列表页（我的流程图）
src/views/flow/editor.vue     # 编辑页（路由懒加载）
src/api/flow.ts               # 接口
src/mock/index.ts             # 加 /flow/* 路由
```

**状态放哪**：编辑器状态放**页面内的 composable**，不进 Pinia —— 它是页面级 UI 状态，多实例会互相污染（与 `useAiChat` / `useDevicePreference` 同为模块级单例，但作用域是编辑页）。草稿读写放独立模块，可被列表页复用。

---

## 十、实施计划

| 阶段 | 内容 | 产出 |
| --- | --- | --- |
| **M1 骨架** | 引入依赖、三栏布局、LogicFlow 初始化、拖拽建节点、连线、属性面板（名称/备注） | 能画能连能改名 |
| **M2 保存** | 草稿持久化（IndexedDB）、离开保护、服务端保存 + 列表页、导入导出 JSON | 切换页面不丢 |
| **M3 导出与专业度** | PNG/SVG/打印导出、半导体节点库、连线语义、校验、MiniMap、撤销重做、快捷键 | 可用于真实场景 |
| **M4 增强** | 自动布局、设备绑定、模板库、版本与 diff、i18n、e2e 补充 | 从能用到好用 |

每个阶段结束都要过：类型检查、lint、单测、真实浏览器 e2e（拖拽/连线/保存/刷新恢复/导出）。

---

## 十一、验收标准

1. 从左侧拖 5 个节点、连 4 条线、改 2 处名称与 1 处备注 → 刷新页面后**完全一致**。
2. 切到「用户管理」再切回来 → 图仍在，且状态栏显示草稿已恢复。
3. 有未保存改动时点侧边栏菜单 → 弹确认；选择「不保存」则丢弃草稿回到服务端版本。
4. 导出 PNG 与 SVG 均能在系统图片查看器/浏览器打开，内容含全部节点与连线标签。
5. 导出的 `.flow.json` 重新导入后与原图一致（节点位置、属性、连线）。
6. 校验能报出「孤立节点」「无出口」并点击定位。
7. 页面销毁后 DOM 中无残留节点组件（Teleport 已清理）。
8. 新增依赖不进入首屏 chunk（`vite build` 后检查 chunk 拆分）。
9. `preset: 'mini'` 下：工具条只剩必要项，小地图 / 校验 / 自动布局按钮**不渲染**，属性面板只留名称与备注，构建产物中**不含** AI / 协同 / 仿真对应的 chunk。
10. `readonly: true` 下：左侧不可拖拽、画布不可编辑，但缩放平移与导出仍可用。
11. 同一页面同时挂两个不同配置的实例（mini 只读 + standard 可编辑）互不干扰。

---

## 十二、风险与未决问题

| 风险 | 说明 | 应对 |
| --- | --- | --- |
| 导出图片丢样式 | Vue 节点走 `foreignObject`，Snapshot 依赖页面 CSS | 关键样式内联到节点组件；导出前 `useGlobalRules = false` 并注入必要 CSS；导出后做像素抽查 |
| 体积 | 新增约 70KB（gzip） | 路由懒加载；先只引 core + 用到的 extension |
| 草稿冲突 | 同一账号多标签页编辑同一张图 | 首版用「最后写入胜」+ `storage` 事件提示；后续上编辑锁（E8） |
| 节点类型爆炸 | 半导体工序几十种，全做成自定义节点维护成本大 | 只做 6~8 个**通用**节点 + 属性区分（type/图标/配色由数据驱动），不一种工序一个类 |
| 数据迁移 | 节点属性结构会变 | `FlowGraph.schema` 版本号 + 迁移函数（AI 会话的 v1→v2 迁移是现成范例） |

**需要你确认**：

1. 首版节点库范围：先做**通用节点 + 半导体图标包**，还是一上来就细分到每种工序/设备？
2. 保存：本地草稿够不够，还是需要服务端保存（涉及后端）？
3. P2 里最想先要哪个：AI 生成（E7）、设备绑定（E2）、自动布局（E1）？
4. 是否要支持多人协作（决定数据模型要不要提前为协同预留）？
