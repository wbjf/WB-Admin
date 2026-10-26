<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ElButton, ElMessage } from 'element-plus'
import type { FlowGraph, FlowIssue } from '@/types'
import { flowApi } from '@/api/flow'
import FlowEditor from '@/components/FlowEditor/index.vue'
import type { FlowEditorOptions } from '@/components/FlowEditor/types'
import { migrateFlow } from '@/components/FlowEditor/serialize'

defineOptions({ name: 'FlowEditorPage' })

/**
 * ⚠️ 页面模板的根节点必须是唯一的：在根节点前再写一行 HTML 注释，组件就变成多根节点，
 * 而 `.wb-app-main` 用的是「transition(mode=out-in) + keep-alive」，多根子节点拿不到
 * 单一子元素 —— 表现为「一旦离开本页，之后所有页面都空白」且没有任何报错。
 * 所以这类说明只能写在 script 里（见 test/unit/page-template-root.spec.ts）。
 * 页面容器统一用 `.wb-page`：内容区留白只由 `.wb-app-main` 提供一次（12px）。
 */
const { t } = useI18n()
const route = useRoute()
const router = useRouter()

/**
 * 编辑器的配置写在代码里，不在页面上摆开关。
 * 三层生效顺序：preset 档位 → configureFlowEditor() 全局默认 → 这里的单实例 config。
 * 想全站调整改 `src/config/flow.ts`；只改本页就动下面这个对象。
 * 用法见 docs/components/flow-editor.md。
 */
const editorConfig: FlowEditorOptions = { preset: 'pro' }

const flowId = computed(() => String(route.params.id || ''))
const readonly = computed(() => route.query.readonly === '1')
const loading = ref(false)
const graph = ref<FlowGraph | null>(null)
/** 编辑器最新的一份（保存必须用这个，不能用初始 prop —— 那个是旧引用） */
const current = ref<FlowGraph | null>(null)
const saving = ref(false)
const issues = ref<FlowIssue[]>([])

async function load(): Promise<void> {
  if (!flowId.value) return
  loading.value = true
  try {
    const g = await flowApi.detail(flowId.value)
    graph.value = g ? migrateFlow(g) : null
    current.value = graph.value
  } catch {
    ElMessage.error(t('flow.opFailed'))
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(flowId, load)

async function onSave(g: FlowGraph): Promise<void> {
  if (readonly.value) {
    ElMessage.warning(t('flow.saved'))
    return
  }
  saving.value = true
  try {
    await flowApi.saveGraph(flowId.value, g)
    ElMessage.success(t('flow.saved'))
  } catch {
    ElMessage.error(t('flow.opFailed'))
  } finally {
    saving.value = false
  }
}

function onValidate(list: FlowIssue[]): void {
  issues.value = list
}

function onChange(g: FlowGraph): void {
  current.value = g
}

function back(): void {
  router.push('/flow/index')
}
</script>

<template>
  <div class="wb-page">
    <div v-loading="loading" class="editor-wrap">
      <FlowEditor
        v-if="graph"
        :key="flowId"
        :graph="graph"
        :flow-id="flowId"
        :config="editorConfig"
        :readonly="readonly"
        @save="onSave"
        @change="onChange"
        @validate="onValidate"
      >
        <template #toolbar-left>
          <el-button size="small" data-test="flow-back" @click="back">
            {{ t('flow.backToList') }}
          </el-button>
        </template>
      </FlowEditor>
    </div>
  </div>
</template>

<style scoped>
.editor-wrap {
  /**
   * 撑满剩余高度：不再用 calc(100vh - 220px) 猜布局高度（窗口一变就溢出）。
   * min-height 兜底：视口太矮时不把画布压扁，改由 .wb-page 自己滚动。
   */
  flex: 1 1 0;
  min-height: 400px;
  display: flex;
}
.editor-wrap > * {
  flex: 1;
  min-width: 0;
}
</style>
