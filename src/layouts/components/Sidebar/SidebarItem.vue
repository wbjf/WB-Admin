<script setup lang="ts">
import { computed } from 'vue'
import type { MenuInfo } from '@/types'
import { isExternal } from '@/utils/validate'
import { isMenuVisible } from '@/router/helper'

defineOptions({ name: 'SidebarItem' })

const props = withDefaults(defineProps<{ item: MenuInfo; basePath?: string }>(), {
  basePath: ''
})

function join(base: string, path: string): string {
  if (!path) return base
  if (path.startsWith('/') || isExternal(path)) return path
  return `${base.replace(/\/$/, '')}/${path}`
}

const resolvedPath = computed(() => join(props.basePath, props.item.path ?? ''))
// 注意：可见性判断统一走 isMenuVisible，别在这里重写（visible='0' 是"显示"）
const children = computed(() => (props.item.children ?? []).filter(isMenuVisible))
const hasChildren = computed(() => children.value.length > 0)
const isLink = computed(() => props.item.type === 'L' || props.item.isFrame === '1')

function openLink() {
  window.open(props.item.path, '_blank')
}
</script>

<template>
  <el-menu-item v-if="isLink && !hasChildren" :index="`ext-${item.id}`" @click="openLink">
    <el-icon><Link /></el-icon>
    <template #title>{{ item.title }}</template>
  </el-menu-item>

  <el-menu-item v-else-if="!hasChildren" :index="resolvedPath">
    <el-icon v-if="item.icon">
      <component :is="item.icon" />
    </el-icon>
    <template #title>{{ item.title }}</template>
  </el-menu-item>

  <el-sub-menu v-else :index="resolvedPath || item.id" teleported>
    <template #title>
      <el-icon v-if="item.icon">
        <component :is="item.icon" />
      </el-icon>
      <span>{{ item.title }}</span>
    </template>
    <SidebarItem
      v-for="child in children"
      :key="child.id"
      :item="child"
      :base-path="resolvedPath"
    />
  </el-sub-menu>
</template>
