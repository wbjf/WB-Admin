# ImageCropper 图片裁剪

基于 `cropperjs` 的裁剪弹窗，产出 base64 或裁剪后的 File。

```vue
<ImageCropper v-model="visible" :src="rawImage" :aspect-ratio="1" @confirm="onCropped" />
```

## props

| prop | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `modelValue` | `boolean` | — | 弹窗显隐 |
| `src` | `string` | 必填 | 原图（url 或 base64） |
| `aspectRatio` | `number` | `NaN` | 宽高比；`NaN` 为自由裁剪 |
| `outputType` | `string` | `'image/png'` | 输出格式 |
| `maxWidth` / `maxHeight` | `number` | — | 输出尺寸上限 |

## 事件

| 事件 | 参数 | 说明 |
| --- | --- | --- |
| `confirm` | `{ base64, blob }` | 裁剪完成 |
| `cancel` | — | 取消 |

## 常见宽高比

```ts
1        // 头像
16 / 9   // 封面图
3 / 4    // 竖版海报
NaN      // 自由裁剪
```

## 与 ProUpload 配合

`ProUpload` 的 `crop` 属性内部就用它。单独用是为了「先裁剪再上传」，或裁剪完先本地预览、点保存才真正提交。

## 常见问题

**Q：原图是跨域 URL，裁剪报错？**
canvas 会因为污染而无法 `toDataURL`。解决方式：把图片下载到同域，或让图床返回 `Access-Control-Allow-Origin`，并给 `img` 加 `crossorigin="anonymous"`。
