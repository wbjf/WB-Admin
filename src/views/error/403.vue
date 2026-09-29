<script setup lang="ts">
import ErrorPage from './ErrorPage.vue'
defineOptions({ name: 'Forbidden' })
</script>

<template>
  <ErrorPage code="403" />
</template>
