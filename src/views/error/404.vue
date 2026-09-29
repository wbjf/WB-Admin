<script setup lang="ts">
import ErrorPage from './ErrorPage.vue'
defineOptions({ name: 'NotFound' })
</script>

<template>
  <ErrorPage code="404" />
</template>
