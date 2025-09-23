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
                    Crear Nueva Organización
                  </DialogTitle>
                  <p class="mt-1 text-sm text-gray-500">
                    Crea tu organización para empezar a recibir solicitudes corporativas
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
                <span class="ml-2 text-gray-600">Creando organización...</span>
              </div>

              <!-- Success State -->
              <div v-else-if="showSuccess" class="text-center py-6">
                <CheckCircleIcon class="h-16 w-16 text-green-500 mx-auto mb-4" />
                <h3 class="text-lg font-medium text-gray-900 mb-2">
                  ¡Organización Creada!
                </h3>
                <p class="text-sm text-gray-600 mb-6">
                  Tu organización <strong>{{ createdOrganization?.title }}</strong> ha sido creada exitosamente.
                </p>
                <div class="space-y-3">
                  <button
                    @click="resetAndCreateAnother"
                    class="w-full inline-flex justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    Crear Otra Organización
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
                <!-- Basic Information -->
                <div class="space-y-4">
                  <h4 class="text-md font-medium text-gray-900">Información Básica</h4>
                  
                  <!-- Title -->
                  <div>
                    <label for="title" class="block text-sm font-medium leading-6 text-gray-900">
                      Nombre de la Organización *
                    </label>
                    <div class="mt-2">
                      <input
                        id="title"
                        v-model="form.title"
                        type="text"
                        required
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                        placeholder="Ej: Consultora Jurídica Andina"
                      />
                    </div>
                    <p v-if="errors.title" class="mt-1 text-sm text-red-600">{{ errors.title[0] }}</p>
                  </div>

                  <!-- Description -->
                  <div>
                    <label for="description" class="block text-sm font-medium leading-6 text-gray-900">
                      Descripción *
                    </label>
                    <div class="mt-2">
                      <textarea
                        id="description"
                        v-model="form.description"
                        rows="4"
                        required
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                        placeholder="Describe el propósito y servicios de tu organización..."
                      ></textarea>
                    </div>
                    <p class="mt-1 text-xs text-gray-500">
                      Esta descripción será visible para los clientes que reciban invitaciones
                    </p>
                    <p v-if="errors.description" class="mt-1 text-sm text-red-600">{{ errors.description[0] }}</p>
                  </div>
                </div>

                <!-- Images Section -->
                <div class="space-y-4 border-t border-gray-200 pt-6">
                  <h4 class="text-md font-medium text-gray-900">Imágenes (Opcional)</h4>
                  
                  <!-- Profile Image -->
                  <div>
                    <label class="block text-sm font-medium leading-6 text-gray-900">
                      Imagen de Perfil
                    </label>
                    <div class="mt-2 flex items-center space-x-4">
                      <!-- Profile Image Preview -->
                      <div class="flex-shrink-0">
                        <img
                          :src="profileImagePreview || '/src/assets/images/user_avatar.jpg'"
                          alt="Profile preview"
                          class="h-16 w-16 rounded-full object-cover border-2 border-gray-200 bg-gray-50"
                        />
                      </div>
                      
                      <!-- Upload Button -->
                      <div class="flex-1">
                        <input
                          ref="profileImageInput"
                          type="file"
                          accept="image/*"
                          class="hidden"
                          @change="handleProfileImageChange"
                        />
                        <button
                          type="button"
                          @click="$refs.profileImageInput.click()"
                          class="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          <PhotoIcon class="h-4 w-4 mr-2" />
                          Seleccionar Imagen
                        </button>
                        <p class="mt-1 text-xs text-gray-500">PNG, JPG hasta 5MB</p>
                      </div>
                    </div>
                    <p v-if="errors.profile_image" class="mt-1 text-sm text-red-600">{{ errors.profile_image[0] }}</p>
                  </div>

                  <!-- Cover Image -->
                  <div>
                    <label class="block text-sm font-medium leading-6 text-gray-900">
                      Imagen de Portada
                    </label>
                    <div class="mt-2">
                      <!-- Cover Image Preview -->
                      <div class="mb-4">
                        <img
                          :src="coverImagePreview || defaultCoverImage"
                          alt="Cover preview"
                          class="w-full h-32 rounded-lg object-cover border-2 border-gray-200 bg-gray-50"
                        />
                      </div>
                      
                      <!-- Upload Button -->
                      <div>
                        <input
                          ref="coverImageInput"
                          type="file"
                          accept="image/*"
                          class="hidden"
                          @change="handleCoverImageChange"
                        />
                        <button
                          type="button"
                          @click="$refs.coverImageInput.click()"
                          class="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          <PhotoIcon class="h-4 w-4 mr-2" />
                          Seleccionar Portada
                        </button>
                        <p class="mt-1 text-xs text-gray-500">PNG, JPG hasta 5MB. Recomendado: 800x400px</p>
                      </div>
                    </div>
                    <p v-if="errors.cover_image" class="mt-1 text-sm text-red-600">{{ errors.cover_image[0] }}</p>
                  </div>
                </div>

                <!-- Preview Section -->
                <div v-if="form.title || form.description" class="space-y-4 border-t border-gray-200 pt-6">
                  <h4 class="text-md font-medium text-gray-900">Vista Previa</h4>
                  
                  <!-- Organization Preview Card -->
                  <div class="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
                    <!-- Cover Preview -->
                    <div class="relative h-24 bg-gradient-to-r from-blue-500 to-purple-600">
                      <img 
                        v-if="coverImagePreview" 
                        :src="coverImagePreview" 
                        alt="Portada preview"
                        class="w-full h-full object-cover"
                      />
                      <div class="absolute inset-0 bg-black bg-opacity-30"></div>
                      
                      <!-- Profile Preview -->
                      <div class="absolute bottom-2 left-4">
                        <img 
                          :src="profileImagePreview || '/src/assets/images/user_avatar.jpg'" 
                          alt="Logo preview"
                          class="h-12 w-12 rounded-full border-2 border-white object-cover bg-white"
                        />
                      </div>
                    </div>
                    
                    <!-- Content Preview -->
                    <div class="p-4">
                      <h3 class="text-sm font-medium text-gray-900 mb-1">
                        {{ form.title || 'Nombre de la Organización' }}
                      </h3>
                      <p class="text-xs text-gray-600 line-clamp-2">
                        {{ form.description || 'Descripción de la organización...' }}
                      </p>
                    </div>
                  </div>
                </div>

                <!-- Info Box -->
                <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div class="flex">
                    <InformationCircleIcon class="h-5 w-5 text-blue-400 mt-0.5" />
                    <div class="ml-3">
                      <h5 class="text-sm font-medium text-blue-800">Información importante</h5>
                      <div class="mt-1 text-sm text-blue-700 space-y-1">
                        <p>• Serás el líder y administrador de esta organización</p>
                        <p>• Podrás invitar clientes a unirse como miembros</p>
                        <p>• Los miembros podrán enviarte solicitudes corporativas</p>
                        <p>• Puedes editar la información en cualquier momento</p>
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
                    :disabled="isLoading || !form.title.trim() || !form.description.trim()"
                    class="inline-flex justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div v-if="isLoading" class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    <BuildingOfficeIcon v-else class="h-4 w-4 mr-2" />
                    {{ isLoading ? 'Creando...' : 'Crear Organización' }}
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
  PhotoIcon, 
  InformationCircleIcon, 
  CheckCircleIcon,
  BuildingOfficeIcon
} from '@heroicons/vue/24/outline';
import { useOrganizationsStore } from '@/stores/organizations';
import { showNotification } from '@/shared/notification_message';

// Props
const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  }
});

// Emits
const emit = defineEmits(['close', 'created']);

// Store
const organizationsStore = useOrganizationsStore();

// Reactive state
const isLoading = ref(false);
const showSuccess = ref(false);
const errors = ref({});
const createdOrganization = ref(null);

const form = ref({
  title: '',
  description: '',
  profile_image: null,
  cover_image: null
});

const profileImagePreview = ref(null);
const coverImagePreview = ref(null);

// Computed properties
const defaultCoverImage = computed(() => {
  return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDQwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yMDAgMTAwTDE4MCA4MEwyMjAgODBMMjAwIDEwMFoiIGZpbGw9IiM5Q0E0QUYiLz4KPC9zdmc+';
});

// Methods
const resetForm = () => {
  form.value = {
    title: '',
    description: '',
    profile_image: null,
    cover_image: null
  };
  errors.value = {};
  profileImagePreview.value = null;
  coverImagePreview.value = null;
  showSuccess.value = false;
  createdOrganization.value = null;
};

const handleProfileImageChange = (event) => {
  const file = event.target.files[0];
  if (file) {
    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      showNotification('La imagen debe ser menor a 5MB', 'warning');
      return;
    }
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      showNotification('Solo se permiten archivos de imagen', 'warning');
      return;
    }
    
    form.value.profile_image = file;
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      profileImagePreview.value = e.target.result;
    };
    reader.readAsDataURL(file);
  }
};

const handleCoverImageChange = (event) => {
  const file = event.target.files[0];
  if (file) {
    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      showNotification('La imagen debe ser menor a 5MB', 'warning');
      return;
    }
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      showNotification('Solo se permiten archivos de imagen', 'warning');
      return;
    }
    
    form.value.cover_image = file;
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      coverImagePreview.value = e.target.result;
    };
    reader.readAsDataURL(file);
  }
};

const handleSubmit = async () => {
  try {
    isLoading.value = true;
    errors.value = {};
    
    const organizationData = {
      title: form.value.title.trim(),
      description: form.value.description.trim()
    };
    
    // Add images if they were selected
    if (form.value.profile_image) {
      organizationData.profile_image = form.value.profile_image;
    }
    if (form.value.cover_image) {
      organizationData.cover_image = form.value.cover_image;
    }
    
    const response = await organizationsStore.createOrganization(organizationData);
    
    createdOrganization.value = response.organization;
    showSuccess.value = true;
    showNotification('Organización creada exitosamente', 'success');
    emit('created', response.organization);
    
  } catch (error) {
    console.error('Error creating organization:', error);
    
    if (error.response?.data?.details) {
      errors.value = error.response.data.details;
    } else if (error.response?.data?.error) {
      showNotification(error.response.data.error, 'error');
    } else {
      showNotification('Error al crear la organización', 'error');
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
    });
  }
});
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>

