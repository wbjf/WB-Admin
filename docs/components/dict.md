# DictSelect / DictTag

把「枚举值」从每个页面里抽出来，统一由字典 store 管理。

## 为什么需要它

不用字典的代码长这样：

```vue
<!-- ❌ 同一个状态枚举，在 8 个页面里各写一遍 -->
<el-option label="正常" value="0" />
<el-option label="停用" value="1" />
```

后端加一个状态，就要翻遍全站。改成字典后，只在字典管理页加一行数据，全站自动生效。

## DictSelect

```vue
<!-- 自动拉取并缓存 -->
<DictSelect v-model="queryParams.status" dict-type="sys_normal_disable" />

<!-- 多选 -->
<DictSelect v-model="form.tags" dict-type="demo_category" multiple />

<!-- 带「全部」选项 -->
<DictSelect v-model="queryParams.status" dict-type="sys_normal_disable" all />
```

## DictTag

```vue
<DictTag :value="row.status" dict-type="sys_normal_disable" />
<!-- 渲染成带颜色的 el-tag：「正常」绿 / 「停用」红 -->
```

颜色来自字典数据里的 `listClass` 字段（`success` / `danger` / `warning` / `info` / `primary`）。

## 在 script 里取字典

```ts
import { useDict } from '@/composables/useDict'

const { dict, getLabel, getOptions } = useDict('sys_normal_disable', 'sys_user_sex')

getLabel('sys_normal_disable', '0')    // → '正常'
getOptions('sys_user_sex')             // → [{label:'男',value:'0'}, …]
```

## 缓存策略

字典数据存在 `dict` store 里并持久化到 localStorage：

- 首次访问某 `dictType` → 请求 `/system/dict/data/type/{type}`
- 之后同 `dictType` 直接命中缓存
- 字典管理页修改后调用 `dictStore.clearCache()` 或 `configApi.refreshCache()` 刷新

## 后端返回结构

```json
{
  "code": 200,
  "data": [
    { "dictLabel": "正常", "dictValue": "0", "listClass": "success" },
    { "dictLabel": "停用", "dictValue": "1", "listClass": "danger" }
  ]
}
```

字段名不同的话，在 `stores/modules/dict.ts` 的映射函数里改一处即可。
