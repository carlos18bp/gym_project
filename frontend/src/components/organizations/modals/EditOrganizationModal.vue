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
                    Editar Organización
                  </DialogTitle>
                  <p class="mt-1 text-sm text-gray-500">
                    Actualiza la información y configuración de tu organización
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
                <span class="ml-2 text-gray-600">Actualizando organización...</span>
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
                        placeholder="Ingresa el nombre de la organización"
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
                        placeholder="Describe tu organización..."
                      ></textarea>
                    </div>
                    <p v-if="errors.description" class="mt-1 text-sm text-red-600">{{ errors.description[0] }}</p>
                  </div>

                  <!-- Status -->
                  <div>
                    <label class="block text-sm font-medium leading-6 text-gray-900">
                      Estado de la Organización
                    </label>
                    <div class="mt-2">
                      <div class="flex items-center space-x-6">
                        <div class="flex items-center">
                          <input
                            id="active"
                            v-model="form.is_active"
                            :value="true"
                            type="radio"
                            class="h-4 w-4 text-blue-600 focus:ring-blue-600 border-gray-300"
                          />
                          <label for="active" class="ml-2 block text-sm text-gray-900">
                            Activa
                          </label>
                        </div>
                        <div class="flex items-center">
                          <input
                            id="inactive"
                            v-model="form.is_active"
                            :value="false"
                            type="radio"
                            class="h-4 w-4 text-blue-600 focus:ring-blue-600 border-gray-300"
                          />
                          <label for="inactive" class="ml-2 block text-sm text-gray-900">
                            Inactiva
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Images Section -->
                <div class="space-y-4 border-t border-gray-200 pt-6">
                  <h4 class="text-md font-medium text-gray-900">Imágenes</h4>
                  
                  <!-- Profile Image -->
                  <div>
                    <label class="block text-sm font-medium leading-6 text-gray-900">
                      Imagen de Perfil
                    </label>
                    <div class="mt-2 flex items-center space-x-4">
                      <!-- Current Profile Image -->
                      <div class="flex-shrink-0">
                        <img
                          :src="currentProfileImage"
                          alt="Profile preview"
                          class="h-16 w-16 rounded-full object-cover border-2 border-gray-200"
                        />
                      </div>
                      
                      <!-- Upload Button -->
                      <div>
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
                          Cambiar Imagen
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
                      <!-- Current Cover Image -->
                      <div class="mb-4">
                        <img
                          :src="currentCoverImage"
                          alt="Cover preview"
                          class="w-full h-32 rounded-lg object-cover border-2 border-gray-200"
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
                          Cambiar Portada
                        </button>
                        <p class="mt-1 text-xs text-gray-500">PNG, JPG hasta 5MB</p>
                      </div>
                    </div>
                    <p v-if="errors.cover_image" class="mt-1 text-sm text-red-600">{{ errors.cover_image[0] }}</p>
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
                    :disabled="isLoading"
                    class="inline-flex justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div v-if="isLoading" class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    {{ isLoading ? 'Guardando...' : 'Guardar Cambios' }}
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
import { XMarkIcon, PhotoIcon } from '@heroicons/vue/24/outline';
import { useOrganizationsStore } from '@/stores/organizations';
import { showNotification } from '@/shared/notification_message';

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
const emit = defineEmits(['close', 'updated']);

// Store
const organizationsStore = useOrganizationsStore();

// Reactive state
const isLoading = ref(false);
const errors = ref({});
const form = ref({
  title: '',
  description: '',
  is_active: true,
  profile_image: null,
  cover_image: null
});

const profileImagePreview = ref(null);
const coverImagePreview = ref(null);

// Computed properties
const currentProfileImage = computed(() => {
  if (profileImagePreview.value) return profileImagePreview.value;
  if (props.organization?.profile_image_url) return props.organization.profile_image_url;
  return '/src/assets/images/user_avatar.jpg';
});

const currentCoverImage = computed(() => {
  if (coverImagePreview.value) return coverImagePreview.value;
  if (props.organization?.cover_image_url) return props.organization.cover_image_url;
  return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDQwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yMDAgMTAwTDE4MCA4MEwyMjAgODBMMjAwIDEwMFoiIGZpbGw9IiM5Q0E0QUYiLz4KPC9zdmc+';
});

// Methods
const resetForm = () => {
  if (props.organization) {
    form.value = {
      title: props.organization.title || '',
      description: props.organization.description || '',
      is_active: props.organization.is_active !== undefined ? props.organization.is_active : true,
      profile_image: null,
      cover_image: null
    };
  } else {
    form.value = {
      title: '',
      description: '',
      is_active: true,
      profile_image: null,
      cover_image: null
    };
  }
  errors.value = {};
  profileImagePreview.value = null;
  coverImagePreview.value = null;
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
  if (!props.organization) return;
  
  try {
    isLoading.value = true;
    errors.value = {};
    
    const updateData = {
      title: form.value.title,
      description: form.value.description,
      is_active: form.value.is_active
    };
    
    // Add images if they were changed
    if (form.value.profile_image) {
      updateData.profile_image = form.value.profile_image;
    }
    if (form.value.cover_image) {
      updateData.cover_image = form.value.cover_image;
    }
    
    const response = await organizationsStore.updateOrganization(props.organization.id, updateData);
    
    showNotification('Organización actualizada exitosamente', 'success');
    emit('updated', response.organization);
    
  } catch (error) {
    console.error('Error updating organization:', error);
    
    if (error.response?.data?.details) {
      errors.value = error.response.data.details;
    } else if (error.response?.data?.error) {
      showNotification(error.response.data.error, 'error');
    } else {
      showNotification('Error al actualizar la organización', 'error');
    }
  } finally {
    isLoading.value = false;
  }
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

watch(() => props.organization, (newValue) => {
  if (newValue && props.visible) {
    resetForm();
  }
});
</script>

