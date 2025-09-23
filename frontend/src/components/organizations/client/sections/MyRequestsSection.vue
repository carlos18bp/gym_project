<template>
  <div>
    <!-- Header -->
    <div class="mb-6">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-lg font-medium text-gray-900">Mis Solicitudes Corporativas</h2>
          <p class="mt-1 text-sm text-gray-600">
            Seguimiento de todas tus solicitudes enviadas
          </p>
        </div>
        <button
          @click="emit('create-request')"
          class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <PlusIcon class="h-4 w-4 mr-2" />
          Nueva Solicitud
        </button>
      </div>
    </div>

    <!-- Filters -->
    <div class="mb-6 bg-gray-50 rounded-lg p-4">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <!-- Status Filter -->
        <div>
          <label for="status-filter" class="block text-sm font-medium text-gray-700 mb-1">
            Estado
          </label>
          <select
            id="status-filter"
            v-model="statusFilter"
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
            class="block w-full rounded-md border-gray-300 text-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="">Todas las prioridades</option>
            <option value="LOW">Baja</option>
            <option value="MEDIUM">Media</option>
            <option value="HIGH">Alta</option>
            <option value="URGENT">Urgente</option>
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
            type="text"
            placeholder="Buscar por título o número..."
            class="block w-full rounded-md border-gray-300 text-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="isLoading" class="flex justify-center items-center py-8">
      <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      <span class="ml-2 text-gray-600">Cargando solicitudes...</span>
    </div>

    <!-- Requests list -->
    <div v-else-if="filteredRequests.length > 0" class="space-y-4">
      <RequestCard
        v-for="request in filteredRequests"
        :key="request.id"
        :request="request"
        @view-detail="handleViewDetail"
      />
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
      
      <!-- Action based on state -->
      <div v-if="requests.length === 0" class="space-y-4">
        <button
          @click="emit('create-request')"
          class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <PlusIcon class="h-4 w-4 mr-2" />
          Crear Primera Solicitud
        </button>
        
        <!-- Info box -->
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto">
          <div class="flex">
            <InformationCircleIcon class="h-5 w-5 text-blue-400 mt-0.5" />
            <div class="ml-3 text-left">
              <h5 class="text-sm font-medium text-blue-800">¿Cómo crear una solicitud?</h5>
              <div class="mt-1 text-sm text-blue-700 space-y-1">
                <p>1. Asegúrate de ser miembro de al menos una organización</p>
                <p>2. Haz clic en "Nueva Solicitud"</p>
                <p>3. Selecciona la organización y tipo de solicitud</p>
                <p>4. Proporciona todos los detalles necesarios</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Clear filters if no results but has requests -->
      <div v-else>
        <button
          @click="clearFilters"
          class="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <XMarkIcon class="h-4 w-4 mr-2" />
          Limpiar Filtros
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { 
  ClipboardDocumentListIcon, 
  PlusIcon, 
  InformationCircleIcon, 
  XMarkIcon 
} from '@heroicons/vue/24/outline';
import RequestCard from '../cards/RequestCard.vue';

// Props
const props = defineProps({
  requests: {
    type: Array,
    default: () => []
  },
  isLoading: {
    type: Boolean,
    default: false
  }
});

// Emits
const emit = defineEmits(['request-detail', 'create-request']);

// Reactive state
const statusFilter = ref('');
const priorityFilter = ref('');
const searchQuery = ref('');

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
  
  // Apply search filter
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase().trim();
    filtered = filtered.filter(request => 
      request.title.toLowerCase().includes(query) ||
      request.request_number.toLowerCase().includes(query) ||
      request.description?.toLowerCase().includes(query)
    );
  }
  
  // Sort by creation date (newest first)
  return filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
});

const getEmptyStateTitle = computed(() => {
  if (props.requests.length === 0) {
    return 'No has enviado solicitudes';
  }
  return 'No se encontraron solicitudes';
});

const getEmptyStateMessage = computed(() => {
  if (props.requests.length === 0) {
    return 'Cuando envíes solicitudes corporativas a tus organizaciones, aparecerán aquí para que puedas dar seguimiento.';
  }
  return 'No hay solicitudes que coincidan con los filtros seleccionados. Intenta ajustar los criterios de búsqueda.';
});

// Methods
const handleViewDetail = (requestId) => {
  emit('request-detail', requestId);
};

const clearFilters = () => {
  statusFilter.value = '';
  priorityFilter.value = '';
  searchQuery.value = '';
};

// Watchers for real-time filtering
watch([statusFilter, priorityFilter, searchQuery], () => {
  // Filters are reactive, no additional action needed
});
</script>

