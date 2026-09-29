# Editor 富文本编辑器

两个编辑器：`WangEditor`（富文本，适合公告、文章）和 `MarkdownEditor`（Markdown，适合技术文档）。

## WangEditor

```vue
<script setup lang="ts">
import { ref } from 'vue'

const content = ref('<p>初始内容</p>')
const editorRef = ref()
</script>

<template>
  <WangEditor v-model="content" height="360px" placeholder="请输入内容" />
</template>
```

| prop | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `modelValue` | `string` | — | HTML 内容 |
| `height` | `string` | `'300px'` | 编辑区高度 |
| `readonly` | `boolean` | `false` | 只读 |
| `placeholder` | `string` | — | 占位文案 |
| `toolbar` | `object` | 默认全量 | 自定义工具栏 |

> wangEditor 是**声明式**的：不要在组件外手动 `new Editor()`。组件内部已经通过 `onMounted` 创建、`onBeforeUnmount` 销毁。手动创建会导致编辑器泄漏或「第二个实例不显示」。

## MarkdownEditor

```vue
<MarkdownEditor v-model="md" height="420px" />
```

基于 `md-editor-v3`，支持：

- 左侧编辑、右侧实时预览
- 代码高亮（highlight.js）
- 工具栏插图、表格、公式
- 目录、全屏、导出

## 提交时的注意点

富文本内容存 HTML，后端字段要够长（`longtext`），并且**入库前不做 HTML 转义**，否则存进去的是 `&lt;p&gt;`。防 XSS 应该在渲染侧做（白名单过滤），不是存储侧。

## 图片上传

两个编辑器都支持粘贴/拖拽上传图片。默认走的是 base64 内嵌，正式环境建议改成上传到文件服务后回填 URL：

```ts
const uploadImage = async (file: File) => {
  const form = new FormData()
  form.append('file', file)
  const res = await fileApi.upload(form)
  return res.url
}
```
