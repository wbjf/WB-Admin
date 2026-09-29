<script setup lang="ts">
defineOptions({ name: 'LayoutFooter' })

const appTitle = import.meta.env.VITE_APP_TITLE || 'WB-Admin'
</script>

<template>
  <footer class="wb-footer">
    <span>© 2026 {{ appTitle }} · Vue3 + TypeScript + Element Plus</span>
  </footer>
</template>

<style scoped lang="scss">
.wb-footer {
  height: var(--wb-footer-height);
  line-height: var(--wb-footer-height);
  text-align: center;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  background: var(--wb-bg-card);
  border-top: 1px solid var(--wb-border);
  flex: none;
}
</style>
