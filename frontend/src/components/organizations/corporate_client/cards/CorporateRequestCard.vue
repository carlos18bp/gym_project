<template>
  <div class="bg-white shadow rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
    <!-- Header with request number and status -->
    <div class="mb-4">
      <div class="flex items-center flex-wrap gap-2 mb-2">
        <span class="text-sm font-medium text-gray-900">
          {{ request.request_number }}
        </span>
        <span 
          :class="getStatusColorClass(request.status)"
          class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
        >
          {{ getStatusDisplay(request.status) }}
        </span>
        <span 
          :class="getPriorityColorClass(request.priority)"
          class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
        >
          {{ getPriorityDisplay(request.priority) }}
        </span>
      </div>
      
      <h3 class="text-lg font-semibold text-gray-900 mb-1">
        {{ request.title }}
      </h3>
      <p class="text-sm text-gray-600 line-clamp-2 mb-3">
        {{ request.description }}
      </p>
      
      <!-- Action menu -->
      <div class="flex flex-wrap gap-2">
        <button
          @click="viewDetail"
          class="inline-flex items-center px-2.5 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <EyeIcon class="h-3 w-3 sm:mr-1" />
          <span class="hidden sm:inline">Ver Detalle</span>
          <span class="sm:hidden">Detalle</span>
        </button>
        
        <div class="relative">
          <button
            @click="showStatusMenu = !showStatusMenu"
            class="inline-flex items-center px-2.5 py-1.5 border border-blue-300 text-xs font-medium rounded text-blue-700 bg-blue-50 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 whitespace-nowrap"
          >
            <ArrowPathIcon class="h-3 w-3 sm:mr-1" />
            <span class="hidden sm:inline">Cambiar Estado</span>
            <span class="sm:hidden">Estado</span>
          </button>
          
          <!-- Status dropdown -->
          <div v-if="showStatusMenu" class="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-10">
            <div class="py-1">
              <button
                v-for="status in availableStatuses"
                :key="status.value"
                @click="updateStatus(status.value)"
                :disabled="isUpdating"
                class="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
              >
                <span :class="getStatusColorClass(status.value)" class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mr-2">
                  {{ status.label }}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Client and Organization info -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
      <!-- Client info -->
      <div class="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
        <img
          :src="clientImage"
          :alt="`Avatar de ${request.client_info?.full_name}`"
          class="h-8 w-8 rounded-full object-cover border border-gray-200"
        />
        <div>
          <p class="text-sm font-medium text-gray-900">
            {{ request.client_info?.full_name }}
          </p>
          <p class="text-xs text-gray-500">
            Cliente • {{ request.client_info?.email }}
          </p>
        </div>
      </div>

      <!-- Organization info -->
      <div class="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg">
        <img
          :src="organizationImage"
          :alt="`Logo de ${request.organization_info?.title}`"
          class="h-8 w-8 rounded-full object-cover border border-blue-200"
        />
        <div>
          <p class="text-sm font-medium text-blue-900">
            {{ request.organization_info?.title || 'Organización' }}
          </p>
          <p class="text-xs text-blue-600">
            Vía organización
          </p>
        </div>
      </div>
    </div>

    <!-- Request metadata -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-gray-500 mb-4">
      <div class="flex items-center">
        <TagIcon class="h-3 w-3 mr-1" />
        {{ request.request_type_name }}
      </div>
      <div class="flex items-center">
        <CalendarIcon class="h-3 w-3 mr-1" />
        {{ formatRelativeDate(request.created_at) }}
      </div>
      <div class="flex items-center">
        <ChatBubbleLeftIcon class="h-3 w-3 mr-1" />
        {{ request.response_count }} respuestas
      </div>
      <div class="flex items-center">
        <ClockIcon class="h-3 w-3 mr-1" />
        {{ request.days_since_created }} días
      </div>
    </div>

    <!-- Status-specific info -->
    <div v-if="request.status_updated_at && request.status_updated_at !== request.created_at" class="text-xs text-gray-500 mb-3">
      <span class="font-medium">Última actualización:</span> {{ formatRelativeDate(request.status_updated_at) }}
    </div>

    <!-- Progress indicator -->
    <div class="w-full bg-gray-200 rounded-full h-1.5 mb-2">
      <div 
        :class="getProgressColorClass(request.status)"
        :style="{ width: getProgressPercentage(request.status) + '%' }"
        class="h-1.5 rounded-full transition-all duration-300"
      ></div>
    </div>

    <!-- Status description -->
    <p class="text-xs text-gray-500">
      {{ getStatusDescription(request.status) }}
    </p>

    <!-- Click outside to close status menu -->
    <div v-if="showStatusMenu" @click="showStatusMenu = false" class="fixed inset-0 z-0"></div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import {
  EyeIcon,
  TagIcon,
  CalendarIcon,
  ChatBubbleLeftIcon,
  ClockIcon,
  ArrowPathIcon
} from '@heroicons/vue/24/outline';
import userAvatar from '@/assets/images/user_avatar.jpg';

// Props
const props = defineProps({
  request: {
    type: Object,
    required: true
  }
});

// Emits
const emit = defineEmits(['view-detail', 'status-updated']);

// Reactive state
const showStatusMenu = ref(false);
const isUpdating = ref(false);

// Computed properties
const clientImage = computed(() => {
  return props.request.client_info?.profile_image_url || userAvatar;
});

const organizationImage = computed(() => {
  return props.request.organization_info?.profile_image_url || userAvatar;
});

const availableStatuses = computed(() => [
  { value: 'PENDING', label: 'Pendiente' },
  { value: 'IN_REVIEW', label: 'En Revisión' },
  { value: 'RESPONDED', label: 'Respondida' },
  { value: 'RESOLVED', label: 'Resuelta' },
  { value: 'CLOSED', label: 'Cerrada' }
]);

// Methods
const viewDetail = () => {
  emit('view-detail', props.request.id);
};

const updateStatus = async (newStatus) => {
  if (newStatus === props.request.status) {
    showStatusMenu.value = false;
    return;
  }

  try {
    isUpdating.value = true;
    showStatusMenu.value = false;
    
    // Emit event to parent to handle the actual API call
    emit('status-updated', {
      requestId: props.request.id,
      newStatus: newStatus,
      request: props.request
    });
    
  } catch (error) {
    console.error('Error updating status:', error);
  } finally {
    isUpdating.value = false;
  }
};

const getStatusDisplay = (status) => {
  const statusMap = {
    'PENDING': 'Pendiente',
    'IN_REVIEW': 'En Revisión',
    'RESPONDED': 'Respondida',
    'RESOLVED': 'Resuelta',
    'CLOSED': 'Cerrada'
  };
  return statusMap[status] || status;
};

const getStatusColorClass = (status) => {
  const colorMap = {
    'PENDING': 'bg-yellow-100 text-yellow-800',
    'IN_REVIEW': 'bg-blue-100 text-blue-800',
    'RESPONDED': 'bg-purple-100 text-purple-800',
    'RESOLVED': 'bg-green-100 text-green-800',
    'CLOSED': 'bg-gray-100 text-gray-800'
  };
  return colorMap[status] || 'bg-gray-100 text-gray-800';
};

const getPriorityDisplay = (priority) => {
  const priorityMap = {
    'LOW': 'Baja',
    'MEDIUM': 'Media',
    'HIGH': 'Alta',
    'URGENT': 'Urgente'
  };
  return priorityMap[priority] || priority;
};

const getPriorityColorClass = (priority) => {
  const colorMap = {
    'LOW': 'bg-gray-100 text-gray-600',
    'MEDIUM': 'bg-blue-100 text-blue-600',
    'HIGH': 'bg-orange-100 text-orange-600',
    'URGENT': 'bg-red-100 text-red-600'
  };
  return colorMap[priority] || 'bg-gray-100 text-gray-600';
};

const getProgressPercentage = (status) => {
  const progressMap = {
    'PENDING': 20,
    'IN_REVIEW': 40,
    'RESPONDED': 60,
    'RESOLVED': 80,
    'CLOSED': 100
  };
  return progressMap[status] || 0;
};

const getProgressColorClass = (status) => {
  const colorMap = {
    'PENDING': 'bg-yellow-500',
    'IN_REVIEW': 'bg-blue-500',
    'RESPONDED': 'bg-purple-500',
    'RESOLVED': 'bg-green-500',
    'CLOSED': 'bg-gray-500'
  };
  return colorMap[status] || 'bg-gray-500';
};

const getStatusDescription = (status) => {
  const descriptionMap = {
    'PENDING': 'La solicitud está esperando revisión inicial',
    'IN_REVIEW': 'La solicitud está siendo analizada por el equipo',
    'RESPONDED': 'Se ha proporcionado una respuesta al cliente',
    'RESOLVED': 'La solicitud ha sido completada satisfactoriamente',
    'CLOSED': 'La solicitud ha sido cerrada y archivada'
  };
  return descriptionMap[status] || 'Estado desconocido';
};

const formatRelativeDate = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now - date);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) return `Hace ${diffDays} días`;
  if (diffDays < 30) return `Hace ${Math.ceil(diffDays / 7)} semanas`;
  
  return date.toLocaleDateString('es-ES', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
};
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>

