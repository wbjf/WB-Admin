<script setup lang="ts">
import type { FlowGraph } from '@/types'
import FlowEditor from './index.vue'
import type { FlowEditorOptions } from './types'

/**
 * 只读嵌入视图（E15）。
 * 本质就是 `preset: 'mini' + readonly` 的 FlowEditor，
 * 单独出一层是为了让业务页写起来更短，也保证「只读」不会被误改成可编辑。
 */
const props = withDefaults(
  defineProps<{
    graph: FlowGraph
    height?: string
    /** 允许缩放平移（默认开）；关掉就是一张静态图 */
    interactive?: boolean
    config?: FlowEditorOptions
  }>(),
  { height: '320px', interactive: true, config: undefined }
)
</script>

<template>
  <FlowEditor
    :graph="graph"
    :height="height"
    readonly
    :config="{
      preset: 'mini',
      readonly: true,
      interactive: props.interactive,
      palette: { searchable: false, collapsible: false, draggable: false },
      persist: { draft: false, leaveGuard: false },
      ...(config || {})
    }"
    data-test="flow-viewer"
  />
</template>
