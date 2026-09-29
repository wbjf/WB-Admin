# 工具函数

`src/utils/` 下的可复用函数。全站统一从这里取，不要在页面里重复造。

## src/utils/index.ts

| 函数 | 说明 |
| --- | --- |
| `buildTree(list, opts)` | 扁平数组 → 树。**入参是分页对象或 null 也能吃**，内部会先归一化 |
| `flattenTree(tree)` | 树 → 扁平数组 |
| `findTreeNode(tree, pred)` | 在树里查节点 |
| `findTreePath(tree, pred)` | 查节点路径（面包屑、级联回显用） |
| `toArray(res)` | **把分页对象 / 数组 / null 统一成数组** |
| `deepClone(obj)` | 深拷贝 |
| `uuid()` | 生成 ID |
| `formatTime(v, fmt?)` | 时间格式化（dayjs 封装） |
| `formatRelative(v)` | 相对时间（3 分钟前） |
| `addDateRange(params, range)` | `['2026-01-01','2026-01-31']` → `beginTime` / `endTime` |
| `pruneParams(obj)` | 剔除 `undefined` / `''` / `null`，避免拼出 `?status=` |
| `formatSize(bytes)` | 文件大小（1.2 MB） |
| `toThousands(n)` | 千分位 |
| `sleep(ms)` | 延时 |

### toArray 为什么重要

"接口到底返回数组还是分页对象" 是前后端对接最常见的返工点。少一层归一化就是一次运行时崩溃：

```ts
// ❌ 后端返回 {list,total} 时崩在 .map 上
depts.value = await deptApi.list({})

// ✅
depts.value = toArray<DeptInfo>(await deptApi.list({}))
```

`buildTree` 内部也做了同样的兜底，所以「传错了」不会炸，只会得到空树。

## src/utils/validate.ts

`isEmail` / `isPhone` / `isIdCard` / `isUrl` / `isIPv4` / `isExternal` / `passwordLevel`

```ts
passwordLevel('Abc123!@')   // → 3（弱/中/强）
```

## src/utils/excel.ts

```ts
exportExcel({ columns, data, filename })   // 简单导出，不经过后端
readExcel(file)                            // 读成 JSON 数组
downloadTemplate(columns, filename)        // 下载导入模板
```

## src/utils/print.ts

```ts
printElement('#print-area')                       // 打印 DOM
printTable({ title, columns, data })              // 打印表格
```

## src/utils/download.ts

见 [请求层](/guide/request#文件下载)。

## src/utils/theme.ts

`generatePrimaryPalette` / `applyPrimaryColor` / `applyThemeToDom` / `PRESET_COLORS`

## src/utils/permission.ts

`hasPermi` / `hasRole` / `hasAnyPermi` —— 与 `v-hasPermi` 指令共用同一套判断逻辑。
