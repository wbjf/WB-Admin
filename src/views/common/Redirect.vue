<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

defineOptions({ name: 'Redirect' })

const route = useRoute()
const router = useRouter()

onMounted(() => {
  const target = String(route.params.path ?? '')
  router.replace({ path: target.startsWith('/') ? target : `/${target}`, query: route.query })
})
</script>

<template>
  <div style="padding: 40px; text-align: center; color: var(--el-text-color-secondary)">
    正在跳转…
  </div>
</template>
