# ProUpload 上传

封装 `el-upload`，统一处理上传地址、鉴权头、类型/大小校验、图片预览与裁剪。

## 用法

```vue
<ProUpload v-model="form.avatar" type="image" :limit="1" />
<ProUpload v-model="form.attachments" type="file" :limit="5" accept=".pdf,.docx" />
```

## props

| prop | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `modelValue` | `string \| string[]` | — | 文件 URL，多文件为数组 |
| `type` | `'image' \| 'file'` | `'file'` | image 走卡片预览，file 走文件列表 |
| `limit` | `number` | `1` | 最大数量 |
| `maxSize` | `number` | `10` | 单文件上限（MB） |
| `accept` | `string` | — | 原生 accept，如 `.png,.jpg` |
| `crop` | `boolean` | `false` | 图片是否先裁剪再上传 |
| `drag` | `boolean` | `false` | 是否拖拽上传 |
| `disabled` | `boolean` | `false` | 禁用 |

## 上传协议

- 地址取 `VITE_API_PREFIX + '/system/file/upload'`
- 请求头带 `Authorization`，复用 `getToken()`
- 期望响应：`{ code: 200, data: { url, name, size } }`

换成 OSS/COS 直传时，改 `src/components/ProUpload/index.vue` 里的 `action` 与 `headers`，或改用 `http-request` 自定义上传逻辑。

## 图片裁剪

```vue
<ProUpload v-model="form.avatar" type="image" crop />
```

裁剪弹窗基于 `cropperjs`，支持等比/自由、旋转、翻转、缩放。确认后产出 base64，再上传。

## 头像场景

个人中心里的头像上传有点特殊——它要立即生效并同步到顶栏。做法是上传成功后调用 `userStore.setProfile({ avatar })`，store 的持久化会自动落盘。

## 常见问题

**Q：上传成功但预览不显示？**
后端返回的 `url` 可能是相对路径。图片预览时要拼上 `VITE_API_BASE_URL`，否则浏览器会在前端域名下找图。

**Q：`limit=1` 时再传一张会变成两张？**
`el-upload` 的 `limit` 只拦截不替换。需要「覆盖式」上传时，在 `on-exceed` 里手动清空再传。
