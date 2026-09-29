<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { resolveTitle } from '@/utils/page'

defineOptions({ name: 'Breadcrumb' })

const route = useRoute()
const router = useRouter()

interface Crumb {
  title: string
  path?: string
}

const crumbs = computed<Crumb[]>(() => {
  const list: Crumb[] = [
    { title: '首页', path: '/index' }
  ]
  route.matched
    .filter((r) => r.meta?.title && r.meta.hidden !== true)
    .forEach((r) => {
      if (r.path === '/index' || r.redirect === '/index') return
      list.push({ title: resolveTitle(r.meta.title as string), path: r.path })
    })
  return list
})

function go(item: Crumb, index: number) {
  if (!item.path || index === crumbs.value.length - 1) return
  router.push(item.path)
}
</script>

<template>
  <el-breadcrumb separator="/" class="wb-breadcrumb">
    <transition-group name="breadcrumb">
      <el-breadcrumb-item v-for="(item, index) in crumbs" :key="item.path || index">
        <span class="wb-breadcrumb__item" @click="go(item, index)">{{ item.title }}</span>
      </el-breadcrumb-item>
    </transition-group>
  </el-breadcrumb>
</template>

<style scoped lang="scss">
.wb-breadcrumb {
  display: inline-flex;
  align-items: center;

  &__item {
    cursor: pointer;
    font-weight: 400;
    font-size: 13px;
    color: var(--el-text-color-regular);
  }
}
</style>
