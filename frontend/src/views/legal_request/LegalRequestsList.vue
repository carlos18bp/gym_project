<template>
  <div class="legal-requests-page">
    <!-- Search bar integration -->
    <SearchBarAndFilterBy @update:searchQuery="searchQuery = $event">
      <!-- Menu button slot - pass through the slot from SlideBar -->
      <slot></slot>

      <!-- Auxiliary button slot for navigation -->
      <template #auxiliary_button>
        <div class="flex items-center space-x-4" v-if="userRole === 'client' || userRole === 'basic' || userRole === 'corporate_client'">
          <!-- Navigation tabs (for clients, basic users, and corporate clients) -->
          <nav class="flex space-x-4" aria-label="Tabs">
            
            <router-link
              :to="{ name: 'legal_request_create' }"
              class="inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-md hover:shadow-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
            >
              <PlusIcon class="w-5 h-5 mr-2" />
              Nueva Solicitud
            </router-link>
          </nav>
        </div>
      </template>
    </SearchBarAndFilterBy>

    <!-- Legal Requests List Component -->
    <LegalRequestsList 
      :user-role="userRole"
      :external-search-query="searchQuery"
      @view-detail="handleViewDetail"
    />
  </div>
</template>

<script setup>
import { computed, ref, onMounted, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { DocumentTextIcon, PlusIcon } from '@heroicons/vue/24/outline'
import SearchBarAndFilterBy from '@/components/layouts/SearchBarAndFilterBy.vue'
import LegalRequestsList from '@/components/legal-requests/LegalRequestsList.vue'
import { useAuthStore } from '@/stores/auth/auth.js'
import { useUserStore } from '@/stores/auth/user.js'

// No emits needed - using slot passthrough

// Router
const router = useRouter()

// Stores
const authStore = useAuthStore()
const userStore = useUserStore()

// Reactive data
const searchQuery = ref('')
const currentUser = reactive({})

// Computed
const userRole = computed(() => currentUser.role || 'client')

// Methods
const handleViewDetail = (requestId) => {
  router.push({ 
    name: 'legal_request_detail', 
    params: { id: requestId } 
  })
}

// Lifecycle
onMounted(async () => {
  await userStore.init()
  Object.assign(currentUser, userStore.userById(authStore.userAuth.id))
})
</script>
