# 主题与布局

## 主色换肤

主色不是写死几个变量，而是**生成 9 级色阶**再注入 Element Plus 的 CSS 变量：

```ts
import { generatePrimaryPalette, applyPrimaryColor } from '@/utils/theme'

applyPrimaryColor('#5b8ff9')
// → 写入 --el-color-primary 及 --el-color-primary-light-{3,5,7,8,9}、dark-2 等
```

原理是用目标色与白/黑按比例混合，色阶平滑，不会出现「改了主色但 hover 态还是旧的」。

## 预设色

`PRESET_COLORS` 内置 12 个常用色，设置面板里点一下即可切换。

## 模式

| 模式 | 实现 |
| --- | --- |
| 暗黑 | `document.documentElement.classList.add('dark')` + EP 暗色变量 |
| 灰色 | `filter: grayscale(100%)` |
| 色弱 | `filter: invert(80%)` |
| 紧凑 | 覆盖 `--wb-*` 间距变量 |

## 首屏防闪白

`index.html` 里有一段**内联、同步执行**的脚本，在 Vue 挂载之前读取 `localStorage['wb-admin-theme']` 并写入 html 的 class 与 CSS 变量。

> 没有这段，暗色模式下刷新页面会先白一下再变黑，非常廉价。

## 布局

`layout` 取值：`side`（左侧菜单，默认）/ `top`（顶部菜单）/ `mix`（混合）。

```vue
<Sidebar v-if="settings.layout !== 'top'" />
```

相关开关都在设置抽屉里：标签页、固定头部、页脚、侧栏折叠、水印。

## 水印

`v-watermark` 指令基于 canvas 生成图片铺背景，内容默认取当前用户名 + 工号：

```vue
<div v-watermark="{ text: 'admin · U1' }">…</div>
```

`settings.allowWatermark` 控制总开关。

## 响应式

`appStore.isMobile` 在窗口宽度 < 992 时置为 true，侧栏自动转为抽屉式并加遮罩。

## 快捷键

| 快捷键 | 行为 |
| --- | --- |
| `Ctrl / Cmd + K` | 打开菜单搜索 |
| `Ctrl / Cmd + L` | 锁屏 |
