# 代码生成器

`code-generator/cli.js`，**零依赖**（只用 Node 内置模块），不污染项目依赖。

## 交互模式

```bash
npm run gen
```

按提示输入：表名、业务名、模块名、功能描述，然后逐列配置（字段名、类型、是否必填、是否列表显示、是否查询条件、控件类型）。

## 命令行模式

```bash
npm run gen -- \
  --table sys_product \
  --name product \
  --module mall \
  --comment 商品管理 \
  --columns "product_id:bigint:商品ID:1:0:0,product_name:varchar(200):商品名称:1:1:1:input"
```

## 产出

```text
generated/<name>/
├─ api.ts        # 类型化接口（list/detail/add/update/remove/export）
├─ types.ts      # VO / Query 类型
├─ index.vue     # 基于 ProTable + ProForm 的完整 CRUD 页
└─ menu.sql      # 可直接执行的菜单与按钮权限 SQL
```

生成的页面直接可用，风格与手写页面一致（同样的 ProTable、同样的列设置、同样的权限指令）。

## 字段类型 → 控件类型映射

| 数据库类型 | 控件 |
| --- | --- |
| `int` `bigint` `decimal` | `number` |
| `date` `datetime` `timestamp` | `date` / `daterange`（列表查询时） |
| `text` `longtext` | `textarea` |
| `char` `varchar` | `input` |
| `tinyint(1)` | `switch` |
| 字段名含 `status` | `dict` / `radio` |
| 字段名含 `time` | `date` |

## 生成后要做什么

1. 把 `api.ts` / `types.ts` 拷进 `src/api/` 与 `src/types/`。
2. 把 `index.vue` 放进 `src/views/<module>/<name>/index.vue`。
3. 执行 `menu.sql`，给角色授权。
4. 刷新页面，新菜单与按钮权限自动生效。

## 定制模板

模板就在 `cli.js` 里的几个 `render*` 函数，直接改字符串即可。想换成自己的代码风格、加上公司版权头、换成 Ant Design 组件库，改一处就全局生效。
