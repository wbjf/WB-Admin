<script setup lang="ts">
defineOptions({ name: 'ToolJob' })

import { computed, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormItemRule } from 'element-plus'
import { Cpu, Delete, Edit, Plus, Tickets, Timer } from '@element-plus/icons-vue'
import type { FormSchema } from '@/components/ProForm/types'
import SearchForm from '@/components/SearchForm/index.vue'
import ProTable from '@/components/ProTable/index.vue'
import ProDialog from '@/components/ProDialog.vue'
import type { TableColumn } from '@/components/ProTable/types'
import { jobApi } from '@/api/tool'
import { hasPermi } from '@/utils/permission'
import { useI18n } from 'vue-i18n'
import type { SysJob } from '@/types'

interface JobRow extends SysJob {
  misfirePolicy?: string
}

const { t } = useI18n()

/** ---------- 查询条件 ---------- */
const queryParams = reactive<{ jobName?: string; jobGroup?: string; status?: string }>({})

const searchSchemas = computed<FormSchema[]>(() => [
  { prop: 'jobName', label: t('tool.job.name'), type: 'input' },
  {
    prop: 'jobGroup',
    label: t('tool.job.group'),
    type: 'select',
    options: [
      { label: 'DEFAULT', value: 'DEFAULT' },
      { label: 'SYSTEM', value: 'SYSTEM' }
    ]
  },
  { prop: 'status', label: t('tool.job.status'), type: 'dict', dictType: 'sys_job_status' }
])

/** ---------- 表格 ---------- */
const tableRef = ref<any>(null)
const selected = ref<JobRow[]>([])

const columns = ref<TableColumn[]>([
  { label: '任务编号', prop: 'jobId', width: 100, sortable: false },
  { label: t('tool.job.name'), prop: 'jobName', minWidth: 160, sortable: false },
  { label: t('tool.job.group'), prop: 'jobGroup', width: 120, sortable: false },
  { label: t('tool.job.invoke'), prop: 'invokeTarget', minWidth: 220, sortable: false },
  { label: t('tool.job.cron'), prop: 'cronExpression', slot: 'cronExpression', minWidth: 150, sortable: false },
  { label: t('tool.job.status'), prop: 'status', slot: 'status', width: 100, sortable: false },
  { label: t('tool.job.nextTime'), prop: 'nextValidTime', minWidth: 170, sortable: false },
  {
    label: t('common.operate'),
    prop: 'operation',
    slot: 'operation',
    width: 260,
    fixed: 'right',
    sortable: false
  }
])

async function request(params: Record<string, any>): Promise<{ list: JobRow[]; total: number }> {
  const res: unknown = await jobApi.list({ ...queryParams, ...params })
  if (Array.isArray(res)) {
    return { list: res as JobRow[], total: (res as JobRow[]).length }
  }
  const page = (res ?? {}) as { list?: JobRow[]; total?: number }
  return { list: page.list ?? [], total: page.total ?? page.list?.length ?? 0 }
}

function onSelectionChange(rows: JobRow[]): void {
  selected.value = rows
}

function reload(): void {
  tableRef.value?.reload()
}

/** ---------- 表单 ---------- */
const formVisible = ref(false)
const formTitle = ref('')
const submitting = ref(false)
const currentId = ref('')
const formRef = ref<FormInstance>()
const form = reactive<Partial<JobRow>>({})

const formRules: Record<string, FormItemRule[]> = {
  jobName: [{ required: true, message: `请输入${t('tool.job.name')}`, trigger: ['blur', 'change'] }],
  jobGroup: [{ required: true, message: `请输入${t('tool.job.group')}`, trigger: ['blur', 'change'] }],
  invokeTarget: [{ required: true, message: `请输入${t('tool.job.invoke')}`, trigger: ['blur', 'change'] }],
  cronExpression: [
    { required: true, message: `请输入${t('tool.job.cron')}`, trigger: ['blur', 'change'] },
    {
      validator: (_rule: any, value: any, callback: any) => {
        const parts = String(value ?? '').trim().split(/\s+/)
        if (parts.length < 6 || parts.length > 7) {
          callback(new Error('cron 表达式需为 6 或 7 段，如 0 0/5 * * * ?'))
          return
        }
        callback()
      },
      trigger: ['blur', 'change']
    }
  ]
}

function resetForm(row?: Partial<JobRow>): void {
  Object.assign(form, {
    jobId: undefined,
    jobName: '',
    jobGroup: 'DEFAULT',
    invokeTarget: '',
    cronExpression: '0 0/5 * * * ?',
    concurrent: '1',
    status: '0',
    misfirePolicy: '1',
    ...row
  })
}

async function openAdd(): Promise<void> {
  currentId.value = ''
  resetForm()
  formTitle.value = `${t('common.add')}${t('menu.job')}`
  formVisible.value = true
}

async function openEdit(row: JobRow): Promise<void> {
  try {
    const detail = await jobApi.detail(row.jobId)
    currentId.value = row.jobId
    resetForm({ ...row, ...(detail ?? {}) })
  } catch (e: any) {
    ElMessage.error(e?.message || t('common.failed'))
    return
  }
  formTitle.value = `${t('common.edit')}${t('menu.job')}`
  formVisible.value = true
}

async function submitForm(): Promise<void> {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
  } catch {
    return
  }
  submitting.value = true
  try {
    if (currentId.value) {
      await jobApi.update({ ...form, jobId: currentId.value })
    } else {
      await jobApi.add(form)
    }
    ElMessage.success(t('common.success'))
    formVisible.value = false
    reload()
  } catch (e: any) {
    ElMessage.error(e?.message || t('common.failed'))
  } finally {
    submitting.value = false
  }
}

/** ---------- 操作 ---------- */
async function remove(ids?: string): Promise<void> {
  const targets = ids ?? selected.value.map((r) => r.jobId).join(',')
  if (!targets) {
    ElMessage.warning(t('common.selectAtLeastOne'))
    return
  }
  try {
    await ElMessageBox.confirm(t('common.confirmDelete'), t('common.tip'), {
      confirmButtonText: t('common.confirm'),
      cancelButtonText: t('common.cancel'),
      type: 'warning'
    })
  } catch {
    return
  }
  try {
    await jobApi.remove(targets.split(','))
    ElMessage.success(t('common.success'))
    reload()
  } catch (e: any) {
    ElMessage.error(e?.message || t('common.failed'))
  }
}

async function runOnce(row: JobRow): Promise<void> {
  try {
    await ElMessageBox.confirm(`确认立即执行一次「${row.jobName}」吗？`, t('common.tip'), {
      confirmButtonText: t('common.confirm'),
      cancelButtonText: t('common.cancel'),
      type: 'warning'
    })
  } catch {
    return
  }
  try {
    await jobApi.runOnce(row.jobId)
    ElMessage.success(t('common.success'))
    reload()
  } catch (e: any) {
    ElMessage.error(e?.message || t('common.failed'))
  }
}

async function changeStatus(row: JobRow, val: boolean): Promise<void> {
  try {
    await jobApi.changeStatus(row.jobId, val ? '0' : '1')
    row.status = val ? '0' : '1'
    ElMessage.success(t('common.success'))
  } catch (e: any) {
    ElMessage.error(e?.message || t('common.failed'))
  }
}

/** ---------- 调度日志 ---------- */
const logDrawer = ref(false)
const logTableRef = ref<any>(null)

const logColumns = ref<TableColumn[]>([
  { label: t('tool.job.name'), prop: 'jobName', minWidth: 150, sortable: false },
  { label: t('tool.job.invoke'), prop: 'invokeTarget', minWidth: 220, sortable: false },
  { label: t('common.status'), prop: 'status', slot: 'logStatus', width: 100, sortable: false },
  { label: '消耗时间', prop: 'costTime', slot: 'costTime', width: 110, sortable: false },
  { label: t('common.createTime'), prop: 'createTime', minWidth: 170, sortable: false }
])

async function logRequest(params: Record<string, any>): Promise<{ list: any[]; total: number }> {
  const res: unknown = await jobApi.logs({ pageNum: params.pageNum, pageSize: params.pageSize })
  if (Array.isArray(res)) return { list: res, total: res.length }
  const page = (res ?? {}) as { list?: any[]; total?: number }
  return { list: page.list ?? [], total: page.total ?? page.list?.length ?? 0 }
}

function openLogs(): void {
  logDrawer.value = true
  logTableRef.value?.reload()
}

async function cleanLogs(): Promise<void> {
  try {
    await ElMessageBox.confirm('确认清空全部调度日志吗？清空后不可恢复。', t('common.tip'), {
      confirmButtonText: t('common.confirm'),
      cancelButtonText: t('common.cancel'),
      type: 'warning'
    })
  } catch {
    return
  }
  try {
    await jobApi.cleanLogs()
    ElMessage.success(t('common.success'))
    logTableRef.value?.reload()
  } catch (e: any) {
    ElMessage.error(e?.message || t('common.failed'))
  }
}

/** ---------- cron 生成器 ---------- */
type FieldKey = 'second' | 'minute' | 'hour' | 'day' | 'month' | 'week' | 'year'
type CronMode = 'every' | 'cycle' | 'loop' | 'specify' | 'none'

interface CronField {
  mode: CronMode
  cycleStart: number
  cycleEnd: number
  loopStart: number
  loopStep: number
  specify: number[]
}

interface FieldDef {
  key: FieldKey
  label: string
  min: number
  max: number
  /** 允许「不指定」（输出 ?） */
  allowNone: boolean
  labels?: string[]
}

const WEEK_LABELS = ['周日 SUN', '周一 MON', '周二 TUE', '周三 WED', '周四 THU', '周五 FRI', '周六 SAT']
const WEEK_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const CURRENT_YEAR = new Date().getFullYear()

const fieldDefs: FieldDef[] = [
  { key: 'second', label: '秒', min: 0, max: 59, allowNone: false },
  { key: 'minute', label: '分', min: 0, max: 59, allowNone: false },
  { key: 'hour', label: '时', min: 0, max: 23, allowNone: false },
  { key: 'day', label: '日', min: 1, max: 31, allowNone: true },
  { key: 'month', label: '月', min: 1, max: 12, allowNone: false },
  { key: 'week', label: '周', min: 1, max: 7, allowNone: true, labels: WEEK_LABELS },
  { key: 'year', label: '年', min: CURRENT_YEAR, max: CURRENT_YEAR + 10, allowNone: true }
]

const cronPresets = [
  { label: '每 1 分钟', value: '0 0/1 * * * ?' },
  { label: '每 5 分钟', value: '0 0/5 * * * ?' },
  { label: '每小时整点', value: '0 0 * * * ?' },
  { label: '每天 01:00', value: '0 0 1 * * ?' },
  { label: '每天 12:00', value: '0 0 12 * * ?' },
  { label: '每周一 01:00', value: '0 0 1 ? * MON' },
  { label: '每月 1 号 01:00', value: '0 0 1 1 * ?' }
]

const cronVisible = ref(false)
const cronActiveTab = ref<FieldKey>('second')
const cronFields = reactive<Record<FieldKey, CronField>>({
  second: { mode: 'specify', cycleStart: 0, cycleEnd: 59, loopStart: 0, loopStep: 5, specify: [0] },
  minute: { mode: 'every', cycleStart: 0, cycleEnd: 59, loopStart: 0, loopStep: 5, specify: [0] },
  hour: { mode: 'every', cycleStart: 0, cycleEnd: 23, loopStart: 0, loopStep: 1, specify: [0] },
  day: { mode: 'every', cycleStart: 1, cycleEnd: 31, loopStart: 1, loopStep: 1, specify: [1] },
  month: { mode: 'every', cycleStart: 1, cycleEnd: 12, loopStart: 1, loopStep: 1, specify: [1] },
  week: { mode: 'none', cycleStart: 1, cycleEnd: 7, loopStart: 1, loopStep: 1, specify: [2] },
  year: { mode: 'none', cycleStart: CURRENT_YEAR, cycleEnd: CURRENT_YEAR + 10, loopStart: CURRENT_YEAR, loopStep: 1, specify: [CURRENT_YEAR] }
})

function numbers(min: number, max: number): number[] {
  return Array.from({ length: max - min + 1 }, (_, i) => min + i)
}

function numberLabel(def: FieldDef, n: number): string {
  return def.labels ? def.labels[n - def.min] : String(n)
}

function toNumber(def: FieldDef, token: string): number {
  if (def.key === 'week') {
    const idx = WEEK_NAMES.indexOf(token.toUpperCase())
    if (idx > -1) return idx + 1
  }
  return Number(token)
}

/** 把已有表达式回填到生成器 */
function fillCronField(def: FieldDef, expr: string): void {
  const f = cronFields[def.key]
  if (!expr || expr === '?') {
    f.mode = def.allowNone ? 'none' : 'every'
    return
  }
  if (expr === '*') {
    f.mode = 'every'
    return
  }
  if (expr.includes('/')) {
    const [start, step] = expr.split('/')
    f.mode = 'loop'
    f.loopStart = toNumber(def, start.replace('*', String(def.min))) || def.min
    f.loopStep = toNumber(def, step) || 1
    return
  }
  if (expr.includes('-')) {
    const [start, end] = expr.split('-')
    f.mode = 'cycle'
    f.cycleStart = toNumber(def, start) || def.min
    f.cycleEnd = toNumber(def, end) || def.max
    return
  }
  const tokens = expr.split(',')
  const values = tokens
    .map((k) => toNumber(def, k))
    .filter((v) => !Number.isNaN(v) && v >= def.min && v <= def.max)
  if (values.length) {
    f.mode = 'specify'
    f.specify = values
    return
  }
  f.mode = def.allowNone ? 'none' : 'every'
}

function openCronGen(): void {
  const parts = String(form.cronExpression ?? '').trim().split(/\s+/)
  if (parts.length >= 6) {
    fieldDefs.forEach((def, i) => {
      if (parts[i] !== undefined) fillCronField(def, parts[i])
    })
  }
  cronVisible.value = true
}

function buildField(key: FieldKey): string {
  const f = cronFields[key]
  if (f.mode === 'cycle') return `${f.cycleStart}-${f.cycleEnd}`
  if (f.mode === 'loop') return `${f.loopStart}/${f.loopStep}`
  if (f.mode === 'specify') {
    if (!f.specify.length) return '*'
    const tokens = [...f.specify].sort((a, b) => a - b).map((v) => (key === 'week' ? WEEK_NAMES[v - 1] : String(v)))
    return tokens.join(',')
  }
  if (f.mode === 'none') return '?'
  return '*'
}

const cronResult = computed(() => {
  const weekPart = buildField('week')
  const dayRaw = buildField('day')
  // 与主流生成器一致：指定了「周」时，「日」为 ?；否则 ? 不能出现在两个字段
  const dayPart = weekPart === '?' ? dayRaw : dayRaw === '*' ? '?' : dayRaw
  const head = [buildField('second'), buildField('minute'), buildField('hour'), dayPart, buildField('month'), weekPart]
  const yearPart = buildField('year')
  const tail = yearPart && yearPart !== '?' ? ` ${yearPart}` : ''
  return `${head.join(' ')}${tail}`
})

function applyCron(): void {
  form.cronExpression = cronResult.value
  cronVisible.value = false
}

function applyPreset(value: string): void {
  form.cronExpression = value
  const parts = value.trim().split(/\s+/)
  fieldDefs.forEach((def, i) => {
    if (parts[i] !== undefined) fillCronField(def, parts[i])
  })
}
</script>

<template>
  <div class="wb-page wb-tool-job">
    <SearchForm v-model="queryParams" :schemas="searchSchemas" @search="reload()" />

    <div class="wb-card">
      <ProTable
        ref="tableRef"
        row-key="jobId"
        :columns="columns"
        :request="request"
        :selection="true"
        export-name="wb-job"
        print-title="定时任务列表"
        @selection-change="onSelectionChange"
      >
        <template #toolbar-left>
          <el-button v-hasPermi="['monitor:job:add']" type="primary" @click="openAdd">
            <el-icon><Plus /></el-icon>{{ t('common.add') }}
          </el-button>
          <el-button v-hasPermi="['monitor:job:remove']" plain :disabled="!selected.length" @click="remove()">
            <el-icon><Delete /></el-icon>{{ t('common.delete') }}
          </el-button>
          <el-button v-hasPermi="['monitor:job:list']" plain @click="openLogs">
            <el-icon><Tickets /></el-icon>{{ t('tool.job.log') }}
          </el-button>
        </template>

        <template #cronExpression="{ row }">
          <el-link type="primary" :underline="false" @click="openEdit(row as JobRow)">
            <el-icon class="wb-tool-job__cron-icon"><Timer /></el-icon>{{ row.cronExpression }}
          </el-link>
        </template>

        <template #status="{ row }">
          <el-switch
            :model-value="row.status === '0'"
            :disabled="!hasPermi(['monitor:job:edit'])"
            @change="(v: any) => changeStatus(row as JobRow, v)"
          />
        </template>

        <template #operation="{ row }">
          <el-button v-hasPermi="['monitor:job:edit']" link type="primary" @click="openEdit(row as JobRow)">
            <el-icon><Edit /></el-icon>{{ t('common.edit') }}
          </el-button>
          <el-button v-hasPermi="['monitor:job:edit']" link type="success" @click="runOnce(row as JobRow)">
            <el-icon><Cpu /></el-icon>{{ t('tool.job.runOnce') }}
          </el-button>
          <el-button v-hasPermi="['monitor:job:remove']" link type="danger" @click="remove(row.jobId)">
            <el-icon><Delete /></el-icon>{{ t('common.delete') }}
          </el-button>
        </template>
      </ProTable>
    </div>

    <!-- 任务表单 -->
    <ProDialog v-model="formVisible" :title="formTitle" width="640px" :loading="submitting" @confirm="submitForm">
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="110px">
        <el-form-item :label="t('tool.job.name')" prop="jobName">
          <el-input v-model="form.jobName" :placeholder="`请输入${t('tool.job.name')}`" clearable />
        </el-form-item>
        <el-form-item :label="t('tool.job.group')" prop="jobGroup">
          <el-select v-model="form.jobGroup" filterable allow-create default-first-option style="width: 100%">
            <el-option label="DEFAULT" value="DEFAULT" />
            <el-option label="SYSTEM" value="SYSTEM" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('tool.job.invoke')" prop="invokeTarget">
          <el-input
            v-model="form.invokeTarget"
            type="textarea"
            :rows="2"
            placeholder="示例：wbTask.syncUser('system')"
          />
        </el-form-item>
        <el-form-item :label="t('tool.job.cron')" prop="cronExpression">
          <div class="wb-tool-job__cron">
            <el-input v-model="form.cronExpression" placeholder="示例：0 0/5 * * * ?" clearable />
            <el-button :icon="Timer" plain @click="openCronGen">{{ t('tool.job.cronGen') }}</el-button>
          </div>
        </el-form-item>
        <el-form-item :label="t('tool.job.concurrent')">
          <el-radio-group v-model="form.concurrent">
            <el-radio value="0">允许并发</el-radio>
            <el-radio value="1">禁止并发</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item :label="t('tool.job.status')">
          <el-radio-group v-model="form.status">
            <el-radio value="0">{{ t('common.enabled') }}</el-radio>
            <el-radio value="1">{{ t('common.disabled') }}</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
    </ProDialog>

    <!-- cron 生成器 -->
    <ProDialog
      v-model="cronVisible"
      :title="t('tool.job.cronGen')"
      width="720px"
      confirm-text="使用该表达式"
      @confirm="applyCron"
    >
      <div class="wb-tool-job__presets">
        <el-tag
          v-for="item in cronPresets"
          :key="item.value"
          class="wb-tool-job__preset"
          effect="plain"
          @click="applyPreset(item.value)"
        >
          {{ item.label }} · {{ item.value }}
        </el-tag>
      </div>

      <el-input :model-value="cronResult" readonly size="large">
        <template #prepend>表达式</template>
      </el-input>

      <el-tabs v-model="cronActiveTab" class="wb-tool-job__tabs">
        <el-tab-pane v-for="def in fieldDefs" :key="def.key" :label="def.label" :name="def.key">
          <el-radio-group v-model="cronFields[def.key].mode" class="wb-tool-job__modes">
            <el-radio value="every">每一{{ def.label }}</el-radio>
            <el-radio value="cycle">区间</el-radio>
            <el-radio value="loop">周期</el-radio>
            <el-radio value="specify">指定</el-radio>
            <el-radio v-if="def.allowNone" value="none">不指定</el-radio>
          </el-radio-group>

          <div v-if="cronFields[def.key].mode === 'cycle'" class="wb-tool-job__row">
            从
            <el-input-number v-model="cronFields[def.key].cycleStart" :min="def.min" :max="def.max" controls-position="right" />
            到
            <el-input-number v-model="cronFields[def.key].cycleEnd" :min="def.min" :max="def.max" controls-position="right" />
          </div>

          <div v-else-if="cronFields[def.key].mode === 'loop'" class="wb-tool-job__row">
            从
            <el-input-number v-model="cronFields[def.key].loopStart" :min="def.min" :max="def.max" controls-position="right" />
            开始，每
            <el-input-number v-model="cronFields[def.key].loopStep" :min="1" :max="def.max" controls-position="right" />
            {{ def.label }}执行一次
          </div>

          <div v-else-if="cronFields[def.key].mode === 'specify'" class="wb-tool-job__choices">
            <el-checkbox-group v-model="cronFields[def.key].specify">
              <el-checkbox v-for="n in numbers(def.min, def.max)" :key="n" :value="n">
                {{ numberLabel(def, n) }}
              </el-checkbox>
            </el-checkbox-group>
          </div>

          <div v-else class="wb-tool-job__row wb-text-muted">
            {{ cronFields[def.key].mode === 'none' ? `该字段不参与调度（生成 ?）` : `每个${def.label}都执行（生成 *）` }}
          </div>
        </el-tab-pane>
      </el-tabs>
    </ProDialog>

    <!-- 调度日志 -->
    <el-drawer v-model="logDrawer" :title="t('tool.job.log')" size="60%">
      <ProTable
        ref="logTableRef"
        row-key="jobLogId"
        :columns="logColumns"
        :request="logRequest"
      >
        <template #toolbar-left>
          <el-button v-hasPermi="['monitor:job:remove']" type="danger" plain @click="cleanLogs">
            <el-icon><Delete /></el-icon>清空日志
          </el-button>
        </template>

        <template #logStatus="{ row }">
          <el-tag :type="row.status === '0' ? 'success' : 'danger'" size="small" disable-transitions>
            {{ row.status === '0' ? t('monitor.loginlog.success') : t('monitor.loginlog.fail') }}
          </el-tag>
        </template>

        <template #costTime="{ row }">
          <span>{{ row.costTime }} ms</span>
        </template>
      </ProTable>
    </el-drawer>
  </div>
</template>

<style scoped lang="scss">
.wb-tool-job {
  &__cron {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
  }

  &__cron-icon {
    margin-right: 4px;
  }

  &__presets {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 12px;
  }

  &__preset {
    cursor: pointer;
  }

  &__tabs {
    margin-top: 12px;
  }

  &__modes {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    margin-bottom: 10px;
  }

  &__row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    font-size: 13px;
  }

  &__choices {
    max-height: 200px;
    overflow: auto;
    padding: 8px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 6px;

    :deep(.el-checkbox) {
      margin-right: 10px;
      min-width: 76px;
    }
  }
}
</style>
