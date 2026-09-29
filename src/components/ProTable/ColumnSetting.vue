<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { TableColumn } from './types'

defineOptions({ name: 'ColumnSetting' })

const props = defineProps<{ visible: boolean; columns: TableColumn[] }>()
const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  (e: 'change', columns: TableColumn[]): void
}>()

const { t } = useI18n()

const dialogVisible = computed({
  get: () => props.visible,
  set: (v) => emit('update:visible', v)
})

function onToggle(item: TableColumn) {
  item.hidden = !item.hidden
  emit('change', props.columns)
}

function onFixed(item: TableColumn, value: '' | 'left' | 'right') {
  item.fixed = value || undefined
  emit('change', props.columns)
}

function move(index: number, delta: number) {
  const next = [...props.columns]
  const target = index + delta
  if (target < 0 || target >= next.length) return
  const temp = next[index]
  next[index] = next[target]
  next[target] = temp
  emit('change', next)
}

function resetAll() {
  props.columns.forEach((c) => (c.hidden = false))
  emit('change', props.columns)
}
</script>

<template>
  <el-popover v-model:visible="dialogVisible" placement="bottom-end" width="300" trigger="click">
    <template #reference>
      <!--
        这里必须包一层普通元素，别直接把 el-tooltip 放在 reference 里。
        el-popover 会把 reference 插槽交给内部的 ElOnlyChild，由它给「第一个合法子节点」
        挂 forwardRef 指令；而 el-tooltip 的根节点是 fragment，于是 Vue 报
        "Runtime directive used on component with non-element root node"（实测一次访问产生 19 条），
        指令不生效。包一层 span 后指令落在元素节点上，告警消失。
      -->
      <span class="wb-col-setting__trigger">
        <el-tooltip :content="t('common.columnSetting')" placement="top">
          <el-button circle plain size="small"><el-icon><Setting /></el-icon></el-button>
        </el-tooltip>
      </span>
    </template>

    <div class="wb-col-setting">
      <div class="wb-col-setting__head">
        <span>{{ t('common.columnSetting') }}</span>
        <el-button link type="primary" size="small" @click="resetAll">{{ t('common.reset') }}</el-button>
      </div>

      <el-scrollbar max-height="320px">
        <div v-for="(item, index) in columns" :key="item.prop" class="wb-col-setting__row">
          <el-checkbox :model-value="!item.hidden" @change="onToggle(item)">
            {{ item.label }}
          </el-checkbox>
          <div class="wb-col-setting__ops">
            <el-icon :class="{ 'is-disabled': index === 0 }" @click="move(index, -1)"><Top /></el-icon>
            <el-icon :class="{ 'is-disabled': index === columns.length - 1 }" @click="move(index, 1)">
              <Bottom />
            </el-icon>
            <el-select
              :model-value="item.fixed || ''"
              size="small"
              style="width: 84px"
              @change="(v) => onFixed(item, v as '' | 'left' | 'right')"
            >
              <el-option label="不固定" value="" />
              <el-option label="左固定" value="left" />
              <el-option label="右固定" value="right" />
            </el-select>
          </div>
        </div>
      </el-scrollbar>
    </div>
  </el-popover>
</template>

<style scoped lang="scss">
.wb-col-setting {
  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 8px;
    margin-bottom: 6px;
    border-bottom: 1px solid var(--wb-border);
    font-size: 13px;
    font-weight: 500;
  }

  &__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    padding: 3px 0;
  }

  &__ops {
    display: flex;
    align-items: center;
    gap: 4px;

    .el-icon {
      cursor: pointer;
      padding: 2px;
      border-radius: 3px;

      &:hover {
        background: var(--el-fill-color-light);
      }

      &.is-disabled {
        opacity: 0.3;
        pointer-events: none;
      }
    }
  }
}
</style>
