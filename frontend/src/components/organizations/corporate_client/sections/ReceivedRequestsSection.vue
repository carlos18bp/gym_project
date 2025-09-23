<template>
  <div>
    <!-- Header -->
    <div class="mb-6">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-lg font-medium text-gray-900">Solicitudes Recibidas</h2>
          <p class="mt-1 text-sm text-gray-600">
            Gestiona todas las solicitudes enviadas por tus clientes
          </p>
        </div>
        <button
          @click="refreshRequests"
          :disabled="isLoading"
          class="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          <ArrowPathIcon :class="[isLoading ? 'animate-spin' : '', 'h-4 w-4 mr-2']" />
          Actualizar
        </button>
      </div>
    </div>

    <!-- Filters -->
    <div class="mb-6 bg-gray-50 rounded-lg p-4">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <!-- Status Filter -->
        <div>
          <label for="status-filter" class="block text-sm font-medium text-gray-700 mb-1">
            Estado
          </label>
          <select
            id="status-filter"
            v-model="statusFilter"
            @change="applyFilters"
            class="block w-full rounded-md border-gray-300 text-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="">Todos los estados</option>
            <option value="PENDING">Pendiente</option>
            <option value="IN_REVIEW">En Revisión</option>
            <option value="RESPONDED">Respondida</option>
            <option value="RESOLVED">Resuelta</option>
            <option value="CLOSED">Cerrada</option>
          </select>
        </div>

        <!-- Priority Filter -->
        <div>
          <label for="priority-filter" class="block text-sm font-medium text-gray-700 mb-1">
            Prioridad
          </label>
          <select
            id="priority-filter"
            v-model="priorityFilter"
            @change="applyFilters"
            class="block w-full rounded-md border-gray-300 text-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="">Todas las prioridades</option>
            <option value="LOW">Baja</option>
            <option value="MEDIUM">Media</option>
            <option value="HIGH">Alta</option>
            <option value="URGENT">Urgente</option>
          </select>
        </div>

        <!-- Organization Filter -->
        <div>
          <label for="organization-filter" class="block text-sm font-medium text-gray-700 mb-1">
            Organización
          </label>
          <select
            id="organization-filter"
            v-model="organizationFilter"
            @change="applyFilters"
            class="block w-full rounded-md border-gray-300 text-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="">Todas las organizaciones</option>
            <option 
              v-for="org in organizations" 
              :key="org.id" 
              :value="org.id"
            >
              {{ org.title }}
            </option>
          </select>
        </div>

        <!-- Search -->
        <div>
          <label for="search" class="block text-sm font-medium text-gray-700 mb-1">
            Buscar
          </label>
          <input
            id="search"
            v-model="searchQuery"
            @input="applyFilters"
            type="text"
            placeholder="Buscar por título, cliente..."
            class="block w-full rounded-md border-gray-300 text-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
      </div>

      <!-- Quick Stats -->
      <div class="mt-4 flex flex-wrap gap-4 text-sm text-gray-600">
        <span>Total: <strong>{{ filteredRequests.length }}</strong></span>
        <span>Pendientes: <strong>{{ getPendingCount }}</strong></span>
        <span>En Revisión: <strong>{{ getInReviewCount }}</strong></span>
        <span>Urgentes: <strong>{{ getUrgentCount }}</strong></span>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="isLoading" class="flex justify-center items-center py-8">
      <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      <span class="ml-2 text-gray-600">Cargando solicitudes...</span>
    </div>

    <!-- Requests list -->
    <div v-else-if="filteredRequests.length > 0" class="space-y-4">
      <CorporateRequestCard
        v-for="request in paginatedRequests"
        :key="request.id"
        :request="request"
        @view-detail="handleViewDetail"
        @status-updated="handleStatusUpdated"
      />

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 mt-6">
        <div class="flex flex-1 justify-between sm:hidden">
          <button
            @click="currentPage > 1 && (currentPage--)"
            :disabled="currentPage <= 1"
            class="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Anterior
          </button>
          <button
            @click="currentPage < totalPages && (currentPage++)"
            :disabled="currentPage >= totalPages"
            class="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Siguiente
          </button>
        </div>
        <div class="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
          <div>
            <p class="text-sm text-gray-700">
              Mostrando
              <span class="font-medium">{{ startItem }}</span>
              a
              <span class="font-medium">{{ endItem }}</span>
              de
              <span class="font-medium">{{ filteredRequests.length }}</span>
              resultados
            </p>
          </div>
          <div>
            <nav class="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
              <button
                @click="currentPage > 1 && (currentPage--)"
                :disabled="currentPage <= 1"
                class="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
              >
                <ChevronLeftIcon class="h-5 w-5" />
              </button>
              
              <button
                v-for="page in visiblePages"
                :key="page"
                @click="currentPage = page"
                :class="[
                  page === currentPage
                    ? 'relative z-10 inline-flex items-center bg-blue-600 px-4 py-2 text-sm font-semibold text-white focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600'
                    : 'relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0'
                ]"
              >
                {{ page }}
              </button>
              
              <button
                @click="currentPage < totalPages && (currentPage++)"
                :disabled="currentPage >= totalPages"
                class="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
              >
                <ChevronRightIcon class="h-5 w-5" />
              </button>
            </nav>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else class="text-center py-12">
      <ClipboardDocumentListIcon class="h-16 w-16 mx-auto mb-4 text-gray-300" />
      <h3 class="text-lg font-medium text-gray-900 mb-2">
        {{ getEmptyStateTitle }}
      </h3>
      <p class="text-gray-600 mb-6">
        {{ getEmptyStateMessage }}
      </p>
      
      <!-- Clear filters if no results but has requests -->
      <div v-if="requests.length > 0">
        <button
          @click="clearFilters"
          class="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <XMarkIcon class="h-4 w-4 mr-2" />
          Limpiar Filtros
        </button>
      </div>
      
      <!-- Info box when no requests at all -->
      <div v-else class="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto">
        <div class="flex">
          <InformationCircleIcon class="h-5 w-5 text-blue-400 mt-0.5" />
          <div class="ml-3 text-left">
            <h5 class="text-sm font-medium text-blue-800">¿Por qué no hay solicitudes?</h5>
            <div class="mt-1 text-sm text-blue-700 space-y-1">
              <p>• Asegúrate de tener organizaciones creadas</p>
              <p>• Los miembros deben enviar solicitudes a través de tus organizaciones</p>
              <p>• Las solicitudes aparecerán automáticamente aquí</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { 
  ClipboardDocumentListIcon, 
  ArrowPathIcon, 
  InformationCircleIcon, 
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from '@heroicons/vue/24/outline';
import CorporateRequestCard from '../cards/CorporateRequestCard.vue';

// Props
const props = defineProps({
  requests: {
    type: Array,
    default: () => []
  },
  organizations: {
    type: Array,
    default: () => []
  },
  isLoading: {
    type: Boolean,
    default: false
  }
});

// Emits
const emit = defineEmits(['view-detail', 'status-updated', 'refresh']);

// Reactive state
const statusFilter = ref('');
const priorityFilter = ref('');
const organizationFilter = ref('');
const searchQuery = ref('');
const currentPage = ref(1);
const itemsPerPage = ref(10);

// Computed properties
const filteredRequests = computed(() => {
  let filtered = [...props.requests];
  
  // Apply status filter
  if (statusFilter.value) {
    filtered = filtered.filter(request => request.status === statusFilter.value);
  }
  
  // Apply priority filter
  if (priorityFilter.value) {
    filtered = filtered.filter(request => request.priority === priorityFilter.value);
  }
  
  // Apply organization filter
  if (organizationFilter.value) {
    filtered = filtered.filter(request => 
      request.organization_info?.id === parseInt(organizationFilter.value)
    );
  }
  
  // Apply search filter
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase().trim();
    filtered = filtered.filter(request => 
      request.title.toLowerCase().includes(query) ||
      request.request_number.toLowerCase().includes(query) ||
      request.client_name?.toLowerCase().includes(query) ||
      request.description?.toLowerCase().includes(query)
    );
  }
  
  // Sort by creation date (newest first)
  return filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
});

const totalPages = computed(() => {
  return Math.ceil(filteredRequests.value.length / itemsPerPage.value);
});

const startItem = computed(() => {
  return (currentPage.value - 1) * itemsPerPage.value + 1;
});

const endItem = computed(() => {
  return Math.min(currentPage.value * itemsPerPage.value, filteredRequests.value.length);
});

const paginatedRequests = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value;
  const end = start + itemsPerPage.value;
  return filteredRequests.value.slice(start, end);
});

const visiblePages = computed(() => {
  const pages = [];
  const maxVisible = 5;
  let start = Math.max(1, currentPage.value - Math.floor(maxVisible / 2));
  let end = Math.min(totalPages.value, start + maxVisible - 1);
  
  if (end - start + 1 < maxVisible) {
    start = Math.max(1, end - maxVisible + 1);
  }
  
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }
  
  return pages;
});

const getPendingCount = computed(() => {
  return filteredRequests.value.filter(r => r.status === 'PENDING').length;
});

const getInReviewCount = computed(() => {
  return filteredRequests.value.filter(r => r.status === 'IN_REVIEW').length;
});

const getUrgentCount = computed(() => {
  return filteredRequests.value.filter(r => r.priority === 'URGENT').length;
});

const getEmptyStateTitle = computed(() => {
  if (props.requests.length === 0) {
    return 'No has recibido solicitudes';
  }
  return 'No se encontraron solicitudes';
});

const getEmptyStateMessage = computed(() => {
  if (props.requests.length === 0) {
    return 'Cuando tus clientes envíen solicitudes a través de tus organizaciones, aparecerán aquí para que las gestiones.';
  }
  return 'No hay solicitudes que coincidan con los filtros seleccionados. Intenta ajustar los criterios de búsqueda.';
});

// Methods
const handleViewDetail = (requestId) => {
  emit('view-detail', requestId);
};

const handleStatusUpdated = (requestData) => {
  emit('status-updated', requestData);
};

const refreshRequests = () => {
  emit('refresh');
};

const applyFilters = () => {
  currentPage.value = 1; // Reset to first page when filtering
};

const clearFilters = () => {
  statusFilter.value = '';
  priorityFilter.value = '';
  organizationFilter.value = '';
  searchQuery.value = '';
  currentPage.value = 1;
};

// Watchers
watch(filteredRequests, () => {
  // Reset to first page if current page is beyond available pages
  if (currentPage.value > totalPages.value && totalPages.value > 0) {
    currentPage.value = 1;
  }
});
</script>

