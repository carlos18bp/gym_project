<template>
  <TransitionRoot as="template" :show="visible">
    <Dialog class="relative z-50" @close="handleClose">
      <TransitionChild
        as="template"
        enter="ease-out duration-300"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="ease-in duration-200"
        leave-from="opacity-100"
        leave-to="opacity-0"
      >
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
      </TransitionChild>

      <div class="fixed inset-0 z-10 overflow-y-auto">
        <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
          <TransitionChild
            as="template"
            enter="ease-out duration-300"
            enter-from="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            enter-to="opacity-100 translate-y-0 sm:scale-100"
            leave="ease-in duration-200"
            leave-from="opacity-100 translate-y-0 sm:scale-100"
            leave-to="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
          >
            <DialogPanel class="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl sm:p-6">
              <!-- Modal Header -->
              <div class="flex items-center justify-between border-b border-gray-200 pb-4 mb-6">
                <div>
                  <DialogTitle as="h3" class="text-lg font-semibold leading-6 text-gray-900">
                    Nueva Solicitud Corporativa
                  </DialogTitle>
                  <p class="mt-1 text-sm text-gray-500">
                    Envía una solicitud a través de una de tus organizaciones
                  </p>
                </div>
                <button
                  @click="handleClose"
                  class="rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <XMarkIcon class="h-6 w-6" />
                </button>
              </div>

              <!-- Loading State -->
              <div v-if="isLoading" class="flex justify-center items-center py-8">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span class="ml-2 text-gray-600">Enviando solicitud...</span>
              </div>

              <!-- Success State -->
              <div v-else-if="showSuccess" class="text-center py-6">
                <CheckCircleIcon class="h-16 w-16 text-green-500 mx-auto mb-4" />
                <h3 class="text-lg font-medium text-gray-900 mb-2">
                  ¡Solicitud Enviada!
                </h3>
                <p class="text-sm text-gray-600 mb-2">
                  Tu solicitud <strong>{{ createdRequest?.request_number }}</strong> ha sido enviada exitosamente.
                </p>
                <p class="text-sm text-gray-500 mb-6">
                  El equipo de <strong>{{ createdRequest?.organization_info?.title }}</strong> la revisará pronto.
                </p>
                <div class="space-y-3">
                  <button
                    @click="resetAndCreateAnother"
                    class="w-full inline-flex justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    Crear Otra Solicitud
                  </button>
                  <button
                    @click="handleClose"
                    class="w-full inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    Cerrar
                  </button>
                </div>
              </div>

              <!-- Form Content -->
              <form v-else @submit.prevent="handleSubmit" class="space-y-6">
                <!-- Organization Selection -->
                <div>
                  <label for="organization" class="block text-sm font-medium leading-6 text-gray-900">
                    Organización *
                  </label>
                  <div class="mt-2">
                    <select
                      id="organization"
                      v-model="form.organization"
                      required
                      class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                    >
                      <option value="">Selecciona una organización</option>
                      <option 
                        v-for="org in organizations" 
                        :key="org.id" 
                        :value="org.id"
                      >
                        {{ org.title }}
                      </option>
                    </select>
                  </div>
                  <p v-if="errors.organization" class="mt-1 text-sm text-red-600">{{ errors.organization[0] }}</p>
                </div>

                <!-- Selected Organization Info -->
                <div v-if="selectedOrganization" class="bg-gray-50 rounded-lg p-4">
                  <div class="flex items-center space-x-3">
                    <img
                      :src="selectedOrganization.profile_image_url || '/src/assets/images/user_avatar.jpg'"
                      :alt="`Logo de ${selectedOrganization.title}`"
                      class="h-10 w-10 rounded-full object-cover border border-gray-200"
                    />
                    <div>
                      <h4 class="text-sm font-medium text-gray-900">{{ selectedOrganization.title }}</h4>
                      <p class="text-xs text-gray-500">
                        Líder: {{ selectedOrganization.corporate_client_info?.full_name }}
                      </p>
                    </div>
                  </div>
                </div>

                <!-- Request Type -->
                <div>
                  <label for="request_type" class="block text-sm font-medium leading-6 text-gray-900">
                    Tipo de Solicitud *
                  </label>
                  <div class="mt-2">
                    <select
                      id="request_type"
                      v-model="form.request_type"
                      required
                      class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                    >
                      <option value="">Selecciona un tipo</option>
                      <option 
                        v-for="type in requestTypes" 
                        :key="type.id" 
                        :value="type.id"
                      >
                        {{ type.name }}
                      </option>
                    </select>
                  </div>
                  <p v-if="errors.request_type" class="mt-1 text-sm text-red-600">{{ errors.request_type[0] }}</p>
                </div>

                <!-- Title -->
                <div>
                  <label for="title" class="block text-sm font-medium leading-6 text-gray-900">
                    Título de la Solicitud *
                  </label>
                  <div class="mt-2">
                    <input
                      id="title"
                      v-model="form.title"
                      type="text"
                      required
                      class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                      placeholder="Ej: Revisión de contrato de servicios"
                    />
                  </div>
                  <p v-if="errors.title" class="mt-1 text-sm text-red-600">{{ errors.title[0] }}</p>
                </div>

                <!-- Description -->
                <div>
                  <label for="description" class="block text-sm font-medium leading-6 text-gray-900">
                    Descripción Detallada *
                  </label>
                  <div class="mt-2">
                    <textarea
                      id="description"
                      v-model="form.description"
                      rows="4"
                      required
                      class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                      placeholder="Describe detalladamente lo que necesitas..."
                    ></textarea>
                  </div>
                  <p class="mt-1 text-xs text-gray-500">
                    Proporciona todos los detalles relevantes para que puedan ayudarte mejor
                  </p>
                  <p v-if="errors.description" class="mt-1 text-sm text-red-600">{{ errors.description[0] }}</p>
                </div>

                <!-- Priority -->
                <div>
                  <label for="priority" class="block text-sm font-medium leading-6 text-gray-900">
                    Prioridad
                  </label>
                  <div class="mt-2">
                    <select
                      id="priority"
                      v-model="form.priority"
                      class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                    >
                      <option value="LOW">Baja</option>
                      <option value="MEDIUM">Media</option>
                      <option value="HIGH">Alta</option>
                      <option value="URGENT">Urgente</option>
                    </select>
                  </div>
                  <p v-if="errors.priority" class="mt-1 text-sm text-red-600">{{ errors.priority[0] }}</p>
                </div>

                <!-- Info Box -->
                <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div class="flex">
                    <InformationCircleIcon class="h-5 w-5 text-blue-400 mt-0.5" />
                    <div class="ml-3">
                      <h5 class="text-sm font-medium text-blue-800">Información importante</h5>
                      <div class="mt-1 text-sm text-blue-700 space-y-1">
                        <p>• Tu solicitud será enviada al equipo de la organización seleccionada</p>
                        <p>• Recibirás un número de seguimiento para tu solicitud</p>
                        <p>• Podrás ver el progreso y responder a comentarios</p>
                        <p>• El equipo corporativo te contactará para más detalles si es necesario</p>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Form Actions -->
                <div class="flex justify-end space-x-3 border-t border-gray-200 pt-6">
                  <button
                    type="button"
                    @click="handleClose"
                    class="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    :disabled="isLoading || !isFormValid"
                    class="inline-flex justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div v-if="isLoading" class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    <PaperAirplaneIcon v-else class="h-4 w-4 mr-2" />
                    {{ isLoading ? 'Enviando...' : 'Enviar Solicitud' }}
                  </button>
                </div>
              </form>
            </DialogPanel>
          </TransitionChild>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue';
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionChild,
  TransitionRoot,
} from '@headlessui/vue';
import { 
  XMarkIcon, 
  InformationCircleIcon, 
  CheckCircleIcon,
  PaperAirplaneIcon
} from '@heroicons/vue/24/outline';
import { useCorporateRequestsStore } from '@/stores/corporate_requests';
import { showNotification } from '@/shared/notification_message';

// Props
const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  organizations: {
    type: Array,
    default: () => []
  }
});

// Emits
const emit = defineEmits(['close', 'created']);

// Store
const requestsStore = useCorporateRequestsStore();

// Reactive state
const isLoading = ref(false);
const showSuccess = ref(false);
const errors = ref({});
const createdRequest = ref(null);
const requestTypes = ref([]);

const form = ref({
  organization: '',
  request_type: '',
  title: '',
  description: '',
  priority: 'MEDIUM'
});

// Computed properties
const selectedOrganization = computed(() => {
  return props.organizations.find(org => org.id === form.value.organization);
});

const isFormValid = computed(() => {
  return form.value.organization && 
         form.value.request_type && 
         form.value.title.trim() && 
         form.value.description.trim();
});

// Methods
const resetForm = () => {
  form.value = {
    organization: '',
    request_type: '',
    title: '',
    description: '',
    priority: 'MEDIUM'
  };
  errors.value = {};
  showSuccess.value = false;
  createdRequest.value = null;
};

const loadRequestTypes = async () => {
  try {
    const types = await requestsStore.getRequestTypes();
    
    // Ensure we have an array of types
    if (Array.isArray(types)) {
      requestTypes.value = types;
    } else {
      console.error('Request types is not an array:', types);
      showNotification('Formato de tipos de solicitud inválido', 'error');
    }
  } catch (error) {
    console.error('Error loading request types:', error);
    
    if (error.response?.status === 403) {
      showNotification('No tienes permisos para cargar tipos de solicitudes', 'error');
    } else if (error.response?.status === 401) {
      showNotification('Sesión expirada. Por favor, vuelve a iniciar sesión', 'error');
    } else {
      showNotification('Error al cargar tipos de solicitudes', 'error');
    }
  }
};

const handleSubmit = async () => {
  try {
    isLoading.value = true;
    errors.value = {};
    
    const requestData = {
      organization: form.value.organization,
      request_type: form.value.request_type,
      title: form.value.title.trim(),
      description: form.value.description.trim(),
      priority: form.value.priority
    };
    
    const response = await requestsStore.createCorporateRequest(requestData);
    
    createdRequest.value = response.corporate_request;
    showSuccess.value = true;
    showNotification('Solicitud enviada exitosamente', 'success');
    emit('created', response.corporate_request);
    
  } catch (error) {
    console.error('Error creating request:', error);
    
    if (error.response?.data?.details) {
      errors.value = error.response.data.details;
    } else if (error.response?.data?.error) {
      showNotification(error.response.data.error, 'error');
    } else {
      showNotification('Error al enviar la solicitud', 'error');
    }
  } finally {
    isLoading.value = false;
  }
};

const resetAndCreateAnother = () => {
  resetForm();
  // Keep modal open but reset form
};

const handleClose = () => {
  if (!isLoading.value) {
    emit('close');
  }
};

// Watchers
watch(() => props.visible, (newValue) => {
  if (newValue) {
    nextTick(() => {
      resetForm();
      if (requestTypes.value.length === 0) {
        loadRequestTypes();
      }
    });
  }
});

// Lifecycle
onMounted(() => {
  loadRequestTypes();
});
</script>
