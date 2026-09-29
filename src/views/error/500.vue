<script setup lang="ts">
import ErrorPage from './ErrorPage.vue'
defineOptions({ name: 'ServiceError' })
</script>

<template>
  <ErrorPage code="500" />
</template>
