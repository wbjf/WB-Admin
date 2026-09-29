<script setup lang="ts">
import { computed, ref } from 'vue'
import * as ElementPlusIcons from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'

defineOptions({ name: 'IconSelect' })

const props = defineProps<{ modelValue?: string; disabled?: boolean }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>()

const { t } = useI18n()

const visible = ref(false)
const keyword = ref('')

const allIcons = Object.keys(ElementPlusIcons)

const icons = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  const list = kw ? allIcons.filter((i) => i.toLowerCase().includes(kw)) : allIcons
  return list.slice(0, 200)
})

function pick(name: string) {
  emit('update:modelValue', name)
  visible.value = false
}

function clear() {
  emit('update:modelValue', '')
}
</script>

<template>
  <el-popover v-model:visible="visible" placement="bottom-start" width="420" trigger="click" :disabled="disabled">
    <template #reference>
      <el-input
        :model-value="modelValue"
        :placeholder="t('component.selectIcon')"
        :disabled="disabled"
        clearable
        readonly
        @clear="clear"
      >
        <template #prefix>
          <el-icon v-if="modelValue"><component :is="modelValue" /></el-icon>
          <el-icon v-else><Search /></el-icon>
        </template>
      </el-input>
    </template>

    <div class="wb-icon-select">
      <el-input v-model="keyword" :placeholder="t('component.searchIcon')" size="small" clearable>
        <template #prefix><el-icon><Search /></el-icon></template>
      </el-input>

      <el-scrollbar max-height="260px" class="wb-icon-select__list">
        <div class="wb-icon-select__grid">
          <div
            v-for="name in icons"
            :key="name"
            class="wb-icon-select__item"
            :class="{ 'is-active': name === modelValue }"
            :title="name"
            @click="pick(name)"
          >
            <el-icon :size="18"><component :is="name" /></el-icon>
            <span>{{ name }}</span>
          </div>
        </div>
      </el-scrollbar>
    </div>
  </el-popover>
</template>

<style scoped lang="scss">
.wb-icon-select {
  &__list {
    margin-top: 10px;
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 6px;
  }

  &__item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    padding: 8px 2px;
    border-radius: 6px;
    cursor: pointer;
    border: 1px solid transparent;

    span {
      font-size: 10px;
      width: 100%;
      text-align: center;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }

    &:hover {
      background: var(--el-fill-color-light);
    }

    &.is-active {
      border-color: var(--el-color-primary);
      color: var(--el-color-primary);
    }
  }
}
</style>
