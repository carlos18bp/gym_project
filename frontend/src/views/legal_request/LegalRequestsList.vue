<template>
  <div class="legal-requests-page">
    <!-- Search bar integration -->
    <SearchBarAndFilterBy @update:searchQuery="searchQuery = $event">
      <!-- Menu button slot -->
      <button
        type="button"
        class="-m-2.5 p-2.5 text-gray-700 lg:hidden"
        @click="$emit('toggle-sidebar')"
      >
        <span class="sr-only">Abrir menú</span>
        <Bars3Icon class="h-6 w-6" aria-hidden="true" />
      </button>

      <!-- Auxiliary button slot for navigation -->
      <template #auxiliary_button>
        <div class="flex items-center space-x-4" v-if="userRole === 'client'">
          <!-- Navigation tabs (only for clients) -->
          <nav class="flex space-x-4" aria-label="Tabs">
            <router-link
              :to="{ name: 'legal_requests_list' }"
              class="text-gray-500 hover:text-gray-700 px-3 py-2 text-sm font-medium rounded-md"
              active-class="bg-indigo-100 text-indigo-700"
            >
              <DocumentTextIcon class="w-4 h-4 inline mr-1" />
              Mis Solicitudes
            </router-link>
            
            <router-link
              :to="{ name: 'legal_request_create' }"
              class="text-gray-500 hover:text-gray-700 px-3 py-2 text-sm font-medium rounded-md"
              active-class="bg-indigo-100 text-indigo-700"
            >
              <PlusIcon class="w-4 h-4 inline mr-1" />
              Nueva
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
import { DocumentTextIcon, PlusIcon, Bars3Icon } from '@heroicons/vue/24/outline'
import SearchBarAndFilterBy from '@/components/layouts/SearchBarAndFilterBy.vue'
import LegalRequestsList from '@/components/legal-requests/LegalRequestsList.vue'
import { useAuthStore } from '@/stores/auth/auth.js'
import { useUserStore } from '@/stores/auth/user.js'

// Emits
const emit = defineEmits(['toggle-sidebar'])

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
