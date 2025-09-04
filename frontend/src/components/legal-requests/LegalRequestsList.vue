<template>
  <div class="legal-requests-list">
    <!-- Header with filters -->
    <div class="mb-6 bg-white rounded-lg shadow p-6">
      <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">
            {{ userRole === 'lawyer' ? 'Solicitudes' : 'Mis Solicitudes' }}
          </h1>
          <p class="text-gray-600 mt-1">
            {{ userRole === 'lawyer' ? 'Gestiona todas las solicitudes legales' : 'Seguimiento de tus solicitudes' }}
          </p>
        </div>
        
        <!-- Filters -->
        <div class="flex flex-col sm:flex-row gap-3">
          <!-- Status filter -->
          <select
            v-model="statusFilter"
            class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 w-48"
            @change="fetchRequests"
          >
            <option value="">Todos los estados</option>
            <option value="PENDING">Pendiente</option>
            <option value="IN_REVIEW">En Revisión</option>
            <option value="RESPONDED">Respondida</option>
            <option value="CLOSED">Cerrada</option>
          </select>
          
          <!-- Date filters -->
          <div class="flex gap-2">
            <input
              v-model="dateFrom"
              type="date"
              class="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Fecha desde"
              @change="fetchRequests"
            />
            <input
              v-model="dateTo"
              type="date"
              class="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Fecha hasta"
              @change="fetchRequests"
            />
          </div>
          
          <!-- Clear filters button -->
          <button
            v-if="statusFilter || dateFrom || dateTo"
            @click="clearFilters"
            class="px-3 py-2 text-gray-600 hover:text-gray-800 text-sm"
            title="Limpiar filtros"
          >
            ✕ Limpiar
          </button>
        </div>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
    </div>

    <!-- Empty state -->
    <div v-else-if="requests.length === 0" class="text-center py-12 bg-white rounded-lg shadow">
      <DocumentTextIcon class="mx-auto h-16 w-16 text-gray-400" />
      <h3 class="mt-4 text-lg font-medium text-gray-900">
        {{ props.externalSearchQuery ? 'No se encontraron solicitudes' : 'No hay solicitudes' }}
      </h3>
      <p class="mt-2 text-gray-600">
        {{ props.externalSearchQuery 
          ? 'Intenta con otros términos de búsqueda' 
          : userRole === 'lawyer' 
            ? 'No hay solicitudes registradas en el sistema' 
            : 'No has creado ninguna solicitud aún'
        }}
      </p>
    </div>

    <!-- Requests grid -->
    <div v-else class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      <LegalRequestCard
        v-for="request in requests"
        :key="request.id"
        :request="request"
        :user-role="userRole"
        @view-detail="$emit('view-detail', $event)"
        @status-updated="handleStatusUpdate"
        @deleted="handleRequestDeleted"
      />
    </div>

    <!-- Load more button -->
    <div v-if="hasMore" class="text-center mt-8">
      <button
        @click="loadMore"
        :disabled="loadingMore"
        class="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {{ loadingMore ? 'Cargando...' : 'Cargar más' }}
      </button>
    </div>

    <!-- Results summary -->
    <div v-if="requests.length > 0" class="mt-6 text-center text-gray-600">
      Mostrando {{ requests.length }} de {{ totalCount }} solicitudes
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { MagnifyingGlassIcon, DocumentTextIcon } from '@heroicons/vue/24/outline'
import LegalRequestCard from './LegalRequestCard.vue'
import { useLegalRequestsStore } from '@/stores/legal/legal_requests_management.js'
import { useAuthStore } from '@/stores/auth/auth.js'

// Props
const props = defineProps({
  userRole: {
    type: String,
    default: 'client'
  },
  externalSearchQuery: {
    type: String,
    default: ''
  }
})

// Emits
const emit = defineEmits(['view-detail'])

// Stores
const legalRequestsStore = useLegalRequestsStore()
const authStore = useAuthStore()

// Reactive data
const requests = ref([])
const loading = ref(false)
const loadingMore = ref(false)
const statusFilter = ref('')
const dateFrom = ref('')
const dateTo = ref('')
const totalCount = ref(0)
const hasMore = ref(false)
const currentPage = ref(1)

// Computed
const userRole = computed(() => props.userRole || authStore.user?.role || 'client')

// Methods
const fetchRequests = async (page = 1, append = false) => {
  if (page === 1) {
    loading.value = true
  } else {
    loadingMore.value = true
  }

  try {
    const params = {
      page,
      search: props.externalSearchQuery,
      status: statusFilter.value,
      date_from: dateFrom.value,
      date_to: dateTo.value
    }

    const response = await legalRequestsStore.fetchRequests(params)
    
    if (append) {
      requests.value = [...requests.value, ...response.requests]
    } else {
      requests.value = response.requests
    }
    
    totalCount.value = response.count
    hasMore.value = response.requests.length === 20 // Assuming 20 per page
    currentPage.value = page


  } catch (error) {
    console.error('❌ Error fetching requests:', error)
    // Handle error with notification
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

const loadMore = () => {
  fetchRequests(currentPage.value + 1, true)
}

const clearFilters = () => {
  statusFilter.value = ''
  dateFrom.value = ''
  dateTo.value = ''
  fetchRequests()
}

// Watch for external search changes
watch(() => props.externalSearchQuery, () => {
  fetchRequests()
})

// Event handlers
const handleStatusUpdate = (updatedRequest) => {
  const index = requests.value.findIndex(r => r.id === updatedRequest.id)
  if (index !== -1) {
    requests.value[index] = updatedRequest
  }
}

const handleRequestDeleted = (deletedId) => {
  requests.value = requests.value.filter(r => r.id !== deletedId)
  totalCount.value -= 1
}

// Lifecycle
onMounted(() => {
  fetchRequests()
})
</script>

<style scoped>
.legal-requests-list {
  @apply max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8;
}
</style>
