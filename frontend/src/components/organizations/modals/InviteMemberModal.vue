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
            <DialogPanel class="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
              <!-- Modal Header -->
              <div class="flex items-center justify-between border-b border-gray-200 pb-4 mb-6">
                <div>
                  <DialogTitle as="h3" class="text-lg font-semibold leading-6 text-gray-900">
                    Invitar Nuevo Miembro
                  </DialogTitle>
                  <p class="mt-1 text-sm text-gray-500">
                    Invita a un cliente a unirse a {{ organization?.title }}
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
                <span class="ml-2 text-gray-600">Enviando invitación...</span>
              </div>

              <!-- Form Content -->
              <form v-else @submit.prevent="handleSubmit" class="space-y-6">
                <!-- Organization Info -->
                <div v-if="organization" class="bg-gray-50 rounded-lg p-4">
                  <div class="flex items-center space-x-3">
                    <img
                      :src="organization.profile_image_url || userAvatar"
                      :alt="`Logo de ${organization.title}`"
                      class="h-12 w-12 rounded-full object-cover border-2 border-white"
                    />
                    <div>
                      <h4 class="text-sm font-medium text-gray-900">{{ organization.title }}</h4>
                      <p class="text-xs text-gray-500">{{ organization.member_count }} miembros actuales</p>
                    </div>
                  </div>
                </div>

                <!-- Email Input -->
                <div>
                  <label for="email" class="block text-sm font-medium leading-6 text-gray-900">
                    Email del Cliente *
                  </label>
                  <div class="mt-2">
                    <input
                      id="email"
                      v-model="form.invited_user_email"
                      type="email"
                      required
                      class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                      placeholder="cliente@ejemplo.com"
                    />
                  </div>
                  <p class="mt-1 text-xs text-gray-500">
                    El email debe corresponder a un usuario registrado como cliente en la plataforma
                  </p>
                  <p v-if="errors.invited_user_email" class="mt-1 text-sm text-red-600">
                    {{ errors.invited_user_email[0] }}
                  </p>
                </div>

                <!-- Custom Message -->
                <div>
                  <label for="message" class="block text-sm font-medium leading-6 text-gray-900">
                    Mensaje Personalizado
                  </label>
                  <div class="mt-2">
                    <textarea
                      id="message"
                      v-model="form.message"
                      rows="4"
                      class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                      placeholder="Opcional: Añade un mensaje personalizado para la invitación..."
                    ></textarea>
                  </div>
                  <p class="mt-1 text-xs text-gray-500">
                    Este mensaje se incluirá en la invitación que reciba el cliente
                  </p>
                  <p v-if="errors.message" class="mt-1 text-sm text-red-600">
                    {{ errors.message[0] }}
                  </p>
                </div>

                <!-- Preview Message -->
                <div v-if="form.message.trim()" class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h5 class="text-sm font-medium text-blue-900 mb-2">Vista previa del mensaje:</h5>
                  <div class="text-sm text-blue-800 bg-white rounded p-3 border border-blue-100">
                    <p class="mb-2"><strong>{{ organization?.title }}</strong> te ha invitado a unirte a su organización.</p>
                    <p class="mb-2 italic">"{{ form.message }}"</p>
                    <p class="text-xs text-blue-600">Puedes aceptar o rechazar esta invitación desde tu panel de control.</p>
                  </div>
                </div>

                <!-- Info Box -->
                <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div class="flex">
                    <InformationCircleIcon class="h-5 w-5 text-yellow-400 mt-0.5" />
                    <div class="ml-3">
                      <h5 class="text-sm font-medium text-yellow-800">Información importante</h5>
                      <div class="mt-1 text-sm text-yellow-700 space-y-1">
                        <p>• La invitación se enviará al usuario dentro de la plataforma</p>
                        <p>• El usuario debe estar registrado como cliente</p>
                        <p>• Las invitaciones expiran automáticamente en 30 días</p>
                        <p>• Puedes cancelar invitaciones pendientes en cualquier momento</p>
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
                    :disabled="isLoading || !form.invited_user_email.trim()"
                    class="inline-flex justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div v-if="isLoading" class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    <UserPlusIcon v-else class="h-4 w-4 mr-2" />
                    {{ isLoading ? 'Enviando...' : 'Enviar Invitación' }}
                  </button>
                </div>
              </form>

              <!-- Success State -->
              <div v-if="showSuccess" class="text-center py-6">
                <CheckCircleIcon class="h-16 w-16 text-green-500 mx-auto mb-4" />
                <h3 class="text-lg font-medium text-gray-900 mb-2">
                  ¡Invitación Enviada!
                </h3>
                <p class="text-sm text-gray-600 mb-6">
                  La invitación ha sido enviada exitosamente a <strong>{{ form.invited_user_email }}</strong>
                </p>
                <div class="space-y-3">
                  <button
                    @click="resetAndInviteAnother"
                    class="w-full inline-flex justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    Invitar a Otra Persona
                  </button>
                  <button
                    @click="handleClose"
                    class="w-full inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue';
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionChild,
  TransitionRoot,
} from '@headlessui/vue';
import { 
  XMarkIcon, 
  UserPlusIcon, 
  InformationCircleIcon, 
  CheckCircleIcon 
} from '@heroicons/vue/24/outline';
import { useOrganizationsStore } from '@/stores/organizations';
import { showNotification } from '@/shared/notification_message';
import userAvatar from '@/assets/images/user_avatar.jpg';

// Props
const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  organization: {
    type: Object,
    default: null
  }
});

// Emits
const emit = defineEmits(['close', 'invited']);

// Store
const organizationsStore = useOrganizationsStore();

// Reactive state
const isLoading = ref(false);
const showSuccess = ref(false);
const errors = ref({});
const form = ref({
  invited_user_email: '',
  message: ''
});

// Methods
const resetForm = () => {
  form.value = {
    invited_user_email: '',
    message: ''
  };
  errors.value = {};
  showSuccess.value = false;
};

const handleSubmit = async () => {
  if (!props.organization) return;
  
  try {
    isLoading.value = true;
    errors.value = {};
    
    const invitationData = {
      invited_user_email: form.value.invited_user_email.trim(),
      message: form.value.message.trim()
    };
    
    const response = await organizationsStore.sendInvitation(props.organization.id, invitationData);
    
    showNotification('Invitación enviada exitosamente', 'success');
    showSuccess.value = true;
    emit('invited', response.invitation);
    
  } catch (error) {
    console.error('Error sending invitation:', error);
    
    if (error.response?.data?.details) {
      errors.value = error.response.data.details;
    } else if (error.response?.data?.error) {
      showNotification(error.response.data.error, 'error');
    } else if (error.response?.status === 400) {
      if (error.response.data?.invited_user_email) {
        errors.value.invited_user_email = error.response.data.invited_user_email;
      } else {
        showNotification('Error en los datos de la invitación', 'error');
      }
    } else {
      showNotification('Error al enviar la invitación', 'error');
    }
  } finally {
    isLoading.value = false;
  }
};

const resetAndInviteAnother = () => {
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
    });
  }
});

// Default messages
const getDefaultMessage = computed(() => {
  if (!props.organization) return '';
  return `Te invitamos a unirte a nuestra organización "${props.organization.title}" para colaborar en proyectos y solicitudes corporativas. ¡Esperamos contar contigo!`;
});

// Set default message when organization changes
watch(() => props.organization, (newOrganization) => {
  if (newOrganization && props.visible && !form.value.message.trim()) {
    form.value.message = getDefaultMessage.value;
  }
});
</script>

