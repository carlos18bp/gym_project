<template>
  <LegalRequestDetail 
    :user-role="userRole"
  />
</template>

<script setup>
import LegalRequestDetail from '@/components/legal-requests/LegalRequestDetail.vue'

// Props
const props = defineProps({
  userRole: {
    type: String,
    default: 'client'
  }
})
</script>
