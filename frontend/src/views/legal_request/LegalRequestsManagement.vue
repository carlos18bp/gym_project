<template>
  <div class="legal-requests-management">
    <!-- Redirect to list automatically -->
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'

// Router
const router = useRouter()

// Redirect to list on mount
onMounted(() => {
  router.replace({ name: 'legal_requests_list' })
})
</script>
