<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'

defineOptions({ name: 'InnerLink' })

const props = defineProps<{ url?: string }>()

const route = useRoute()
const loading = ref(true)

const target = computed(() => props.url || String(route.meta.link || ''))

function onLoad() {
  loading.value = false
}
</script>

<template>
  <div v-loading="loading" class="wb-inner-link">
    <iframe :src="target" frameborder="0" @load="onLoad" />
  </div>
</template>

<style scoped lang="scss">
.wb-inner-link {
  height: 100%;
  min-height: calc(100vh - 160px);

  iframe {
    width: 100%;
    height: 100%;
    border: none;
    display: block;
  }
}
</style>
