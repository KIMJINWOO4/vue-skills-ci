<script setup lang="ts">
import { templateRef, useNow } from '@vueuse/core'

const products = await $fetch('/api/products')
const { total } = useCartStore()
const now = useNow({ interval: 1000 })
const list = templateRef('list')
</script>

<template>
  <ul ref="list">
    <li v-for="p in products" :key="p.id">{{ p.name }}</li>
  </ul>
</template>
