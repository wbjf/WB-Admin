# IconSelect 图标选择器

从 Element Plus 图标集里挑一个图标，产出图标名（字符串），存进菜单表的 `icon` 字段。

```vue
<IconSelect v-model="form.icon" />
```

## 能力

- 全量 Element Plus 图标网格展示
- 关键字搜索（支持中文名与英文名）
- 点击即选中，显示当前值
- 支持清空

## 存什么

存的是**图标组件名**，如 `Setting`、`User`、`Odometer`。

渲染时统一用动态组件：

```vue
<el-icon>
  <component :is="iconName" />
</el-icon>
```

> 图标名必须在 `src/types/global.d.ts` 里声明过，Vue 才能解析。新增图标时记得在那里补一行，否则控制台会警告 "Failed to resolve component"。

## 在菜单里怎么用

菜单表的 `icon` 字段由后端存，侧栏 `SidebarItem.vue` 读出来动态渲染。所以**换菜单图标不需要改前端代码**，在菜单管理页选一下就行。

## 自定义图标

用 iconfont / 阿里图标库时，把 `IconSelect` 里的图标列表源换掉，并让 `component :is` 能解析到对应的自定义组件即可。
