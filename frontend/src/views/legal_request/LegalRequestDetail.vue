<template>
  <!-- Header with hamburger menu and back button -->
  <div class="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
    <!-- Hamburger menu button (mobile) -->
    <slot></slot>
    
    <!-- Back button for mobile -->
    <button
      @click="goBack"
      class="lg:hidden inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
    >
      <ArrowLeftIcon class="h-4 w-4 mr-2" />
      Regresar
    </button>
    
    <!-- Title -->
    <h1 class="text-lg font-semibold leading-6 text-gray-900">Detalle de Solicitud</h1>
  </div>
  
  <LegalRequestDetail 
    :user-role="userRole"
  />
</template>

<script setup>
import { useRouter } from 'vue-router'
import { ArrowLeftIcon } from '@heroicons/vue/24/outline'
import LegalRequestDetail from '@/components/legal-requests/LegalRequestDetail.vue'

// Router
const router = useRouter()

// Props
const props = defineProps({
  userRole: {
    type: String,
    default: 'client'
  }
})

// Go back to previous page
const goBack = () => {
  router.go(-1)
}
</script>
