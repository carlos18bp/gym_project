<template>
  <!-- Search bar integration - provides hamburger menu slot -->
  <SearchBarAndFilterBy>
    <slot></slot>
  </SearchBarAndFilterBy>
  
  <div class="legal-requests-management">
    <!-- Redirect to list automatically -->
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import SearchBarAndFilterBy from '@/components/layouts/SearchBarAndFilterBy.vue'

// Router
const router = useRouter()

// Redirect to list on mount
onMounted(() => {
  router.replace({ name: 'legal_requests_list' })
})
</script>
