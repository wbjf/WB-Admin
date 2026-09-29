# 指令

`src/directives/` 下是全局注册的自定义指令。

## v-hasPermi

按钮级权限。没权限直接**从 DOM 移除**元素（不是 `display:none`）。

```vue
<el-button v-hasPermi="['system:user:add']">新增</el-button>
<el-button v-hasPermi="['system:user:edit', 'system:user:add']">编辑</el-button>   <!-- 任一命中即可 -->
```

数组语义是 **OR**。要 AND 就嵌套使用或改用 `hasPermi` 函数。

超级管理员绕过：`isSuperAdmin` 为 true 时一律放行。

## v-hasRole

```vue
<el-button v-hasRole="['admin']">系统设置</el-button>
```

## v-copy

点击复制。

```vue
<el-button v-copy="row.token">复制 Token</el-button>
<el-button v-copy="{ text: row.id, tip: 'ID 已复制' }">复制</el-button>
```

## v-debounce

```vue
<el-button v-debounce="save">保存</el-button>
<el-input v-debounce="[onSearch, 500]" />
```

## v-longpress

长按触发，移动端常用。

```vue
<div v-longpress="onLongPress">长按我</div>
```

## v-drag

让元素可拖拽（基于 `sortablejs`）。也能拖拽排序：

```vue
<el-table v-drag="{ handle: '.drag-handle', onEnd: onReorder }" />
```

## v-watermark

```vue
<div v-watermark="{ text: 'admin · U1' }">…</div>
```

用 canvas 画出文字图片再铺成 `background-repeat`。比 DOM 循环生成一堆 `<span>` 性能好得多，也不会干扰子元素的事件。

## 为什么用指令而不是组件

指令的优势是**不产生额外 DOM 层级**。表格里 200 行的操作列如果每条都套一个权限组件，就会多 200 个包装节点。指令是直接操作真实元素，零成本。
