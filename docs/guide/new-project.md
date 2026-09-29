# 新项目落地五步法

拿到 WB-Admin 开一个新管理系统，按这个顺序走最快。

## 第 1 步：删掉不需要的页面

```bash
rm -rf src/views/system/{dict,config,notice,tenant}   # 新项目用不上就删
rm -rf src/views/monitor src/views/tool src/views/demo
```

**删完项目必须还能启动、能登录、能进首页。** 如果删完报错，说明有组件反向依赖了业务页面，去把那个依赖挪走——这是分层被破坏的信号，早发现早修。

## 第 2 步：改身份

| 位置 | 改什么 |
| --- | --- |
| `.env.*` | `VITE_APP_TITLE`、接口前缀、Mock 开关 |
| `public/favicon.svg` | 站点图标 |
| `src/utils/theme.ts` | `DEFAULT_THEME.primaryColor` 默认主色 |
| `index.html` | 底部版权、title |
| `src/locales/lang/*` | 品牌相关文案 |

## 第 3 步：接后端

1. `VITE_USE_MOCK=false`
2. `vite.config.ts` 的 proxy 指向后端
3. 对齐 `R<T>` 响应结构（不一致就改 `request.ts` 的解包逻辑）
4. 用 `npm run gen` 生成首批 CRUD 页面，比手写快得多

## 第 4 步：写业务

新页面的最小骨架：

```vue
<script setup lang="ts">
import type { ProTableColumn } from '@/components/ProTable/types'
import { myApi } from '@/api/my'

const columns: ProTableColumn[] = [
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
  <ProTable :columns="columns" :request="request">
    <template #operation="{ row }">
      <el-button v-hasPermi="['my:edit']" link type="primary" @click="openEdit(row)">编辑</el-button>
    </template>
  </ProTable>
</template>
```

分页、loading、刷新、导出、列设置、空状态全部自带。

## 第 5 步：收尾自检

- [ ] `npm run typecheck` 零错误
- [ ] `npm run test` 通过
- [ ] `npm run build` 成功
- [ ] 用真实浏览器跑一遍：登录 → 每个菜单点进去 → 新增/编辑/删除各一次
- [ ] `git status` 里没有临时文件

> 最后一条最容易漏。项目里有 `scripts/`、`dist/` 在 `.gitignore`，但根目录和 `docs/` 是跟踪范围，`_*.log` 这类临时产物提交前记得清掉。
