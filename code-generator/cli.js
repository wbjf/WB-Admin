/**
 * WB-Admin 代码生成器 CLI
 *
 * 用法：
 *   npm run gen                 交互模式（命令行问答）
 *   node code-generator/cli.js --table sys_user --module system --name user --comment 用户
 *
 * 产出（默认写入 ./generated/<name>/）：
 *   api.ts       接口层（含分页查询、增删改）
 *   types.ts     类型定义
 *   index.vue    列表页（SearchForm + ProTable）
 *   form.vue     表单弹窗（ProDialog + ProForm）
 *   menu.sql     菜单与按钮权限 SQL
 */
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'

const ROOT = path.resolve(process.cwd())
const OUT_DIR = path.join(ROOT, 'generated')

interface Column {
  name: string
  type: 'string' | 'number' | 'boolean' | 'date'
  comment: string
  required: boolean
  inList: boolean
  inQuery: boolean
  inForm: boolean
  widget: 'input' | 'textarea' | 'number' | 'select' | 'switch' | 'date' | 'daterange' | 'radio'
  dictType?: string
}

interface GenConfig {
  table: string
  module: string
  name: string
  comment: string
  packageName: string
  author: string
  columns: Column[]
  pk: string
}

function pkgName(name: string): string {
  return name.replace(/[-_](\w)/g, (_, c) => c.toUpperCase())
}

function upperFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** 极简 TS 类型推断（真实场景建议从 information_schema 读取） */
function inferType(sqlType: string): Column['type'] {
  const t = sqlType.toLowerCase()
  if (/(int|decimal|float|double|number|bigint|tinyint)/.test(t)) return 'number'
  if (/(date|time)/.test(t)) return 'date'
  if (/(bit|bool)/.test(t)) return 'boolean'
  return 'string'
}

function widgetOf(name: string, type: Column['type']): Column['widget'] {
  if (/status|state|enabled|is_/.test(name)) return type === 'boolean' ? 'switch' : 'radio'
  if (/remark|content|desc/.test(name)) return 'textarea'
  if (/time|date/.test(name)) return 'date'
  if (type === 'number') return 'number'
  return 'input'
}

/** 生成接口层 */
function renderApi(cfg: GenConfig): string {
  const Type = upperFirst(pkgName(cfg.name))
  return `import { http } from '@/utils/request'
import type { PageQuery, PageResult } from '@/types'
import type { ${Type}VO } from './types'

export interface ${Type}Query extends PageQuery {
${cfg.columns
  .filter((c) => c.inQuery)
  .map((c) => `  ${c.name}?: ${c.type === 'number' ? 'number' : 'string'}`)
  .join('\n')}
}

export const ${pkgName(cfg.name)}Api = {
  list: (params: ${Type}Query) => http.get<PageResult<${Type}VO>>('/${cfg.module}/${cfg.name}/list', params),
  detail: (id: string) => http.get<${Type}VO>('/${cfg.module}/${cfg.name}/{id}'.replace('{id}', id)),
  add: (data: Partial<${Type}VO>) => http.post<void>('/${cfg.module}/${cfg.name}', data),
  update: (data: Partial<${Type}VO>) => http.put<void>('/${cfg.module}/${cfg.name}', data),
  remove: (ids: string | string[]) =>
    http.del<void>('/${cfg.module}/${cfg.name}', { ids: Array.isArray(ids) ? ids.join(',') : ids })
}
`
}

/** 生成类型 */
function renderTypes(cfg: GenConfig): string {
  const Type = upperFirst(pkgName(cfg.name))
  return `export interface ${Type}VO {
${cfg.columns
  .map((c) => `  /** ${c.comment || c.name} */\n  ${c.name}${c.required ? '' : '?'}: ${c.type === 'date' ? 'string' : c.type}`)
  .join('\n')}
}
`
}

/** 生成列表页 */
function renderIndex(cfg: GenConfig): string {
  const Type = upperFirst(pkgName(cfg.name))
  const api = `${pkgName(cfg.name)}Api`
  const listCols = cfg.columns
    .filter((c) => c.inList)
    .map((c) => `  { label: '${c.comment || c.name}', prop: '${c.name}', minWidth: ${c.type === 'date' ? 170 : 120}${c.dictType ? `, slot: '${c.name}'` : ''} }`)
    .join(',\n')
  const queryFields = cfg.columns
    .filter((c) => c.inQuery)
    .map((c) => {
      if (c.widget === 'daterange' || (c.type === 'date' && c.inQuery))
        return `  { prop: '${c.name}', label: '${c.comment || c.name}', type: 'daterange' }`
      if (c.dictType) return `  { prop: '${c.name}', label: '${c.comment || c.name}', type: 'dict', dictType: '${c.dictType}' }`
      return `  { prop: '${c.name}', label: '${c.comment || c.name}', type: 'input' }`
    })
    .join(',\n')
  const dictTags = cfg.columns.filter((c) => c.dictType && c.inList)

  return `<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import SearchForm from '@/components/SearchForm/index.vue'
import ProTable from '@/components/ProTable/index.vue'
import ProDialog from '@/components/ProDialog.vue'
import ${cfg.dictTags ? "DictTag from '@/components/Dict/DictTag.vue'" : ''}
import type { TableColumn } from '@/components/ProTable/types'
import { ${api}, type ${Type}Query } from './api'
import type { ${Type}VO } from './types'
import { t } from '@/locales'

defineOptions({ name: '${Type}List' })

const tableRef = ref<any>(null)
const query = ref<${Type}Query>({})
const selected = ref<${Type}VO[]>([])
const visible = ref(false)
const form = ref<Partial<${Type}VO>>({})
const currentId = ref('')
const submitting = ref(false)

const columns = ref<TableColumn[]>([
${listCols},
  { label: t('common.operate'), prop: 'operation', slot: 'operation', width: 200, fixed: 'right', sortable: false }
])

const searchSchemas = [
${queryFields}
]

async function request(params: Record<string, any>) {
  const res = await ${api}.list({ ...query.value, ...params })
  return { list: res.list ?? [], total: res.total ?? 0 }
}

function openAdd() {
  currentId.value = ''
  form.value = {}
  visible.value = true
}

async function openEdit(row: ${Type}VO) {
  currentId.value = row.${cfg.pk}
  form.value = await ${api}.detail(row.${cfg.pk})
  visible.value = true
}

async function submit() {
  submitting.value = true
  try {
    if (currentId.value) await ${api}.update({ ...form.value, ${cfg.pk}: currentId.value })
    else await ${api}.add(form.value)
    ElMessage.success(t('common.success'))
    visible.value = false
    tableRef.value?.reload()
  } finally {
    submitting.value = false
  }
}

async function remove(ids?: string) {
  const targets = ids ?? selected.value.map((r) => r.${cfg.pk}).join(',')
  if (!targets) return ElMessage.warning(t('common.selectAtLeastOne'))
  await ${api}.remove(targets.split(','))
  ElMessage.success(t('common.success'))
  tableRef.value?.reload()
}
</script>

<template>
  <div class="wb-page">
    <SearchForm v-model="query" :schemas="searchSchemas" @search="tableRef?.reload()" />
    <div class="wb-card">
      <ProTable
        ref="tableRef"
        row-key="${cfg.pk}"
        :columns="columns"
        :request="request"
        :selection="true"
        @selection-change="(rows: any) => (selected = rows)"
      >
        <template #toolbar-left>
          <el-button v-hasPermi="['${cfg.module}:${cfg.name}:add']" type="primary" @click="openAdd">
            {{ t('common.add') }}
          </el-button>
          <el-button
            v-hasPermi="['${cfg.module}:${cfg.name}:remove']"
            plain
            :disabled="!selected.length"
            @click="remove()"
          >
            {{ t('common.delete') }}
          </el-button>
        </template>
${dictTags
  .map(
    (c) => `
        <template #${c.name}="{ row }">
          <DictTag dict-type="${c.dictType}" :value="row.${c.name}" />
        </template>`
  )
  .join('')}
        <template #operation="{ row }">
          <el-button v-hasPermi="['${cfg.module}:${cfg.name}:edit']" link type="primary" @click="openEdit(row)">
            {{ t('common.edit') }}
          </el-button>
          <el-button v-hasPermi="['${cfg.module}:${cfg.name}:remove']" link type="danger" @click="remove(row.${cfg.pk})">
            {{ t('common.delete') }}
          </el-button>
        </template>
      </ProTable>
    </div>

    <ProDialog v-model="visible" :title="currentId ? t('common.edit') : t('common.add')" :loading="submitting" @confirm="submit">
      <el-form :model="form" label-width="100px">
${cfg.columns
  .filter((c) => c.inForm)
  .map((c) => {
    if (c.widget === 'textarea')
      return `        <el-form-item label="${c.comment || c.name}"><el-input v-model="form.${c.name}" type="textarea" /></el-form-item>`
    if (c.widget === 'number')
      return `        <el-form-item label="${c.comment || c.name}"><el-input-number v-model="form.${c.name}" /></el-form-item>`
    if (c.widget === 'switch')
      return `        <el-form-item label="${c.comment || c.name}"><el-switch v-model="form.${c.name}" /></el-form-item>`
    if (c.widget === 'date')
      return `        <el-form-item label="${c.comment || c.name}"><el-date-picker v-model="form.${c.name}" value-format="YYYY-MM-DD HH:mm:ss" /></el-form-item>`
    return `        <el-form-item label="${c.comment || c.name}"${c.required ? ' required' : ''}><el-input v-model="form.${c.name}" /></el-form-item>`
  })
  .join('\n')}
      </el-form>
    </ProDialog>
  </div>
</template>
`
}

/** 生成菜单 + 按钮权限 SQL */
function renderMenuSql(cfg: GenConfig): string {
  const parentId = '1000'
  const perms = ['list', 'add', 'edit', 'remove']
  return `-- ${cfg.comment} 菜单与按钮权限（生成器产出，按需调整 parent_id）
INSERT INTO sys_menu (menu_id, parent_id, menu_name, path, component, perms, menu_type, visible, sort) VALUES
(${parentId}, 0, '${cfg.comment}管理', '/${cfg.name}', '${cfg.module}/${cfg.name}/index', '', 'C', '0', 1);
${perms
  .map(
    (p, i) =>
      `INSERT INTO sys_menu (menu_id, parent_id, menu_name, perms, menu_type, visible, sort) VALUES (${parentId}${i + 1}, ${parentId}, '${cfg.comment}${p === 'list' ? '查询' : p === 'add' ? '新增' : p === 'edit' ? '修改' : '删除'}', '${cfg.module}:${cfg.name}:${p}', 'F', '0', ${i + 1});`
  )
  .join('\n')}
`
}

function write(file: string, content: string): void {
  const target = path.join(OUT_DIR, cfg_name, file)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, content, 'utf-8')
  console.log(`  ✓ ${path.relative(ROOT, target)}`)
}

let cfg_name = ''

export function generate(cfg: GenConfig): string[] {
  cfg_name = cfg.name
  console.log(`\n生成模块：${cfg.comment}（${cfg.table}）`)
  write('api.ts', renderApi(cfg))
  write('types.ts', renderTypes(cfg))
  write('index.vue', renderIndex(cfg))
  write('menu.sql', renderMenuSql(cfg))
  console.log(`\n完成：${path.join('generated', cfg.name)}`)
  return [cfg.name]
}

/** 交互模式 */
async function prompt(question: string, fallback: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(`${question}（默认 ${fallback}）：`, (answer) => {
      rl.close()
      resolve(answer.trim() || fallback)
    })
  })
}

async function interactive(): Promise<void> {
  console.log('WB-Admin 代码生成器 —— 交互模式\n')
  const table = await prompt('数据表名', 'sys_demo')
  const name = await prompt('业务名（英文小驼峰）', table.replace(/^sys_/, ''))
  const comment = await prompt('模块中文名', name)
  const module = await prompt('所属模块', 'system')
  const raw = await prompt('字段（格式：字段名:类型:注释，逗号分隔）', 'id:int:主键,name:varchar:名称,status:tinyint:状态,create_time:datetime:创建时间')

  const columns: Column[] = raw.split(',').map((seg) => {
    const [field = seg, type = 'varchar', text = ''] = seg.split(':')
    const colName = field.replace(/([-_](\w))/g, (_, __, c) => c.toUpperCase())
    const kind = inferType(type)
    return {
      name: colName,
      type: kind,
      comment: text,
      required: colName === 'id',
      inList: colName !== 'id',
      inQuery: colName !== 'id',
      inForm: colName !== 'id',
      widget: widgetOf(colName, kind)
    }
  })

  generate({
    table,
    module,
    name,
    comment,
    packageName: 'com.wb.admin',
    author: 'wb',
    pk: 'id',
    columns
  })
}

/** 命令行参数模式 */
function fromArgs(argv: string[]): GenConfig | null {
  const map: Record<string, string> = {}
  argv.slice(2).forEach((arg) => {
    const [k, v] = arg.replace(/^--/, '').split('=')
    if (k) map[k] = v ?? ''
  })
  if (!map.table) return null
  const name = map.name || map.table.replace(/^sys_/, '')
  return {
    table: map.table,
    module: map.module || 'system',
    name,
    comment: map.comment || name,
    packageName: map.package || 'com.wb.admin',
    author: map.author || 'wb',
    pk: map.pk || 'id',
    columns: (map.columns
      ? map.columns.split(',')
      : ['id:int:主键', 'name:varchar:名称', 'status:tinyint:状态', 'create_time:datetime:创建时间']
    ).map((seg) => {
      const [field = seg, type = 'varchar', text = ''] = seg.split(':')
      const colName = field.replace(/([-_](\w))/g, (_, __, c) => c.toUpperCase())
      const kind = inferType(type)
      return {
        name: colName,
        type: kind,
        comment: text,
        required: colName === 'id',
        inList: colName !== 'id',
        inQuery: colName !== 'id',
        inForm: colName !== 'id',
        widget: widgetOf(colName, kind)
      }
    })
  }
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('cli.js')) {
  const cfg = fromArgs(process.argv)
  if (cfg) generate(cfg)
  else void interactive()
}
