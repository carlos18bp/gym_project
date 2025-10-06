<template>
  <div class="px-4 py-6 sm:px-6 lg:px-8">
    <!-- Loading state -->
    <div v-if="isLoading" class="flex justify-center items-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      <span class="ml-2 text-gray-600">Cargando solicitud...</span>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="text-center py-12">
      <div class="mx-auto max-w-md">
        <svg class="mx-auto h-12 w-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <h3 class="mt-2 text-sm font-medium text-gray-900">Error al cargar la solicitud</h3>
        <p class="mt-1 text-sm text-gray-500">{{ error }}</p>
        <div class="mt-6">
          <button
            @click="goBack"
            class="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <ArrowLeftIcon class="h-4 w-4 mr-2" />
            Volver
          </button>
        </div>
      </div>
    </div>

    <!-- Request Detail Content -->
    <div v-else-if="request">
      <!-- Header -->
      <div class="mb-6">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-4">
            <button
              @click="goBack"
              class="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <ArrowLeftIcon class="h-4 w-4 mr-2" />
              Volver
            </button>
            <div>
              <h1 class="text-2xl font-bold text-gray-900">{{ request.title }}</h1>
              <p class="text-sm text-gray-600">Solicitud {{ request.request_number }}</p>
            </div>
          </div>
          
          <!-- Status and Priority Badges -->
          <div class="flex items-center space-x-2">
            <span 
              :class="getStatusColorClass(request.status)"
              class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium"
            >
              {{ getStatusDisplay(request.status) }}
            </span>
            <span 
              :class="getPriorityColorClass(request.priority)"
              class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium"
            >
              {{ getPriorityDisplay(request.priority) }}
            </span>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <!-- Main Content -->
        <div class="lg:col-span-2 space-y-6">
          <!-- Request Details -->
          <div class="bg-white shadow rounded-lg p-6">
            <h2 class="text-lg font-medium text-gray-900 mb-4">Detalles de la Solicitud</h2>
            
            <dl class="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
              <div>
                <dt class="text-sm font-medium text-gray-500">Tipo de Solicitud</dt>
                <dd class="mt-1 text-sm text-gray-900">{{ request.request_type_name }}</dd>
              </div>
              
              <div>
                <dt class="text-sm font-medium text-gray-500">Fecha de Creación</dt>
                <dd class="mt-1 text-sm text-gray-900">{{ formatDate(request.created_at) }}</dd>
              </div>
              
              <div v-if="request.status_updated_at && request.status_updated_at !== request.created_at">
                <dt class="text-sm font-medium text-gray-500">Última Actualización</dt>
                <dd class="mt-1 text-sm text-gray-900">{{ formatDate(request.status_updated_at) }}</dd>
              </div>
              
              <div>
                <dt class="text-sm font-medium text-gray-500">Días Transcurridos</dt>
                <dd class="mt-1 text-sm text-gray-900">{{ request.days_since_created }} días</dd>
              </div>
              
              <div v-if="request.estimated_completion_date">
                <dt class="text-sm font-medium text-gray-500">Fecha Estimada de Completado</dt>
                <dd class="mt-1 text-sm text-gray-900">{{ formatDate(request.estimated_completion_date) }}</dd>
              </div>
              
              <div v-if="request.actual_completion_date">
                <dt class="text-sm font-medium text-gray-500">Fecha de Completado</dt>
                <dd class="mt-1 text-sm text-gray-900">{{ formatDate(request.actual_completion_date) }}</dd>
              </div>
            </dl>

            <div class="mt-6">
              <dt class="text-sm font-medium text-gray-500 mb-2">Descripción</dt>
              <dd class="text-sm text-gray-900 whitespace-pre-wrap">{{ request.description }}</dd>
            </div>
          </div>

          <!-- Files Section -->
          <div v-if="request.files && request.files.length > 0" class="bg-white shadow rounded-lg p-6">
            <h3 class="text-lg font-medium text-gray-900 mb-4">Archivos Adjuntos</h3>
            <div class="space-y-3">
              <div
                v-for="file in request.files"
                :key="file.id"
                class="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <div class="flex items-center space-x-3">
                  <DocumentIcon class="h-8 w-8 text-gray-400" />
                  <div>
                    <p class="text-sm font-medium text-gray-900">{{ file.file_name }}</p>
                    <p class="text-xs text-gray-500">{{ formatFileSize(file.file_size) }}</p>
                  </div>
                </div>
                <a
                  :href="file.file_url"
                  target="_blank"
                  class="inline-flex items-center px-3 py-1 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                >
                  <ArrowDownTrayIcon class="h-3 w-3 mr-1" />
                  Descargar
                </a>
              </div>
            </div>
          </div>

          <!-- Conversation Section -->
          <div class="bg-white shadow rounded-lg p-6">
            <h3 class="text-lg font-medium text-gray-900 mb-4">
              Conversación ({{ request.responses?.length || 0 }} respuestas)
            </h3>
            
            <!-- Response List -->
            <div v-if="request.responses && request.responses.length > 0" class="space-y-4">
              <div
                v-for="response in request.responses"
                :key="response.id"
                :class="[
                  'p-4 rounded-lg',
                  response.user_type === userRole 
                    ? 'bg-blue-50 border-l-4 border-blue-400' 
                    : 'bg-gray-50 border-l-4 border-gray-300'
                ]"
              >
                <div class="flex items-start justify-between mb-2">
                  <div class="flex items-center space-x-2">
                    <span class="text-sm font-medium text-gray-900">
                      {{ response.user_name }}
                    </span>
                    <span 
                      :class="[
                        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                        response.user_type === 'corporate_client' 
                          ? 'bg-purple-100 text-purple-800' 
                          : 'bg-green-100 text-green-800'
                      ]"
                    >
                      {{ getUserTypeDisplay(response.user_type) }}
                    </span>
                    <span v-if="response.is_internal_note" class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                      Nota Interna
                    </span>
                  </div>
                  <span class="text-xs text-gray-500">
                    {{ formatRelativeDate(response.created_at) }}
                  </span>
                </div>
                <p class="text-sm text-gray-700 whitespace-pre-wrap">{{ response.response_text }}</p>
              </div>
            </div>

            <!-- No responses state -->
            <div v-else class="text-center py-6">
              <ChatBubbleLeftIcon class="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p class="text-sm text-gray-500">No hay respuestas aún</p>
            </div>

            <!-- Add Response Form -->
            <form @submit.prevent="submitResponse" class="mt-6 border-t pt-6">
              <div>
                <label for="response" class="block text-sm font-medium text-gray-700 mb-2">
                  Agregar Respuesta
                </label>
                <textarea
                  id="response"
                  v-model="newResponse"
                  rows="3"
                  required
                  :disabled="isSubmittingResponse"
                  class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  placeholder="Escribe tu respuesta..."
                ></textarea>
              </div>
              
              <!-- Internal note checkbox for corporate clients -->
              <div v-if="userRole === 'corporate_client'" class="mt-3">
                <label class="flex items-center">
                  <input
                    v-model="isInternalNote"
                    type="checkbox"
                    class="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                  <span class="ml-2 text-sm text-gray-700">Nota interna (solo visible para el equipo corporativo)</span>
                </label>
              </div>
              
              <div class="mt-3 flex justify-end">
                <button
                  type="submit"
                  :disabled="isSubmittingResponse || !newResponse.trim()"
                  class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div v-if="isSubmittingResponse" class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  <PaperAirplaneIcon v-else class="h-4 w-4 mr-2" />
                  {{ isSubmittingResponse ? 'Enviando...' : 'Enviar Respuesta' }}
                </button>
              </div>
            </form>
          </div>
        </div>

        <!-- Sidebar -->
        <div class="space-y-6">
          <!-- Participants -->
          <div class="bg-white shadow rounded-lg p-6">
            <h3 class="text-lg font-medium text-gray-900 mb-4">Participantes</h3>
            
            <div class="space-y-4">
              <!-- Client -->
              <div class="flex items-center space-x-3">
                <img
                  :src="clientAvatar"
                  :alt="`Avatar de ${request.client_info?.full_name}`"
                  class="h-8 w-8 rounded-full object-cover border border-gray-200"
                />
                <div>
                  <p class="text-sm font-medium text-gray-900">{{ request.client_info?.full_name }}</p>
                  <p class="text-xs text-gray-500">Cliente • {{ request.client_info?.email }}</p>
                </div>
              </div>

              <!-- Corporate Client -->
              <div class="flex items-center space-x-3">
                <img
                  :src="corporateClientAvatar"
                  :alt="`Avatar de ${request.corporate_client_info?.full_name}`"
                  class="h-8 w-8 rounded-full object-cover border border-gray-200"
                />
                <div>
                  <p class="text-sm font-medium text-gray-900">{{ request.corporate_client_info?.full_name }}</p>
                  <p class="text-xs text-gray-500">Cliente Corporativo • {{ request.corporate_client_info?.email }}</p>
                </div>
              </div>

              <!-- Assigned To (if exists) -->
              <div v-if="request.assigned_to_info" class="flex items-center space-x-3">
                <img
                  :src="assignedToAvatar"
                  :alt="`Avatar de ${request.assigned_to_info?.full_name}`"
                  class="h-8 w-8 rounded-full object-cover border border-gray-200"
                />
                <div>
                  <p class="text-sm font-medium text-gray-900">{{ request.assigned_to_info?.full_name }}</p>
                  <p class="text-xs text-gray-500">Asignado • {{ request.assigned_to_info?.email }}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Organization Info -->
          <div v-if="request.organization_info" class="bg-white shadow rounded-lg p-6">
            <h3 class="text-lg font-medium text-gray-900 mb-4">Organización</h3>
            <div class="flex items-center space-x-3">
              <img
                :src="request.organization_info.profile_image || '/src/assets/images/user_avatar.jpg'"
                :alt="`Logo de ${request.organization_info.title}`"
                class="h-10 w-10 rounded-full object-cover border border-gray-200"
              />
              <div>
                <p class="text-sm font-medium text-gray-900">{{ request.organization_info.title }}</p>
                <p class="text-xs text-gray-500">Vía organización</p>
              </div>
            </div>
          </div>

          <!-- Status Actions (for corporate clients) -->
          <div v-if="userRole === 'corporate_client'" class="bg-white shadow rounded-lg p-6">
            <h3 class="text-lg font-medium text-gray-900 mb-4">Acciones</h3>
            
            <div class="space-y-3">
              <div>
                <label for="status" class="block text-sm font-medium text-gray-700 mb-2">
                  Cambiar Estado
                </label>
                <select
                  id="status"
                  v-model="selectedStatus"
                  @change="updateStatus"
                  :disabled="isUpdatingStatus"
                  class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                >
                  <option value="PENDING">Pendiente</option>
                  <option value="IN_REVIEW">En Revisión</option>
                  <option value="RESPONDED">Respondida</option>
                  <option value="RESOLVED">Resuelta</option>
                  <option value="CLOSED">Cerrada</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { 
  ArrowLeftIcon, 
  DocumentIcon, 
  ArrowDownTrayIcon, 
  ChatBubbleLeftIcon, 
  PaperAirplaneIcon 
} from '@heroicons/vue/24/outline';
import { useCorporateRequestsStore } from '@/stores/corporate_requests';
import { useUserStore } from '@/stores/auth/user';
import { showNotification } from '@/shared/notification_message';

// Stores
const requestsStore = useCorporateRequestsStore();
const userStore = useUserStore();
const route = useRoute();
const router = useRouter();

// Reactive state
const request = ref(null);
const isLoading = ref(false);
const error = ref(null);
const newResponse = ref('');
const isInternalNote = ref(false);
const isSubmittingResponse = ref(false);
const selectedStatus = ref('');
const isUpdatingStatus = ref(false);

// Computed properties
const userRole = computed(() => userStore.currentUser?.role);
const clientAvatar = computed(() => '/src/assets/images/user_avatar.jpg');
const corporateClientAvatar = computed(() => '/src/assets/images/user_avatar.jpg');
const assignedToAvatar = computed(() => '/src/assets/images/user_avatar.jpg');

// Methods
const loadRequestDetail = async () => {
  try {
    isLoading.value = true;
    error.value = null;
    
    const requestId = route.query.id;
    if (!requestId) {
      throw new Error('ID de solicitud no proporcionado');
    }

    let response;
    if (userRole.value === 'client' || userRole.value === 'basic') {
      response = await requestsStore.getMyRequestDetail(requestId);
    } else if (userRole.value === 'corporate_client') {
      response = await requestsStore.getReceivedRequestDetail(requestId);
    } else {
      throw new Error('Rol de usuario no válido');
    }

    request.value = response.corporate_request;
    selectedStatus.value = request.value.status;
    
  } catch (err) {
    console.error('Error loading request detail:', err);
    error.value = err.response?.data?.error || err.message || 'Error al cargar la solicitud';
  } finally {
    isLoading.value = false;
  }
};

const submitResponse = async () => {
  try {
    isSubmittingResponse.value = true;
    
    const responseData = {
      response_text: newResponse.value.trim()
    };
    
    if (userRole.value === 'corporate_client') {
      responseData.is_internal_note = isInternalNote.value;
    }

    let response;
    if (userRole.value === 'client' || userRole.value === 'basic') {
      response = await requestsStore.addResponseToMyRequest(request.value.id, responseData);
    } else if (userRole.value === 'corporate_client') {
      response = await requestsStore.addResponseToReceivedRequest(request.value.id, responseData);
    }

    // The store automatically updates currentRequest.responses and response_count
    // Just sync our local request with the store's currentRequest
    if (requestsStore.currentRequest && requestsStore.currentRequest.id === request.value.id) {
      request.value.responses = requestsStore.currentRequest.responses;
      request.value.response_count = requestsStore.currentRequest.response_count;
    }
    
    // Clear form
    newResponse.value = '';
    isInternalNote.value = false;
    
    showNotification('Respuesta enviada exitosamente', 'success');
    
  } catch (err) {
    console.error('Error submitting response:', err);
    showNotification(err.response?.data?.error || 'Error al enviar la respuesta', 'error');
  } finally {
    isSubmittingResponse.value = false;
  }
};

const updateStatus = async () => {
  if (selectedStatus.value === request.value.status) return;
  
  try {
    isUpdatingStatus.value = true;
    
    await requestsStore.updateReceivedRequest(request.value.id, {
      status: selectedStatus.value
    });
    
    request.value.status = selectedStatus.value;
    request.value.status_updated_at = new Date().toISOString();
    
    showNotification('Estado actualizado exitosamente', 'success');
    
  } catch (err) {
    console.error('Error updating status:', err);
    showNotification(err.response?.data?.error || 'Error al actualizar el estado', 'error');
    selectedStatus.value = request.value.status; // Revert
  } finally {
    isUpdatingStatus.value = false;
  }
};

const goBack = () => {
  router.push({ name: 'organizations_dashboard' });
};

// Utility functions
const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('es-ES', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatRelativeDate = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now - date);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) return `Hace ${diffDays} días`;
  
  return formatDate(dateString);
};

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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

const getUserTypeDisplay = (userType) => {
  const typeMap = {
    'client': 'Cliente',
    'corporate_client': 'Cliente Corporativo'
  };
  return typeMap[userType] || userType;
};

// Watchers
watch(() => route.query.id, () => {
  if (route.query.id) {
    loadRequestDetail();
  }
});

// Lifecycle
onMounted(() => {
  if (route.query.id) {
    loadRequestDetail();
  }
});
</script>
