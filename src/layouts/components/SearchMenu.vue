<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { usePermissionStore } from '@/stores/modules/permission'
import { flatMenus } from '@/router/helper'
import type { MenuInfo } from '@/types'

defineOptions({ name: 'SearchMenu' })

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits(['update:modelValue'])
const router = useRouter()
const permission = usePermissionStore()

const visible = computed({ get: () => props.modelValue, set: (v) => emit('update:modelValue', v) })

const keyword = ref('')
const activeIndex = ref(0)
const inputRef = ref()

const allMenus = computed<MenuInfo[]>(() =>
  flatMenus(permission.visibleMenus).filter((m) => m.type !== 'F')
)

const results = computed<MenuInfo[]>(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return allMenus.value.slice(0, 12)
  return allMenus.value.filter(
    (m) =>
      m.title.toLowerCase().includes(kw) ||
      String(m.path ?? '').toLowerCase().includes(kw) ||
      String(m.name ?? '').toLowerCase().includes(kw)
  )
})

watch(visible, async (v) => {
  if (v) {
    keyword.value = ''
    activeIndex.value = 0
    await nextTick()
    inputRef.value?.focus()
  }
})

function move(delta: number) {
  if (!results.value.length) return
  activeIndex.value = (activeIndex.value + delta + results.value.length) % results.value.length
}

function confirm(item?: MenuInfo) {
  const target = item ?? results.value[activeIndex.value]
  if (!target) return
  visible.value = false
  if (String(target.path).startsWith('http')) {
    window.open(String(target.path), '_blank')
    return
  }
  router.push(String(target.path))
}

function onInput() {
  activeIndex.value = 0
}
</script>

<template>
  <el-dialog v-model="visible" width="560px" top="12vh" append-to-body :show-close="false">
    <template #header>
      <input
        ref="inputRef"
        v-model="keyword"
        class="wb-search__input"
        placeholder="搜索菜单，支持 ↑ ↓ 选择，回车跳转"
        @input="onInput"
        @keydown.down.prevent="move(1)"
        @keydown.up.prevent="move(-1)"
        @keydown.enter.prevent="confirm()"
      />
    </template>

    <ul class="wb-search__list">
      <li
        v-for="(item, index) in results"
        :key="item.id"
        :class="{ 'is-active': index === activeIndex }"
        @click="confirm(item)"
        @mouseenter="activeIndex = index"
      >
        <el-icon><component :is="item.icon || 'Document'" /></el-icon>
        <span class="wb-search__title">{{ item.title }}</span>
        <span class="wb-search__path">{{ item.path }}</span>
      </li>
      <li v-if="!results.length" class="wb-search__empty">无匹配结果</li>
    </ul>
  </el-dialog>
</template>

<style scoped lang="scss">
.wb-search {
  &__input {
    width: 100%;
    border: none;
    outline: none;
    font-size: 15px;
    padding: 4px 0;
    background: transparent;
    color: var(--el-text-color-primary);
  }

  &__list {
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 360px;
    overflow: auto;

    li {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 9px 10px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;

      &.is-active {
        background: var(--el-color-primary-light-9);
        color: var(--el-color-primary);
      }
    }
  }

  &__title {
    flex: 1;
  }

  &__path {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  &__empty {
    justify-content: center;
    color: var(--el-text-color-secondary);
  }
}
</style>
