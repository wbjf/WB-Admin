# EChart 图表

对 ECharts 的轻封装，负责三件事：**容器尺寸自适应、实例自动销毁、loading 状态**。

## 用法

```vue
<script setup lang="ts">
import { ref } from 'vue'

const option = ref({
  tooltip: { trigger: 'axis' },
  xAxis: { type: 'category', data: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'] },
  yAxis: { type: 'value' },
  series: [{ type: 'line', smooth: true, areaStyle: {}, data: [820, 932, 901, 934, 1290, 1330, 1320] }]
})
</script>

<template>
  <EChart :option="option" height="320px" />
</template>
```

## props

| prop | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `option` | `EChartsOption` | 必填 | 配置项，**响应式变化会自动重绘** |
| `height` | `string` | `'300px'` | 容器高度 |
| `loading` | `boolean` | `false` | 显示加载态 |
| `theme` | `string` | — | `'dark'` 等 |
| `autoResize` | `boolean` | `true` | 监听容器尺寸变化（含侧栏折叠） |

## 主题联动

暗色模式下图表要跟着变色，否则白底坐标轴配黑底容器，字都看不清。做法是在 `option` 里用 CSS 变量或在切换主题时重建 option。

## 按需引入

ECharts 全量引入约 1MB。只用到折线/柱状/饼图时，改 `src/components/EChart/index.vue` 顶部为按需注册：

```ts
import * as echarts from 'echarts/core'
import { LineChart, BarChart, PieChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([LineChart, BarChart, PieChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer])
```

配合 `manualChunks` 把 echarts 单独分包后，只有用到图表的页面才会加载它。

## 常见坑

**容器高度为 0 → 图表不显示。** 必须给 EChart 一个确定高度（`height` prop 或父容器有高度）。父容器用 `height: 100%` 而祖先没高度时，图表就是不渲染。

**`option` 深拷贝导致不更新。** 确保传入的是同一个响应式对象（`ref` / `reactive`），不要每次 render 都新建对象。
