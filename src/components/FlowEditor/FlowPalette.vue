<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElIcon, ElInput, ElTooltip } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import { iconSvg } from './icons'
import { searchPalette } from './palette'
import type { PaletteGroup, PaletteItem, ResolvedPalette } from './types'

interface Props {
  palette: ResolvedPalette
  /** 只读模式下整个面板不可拖 */
  readonly?: boolean
}
const props = withDefaults(defineProps<Props>(), { readonly: false })

const emit = defineEmits<{
  (e: 'drop', payload: { item: PaletteItem; clientX: number; clientY: number }): void
  (e: 'pick', item: PaletteItem): void
}>()

const { t } = useI18n()
const keyword = ref('')
/** 折叠的分组名 */
const collapsed = ref<Record<string, boolean>>({})
const dragging = ref<PaletteItem | null>(null)
const ghostPos = ref({ x: 0, y: 0 })

const groups = computed(() => {
  const kw = keyword.value
  return props.palette.groups
    .map((g: PaletteGroup) => ({ ...g, items: searchPalette(g.items, kw) }))
    .filter((g) => g.items.length > 0)
})

const total = computed(() => groups.value.reduce((n, g) => n + g.items.length, 0))

watch(
  () => props.palette.groups,
  () => {
    collapsed.value = {}
  },
  { deep: true }
)

function iconOf(item: PaletteItem): string {
  return typeof item.icon === 'string'
    ? iconSvg(item.icon, item.color || '#606266', 18)
    : iconSvg('default', '#606266', 18)
}

function toggle(name: string): void {
  if (!props.palette.collapsible) return
  collapsed.value[name] = !collapsed.value[name]
}

function isCollapsed(name: string): boolean {
  return !!collapsed.value[name]
}

/* ── 拖拽：自实现（不用 DndPanel，保持与面板一致的视觉） ── */
function startDrag(e: MouseEvent, item: PaletteItem): void {
  if (!props.palette.draggable || item.disabled || props.readonly) return
  dragging.value = item
  ghostPos.value = { x: e.clientX, y: e.clientY }
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}

function onMove(e: MouseEvent): void {
  ghostPos.value = { x: e.clientX, y: e.clientY }
}

function onUp(e: MouseEvent): void {
  window.removeEventListener('mousemove', onMove)
  window.removeEventListener('mouseup', onUp)
  const item = dragging.value
  dragging.value = null
  if (!item) return
  const el = document.elementFromPoint(e.clientX, e.clientY)
  // 只有落在画布里才创建节点，落在面板上视为取消
  if (el?.closest('.wb-flow-canvas')) {
    emit('drop', { item, clientX: e.clientX, clientY: e.clientY })
  }
}
</script>

<template>
  <aside class="wb-flow-palette">
    <div v-if="palette.searchable" class="pal-search">
      <el-input v-model="keyword" :placeholder="t('flow.searchNode')" clearable size="small">
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>
    </div>

    <div class="pal-list">
      <div v-for="g in groups" :key="g.name" class="pal-group">
        <h4 @click="toggle(g.name)">
          <span v-if="palette.collapsible" class="caret" :class="{ off: isCollapsed(g.name) }">
            ▾
          </span>
          <span class="gname">{{ g.name }}</span>
          <span class="count">{{ g.items.length }}</span>
        </h4>
        <div v-show="!isCollapsed(g.name)" class="pal-items">
          <el-tooltip
            v-for="item in g.items"
            :key="item.type"
            :content="palette.draggable ? t('flow.dragHint') : t('flow.dragDisabled')"
            placement="right"
            :show-after="600"
          >
            <div
              class="pal-chip"
              :class="{ disabled: item.disabled || !palette.draggable }"
              :data-test="'pal-' + item.type"
              @mousedown.prevent="startDrag($event, item)"
              @dblclick="emit('pick', item)"
            >
              <i class="ico" :style="{ color: item.color || '#606266' }" v-html="iconOf(item)" />
              <small>{{ item.label }}</small>
            </div>
          </el-tooltip>
        </div>
      </div>

      <p v-if="!total" class="pal-empty">{{ t('flow.noMatch') }}</p>
    </div>

    <slot name="extra" />

    <teleport to="body">
      <div
        v-if="dragging"
        class="wb-flow-ghost"
        :style="{ left: ghostPos.x + 12 + 'px', top: ghostPos.y + 12 + 'px' }"
      >
        {{ dragging.label }}
      </div>
    </teleport>
  </aside>
</template>

<style scoped>
.wb-flow-palette {
  width: 236px;
  flex: none;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--el-border-color-light);
  background: var(--el-bg-color);
  overflow: hidden;
}
.pal-search {
  padding: 8px 10px;
  flex: none;
}
.pal-list {
  flex: 1;
  overflow: auto;
  padding: 0 10px 12px;
}
.pal-group > h4 {
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 8px 0 6px;
  font-size: 12px;
  font-weight: 500;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  user-select: none;
}
.pal-group > h4 .count {
  margin-left: auto;
  color: var(--el-text-color-placeholder);
}
.pal-group > h4 .caret {
  transition: transform 0.15s;
  display: inline-block;
}
.pal-group > h4 .caret.off {
  transform: rotate(-90deg);
}
.pal-items {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}
.pal-chip {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 6px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  background: var(--el-bg-color);
  cursor: grab;
  user-select: none;
  font-size: 12px;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
}
.pal-chip:hover {
  border-color: var(--el-color-primary);
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.06);
}
.pal-chip.disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
.pal-chip .ico {
  display: flex;
  flex: none;
}
.pal-chip small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pal-empty {
  padding: 16px 4px;
  text-align: center;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}
</style>

<style>
.wb-flow-ghost {
  position: fixed;
  z-index: 3000;
  pointer-events: none;
  padding: 4px 10px;
  font-size: 12px;
  border-radius: 4px;
  background: var(--el-color-primary);
  color: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
}
</style>
