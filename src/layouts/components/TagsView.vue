<script setup lang="ts">
import { computed, ref, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { TagView } from '@/stores/modules/tagsView'
import { useTagsViewStore } from '@/stores/modules/tagsView'
import { useSettingsStore } from '@/stores/modules/settings'
import { resolveTitle } from '@/utils/page'
import { useI18n } from 'vue-i18n'

defineOptions({ name: 'TagsView' })

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const tagsStore = useTagsViewStore()
const settings = useSettingsStore()

const contextTarget = ref<TagView | null>(null)
const menuVisible = ref(false)
const menuPos = ref({ x: 0, y: 0 })

const visited = computed(() => tagsStore.visitedViews)

const activePath = computed(() => route.fullPath)

function isActive(tag: TagView): boolean {
  return tag.fullPath === activePath.value
}

function isAffix(tag: TagView | null | undefined): boolean {
  return Boolean(tag?.affix)
}

function title(tag: TagView): string {
  return resolveTitle(tag.title) || tag.path
}

function close(tag: TagView) {
  if (tag.affix) return
  tagsStore.delView(tag)
  if (isActive(tag)) {
    const last = visited.value[visited.value.length - 1]
    router.push(last ? last.fullPath : '/index')
  }
}

function openMenu(tag: TagView, e: MouseEvent) {
  contextTarget.value = tag
  menuPos.value = { x: e.clientX, y: e.clientY }
  menuVisible.value = true
}

function runCommand(command: string) {
  const tag = contextTarget.value
  if (!tag) return
  const map: Record<string, () => void> = {
    refresh: () => router.replace({ path: '/redirect' + tag.fullPath }),
    close: () => close(tag),
    left: () => tagsStore.delLeft(tag),
    right: () => tagsStore.delRight(tag),
    others: () => {
      tagsStore.delOthers(tag)
      if (!isActive(tag)) router.push(tag.fullPath)
    },
    all: () => {
      tagsStore.delAll()
      router.push('/index')
    }
  }
  map[command]?.()
  menuVisible.value = false
  nextTick(() => {
    contextTarget.value = null
  })
}

/** 拖拽排序 */
let dragIndex = -1
function onDragStart(index: number) {
  dragIndex = index
}
function onDragOver(index: number) {
  if (dragIndex < 0 || dragIndex === index) return
  tagsStore.moveTags(dragIndex, index)
  dragIndex = index
}
function onDragEnd() {
  dragIndex = -1
}
</script>

<template>
  <div v-if="settings.tagsView" class="wb-tags">
    <el-scrollbar class="wb-tags__scroll">
      <div class="wb-tags__list">
        <div
          v-for="(tag, index) in visited"
          :key="tag.fullPath"
          class="wb-tags__item"
          :class="{ 'is-active': isActive(tag) }"
          draggable="true"
          @click="router.push(tag.fullPath)"
          @contextmenu.prevent="openMenu(tag, $event)"
          @dragstart="onDragStart(index)"
          @dragover.prevent="onDragOver(index)"
          @dragend="onDragEnd"
        >
          <span>{{ title(tag) }}</span>
          <el-icon v-if="!isAffix(tag)" class="wb-tags__close" @click.stop="close(tag)">
            <Close />
          </el-icon>
        </div>
      </div>
    </el-scrollbar>

    <ul
      v-show="menuVisible"
      class="wb-tags__menu"
      :style="{ left: menuPos.x + 'px', top: menuPos.y + 'px' }"
      @mouseleave="menuVisible = false"
    >
      <li @click="runCommand('refresh')">{{ t('common.refresh') }}</li>
      <li :class="{ 'is-disabled': isAffix(contextTarget) }" @click="runCommand('close')">{{ t('common.close') }}</li>
      <li @click="runCommand('left')">{{ t('common.closeLeft') }}</li>
      <li @click="runCommand('right')">{{ t('common.closeRight') }}</li>
      <li @click="runCommand('others')">{{ t('common.closeOthers') }}</li>
      <li @click="runCommand('all')">{{ t('common.closeAll') }}</li>
    </ul>
  </div>
</template>

<style scoped lang="scss">
.wb-tags {
  height: var(--wb-tags-height);
  flex: none;
  background: var(--wb-bg-card);
  border-bottom: 1px solid var(--wb-border);
  position: relative;

  /*
   * el-scrollbar 内部的 __view 高度是 auto，只给 __list 写 height:100% 落不到 38px 容器上，
   * 结果 align-items:center 形同虚设、tag 贴着顶部。把 view 撑满才能真居中。
   */
  &__scroll {
    height: 100%;

    :deep(.el-scrollbar__view) {
      height: 100%;
    }
  }

  &__list {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 100%;
    padding: 0 12px;
  }

  &__item {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 26px;
    padding: 0 8px;
    font-size: 12px;
    color: var(--el-text-color-regular);
    background: var(--wb-bg-card);
    border: 1px solid var(--wb-border);
    border-radius: 4px;
    cursor: pointer;
    white-space: nowrap;
    user-select: none;
    transition:
      color 0.2s,
      border-color 0.2s,
      background-color 0.2s;

    &:hover:not(.is-active) {
      color: var(--el-color-primary);
      border-color: var(--el-color-primary-light-5);
      background: var(--el-fill-color-light);
    }

    &.is-active {
      background: var(--el-color-primary);
      color: #fff;
      border-color: var(--el-color-primary);

      .wb-tags__close:hover {
        background: rgba(255, 255, 255, 0.26);
      }
    }
  }

  &__close {
    font-size: 12px;
    border-radius: 50%;
    transition: background-color 0.2s;

    &:hover {
      background: rgba(0, 0, 0, 0.08);
    }
  }

  &__menu {
    position: fixed;
    z-index: 3000;
    margin: 0;
    padding: 4px 0;
    list-style: none;
    background: var(--wb-bg-card);
    border: 1px solid var(--wb-border);
    border-radius: 6px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
    font-size: 13px;

    li {
      padding: 6px 18px;
      cursor: pointer;
      white-space: nowrap;

      &:hover {
        background: var(--el-fill-color-light);
      }

      &.is-disabled {
        color: var(--el-text-color-disabled);
        cursor: not-allowed;

        &:hover {
          background: transparent;
        }
      }
    }
  }
}
</style>
