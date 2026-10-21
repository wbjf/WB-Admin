<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElDrawer, ElEmpty, ElTabPane, ElTabs, ElTag } from 'element-plus'
import type { FlowIssue } from '@/types'
import type { SimResult } from './simulate'

interface Props {
  modelValue: boolean
  issues: FlowIssue[]
  simResult: SimResult | null
  simOpen: boolean
  graph?: unknown
}
const props = withDefaults(defineProps<Props>(), { graph: undefined })

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'update:simOpen', v: boolean): void
  (e: 'locate', ids: string[]): void
}>()

const { t } = useI18n()

const visible = computed({
  get: () => props.modelValue || props.simOpen,
  set: (v: boolean) => {
    emit('update:modelValue', v)
    emit('update:simOpen', v)
  }
})

const activeTab = computed(() => (props.simOpen ? 'sim' : 'issue'))

const errors = computed(() => props.issues.filter((i) => i.level === 'error'))
const warns = computed(() => props.issues.filter((i) => i.level === 'warn'))
const infos = computed(() => props.issues.filter((i) => i.level === 'info'))

function levelTag(level: FlowIssue['level']): 'danger' | 'warning' | 'info' {
  return level === 'error' ? 'danger' : level === 'warn' ? 'warning' : 'info'
}
</script>

<template>
  <el-drawer v-model="visible" :title="t('flow.checkResult')" size="380px" append-to-body>
    <el-tabs :model-value="activeTab">
      <el-tab-pane :label="`${t('flow.issues')} (${issues.length})`" name="issue">
        <el-empty v-if="!issues.length" :description="t('flow.noIssue')" :image-size="60" />
        <div v-else class="issue-list">
          <div
            v-for="(i, idx) in [...errors, ...warns, ...infos]"
            :key="idx"
            class="issue"
            @click="emit('locate', i.nodeIds || [])"
          >
            <el-tag :type="levelTag(i.level)" size="small">
              {{
                i.level === 'error'
                  ? t('flow.error')
                  : i.level === 'warn'
                    ? t('flow.warn')
                    : t('flow.info')
              }}
            </el-tag>
            <span class="msg">{{ i.message }}</span>
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane :label="t('flow.simulate')" name="sim">
        <el-empty v-if="!simResult" :description="t('flow.noSimResult')" :image-size="60" />
        <div v-else class="sim">
          <p v-if="simResult.hasCycle" class="tip">{{ t('flow.hasCycle') }}</p>
          <div class="kv">
            <span>{{ t('flow.totalCycleTime') }}</span>
            <b>{{ simResult.totalCycleTime }} {{ t('flow.minute') }}</b>
          </div>
          <div class="kv">
            <span>{{ t('flow.criticalPath') }}</span>
            <b>{{ simResult.criticalPath.length }} {{ t('flow.steps') }}</b>
          </div>
          <div class="kv">
            <span>{{ t('flow.yield') }}</span>
            <b>{{ (simResult.yield * 100).toFixed(2) }}%</b>
          </div>
          <div v-if="simResult.bottlenecks.length" class="kv">
            <span>{{ t('flow.bottleneck') }}</span>
            <b>{{ simResult.bottlenecks.length }} {{ t('flow.nodes2') }}</b>
          </div>
          <div v-if="simResult.missingCycleTime.length" class="kv">
            <span>{{ t('flow.missingCycleTime') }}</span>
            <b>{{ simResult.missingCycleTime.length }}</b>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>
  </el-drawer>
</template>

<style scoped>
.issue-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.issue {
  display: flex;
  gap: 6px;
  align-items: flex-start;
  padding: 8px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
}
.issue:hover {
  border-color: var(--el-color-primary);
}
.issue .msg {
  flex: 1;
  line-height: 1.5;
}
.sim .kv {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  border-bottom: 1px dashed var(--el-border-color-lighter);
  font-size: 13px;
}
.sim .tip {
  color: var(--el-color-warning);
  font-size: 12px;
}
</style>
