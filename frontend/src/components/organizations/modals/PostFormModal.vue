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
                    {{ isEditing ? 'Editar Post' : 'Crear Nuevo Post' }}
                  </DialogTitle>
                  <p class="mt-1 text-sm text-gray-500">
                    {{ isEditing ? 'Modifica la información del post' : 'Comparte información importante con los miembros' }}
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
              <div v-if="isSubmitting" class="flex justify-center items-center py-8">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span class="ml-2 text-gray-600">{{ isEditing ? 'Actualizando...' : 'Creando...' }}</span>
              </div>

              <!-- Form Content -->
              <form v-else @submit.prevent="handleSubmit" class="space-y-6">
                <!-- Title -->
                <div>
                  <label for="title" class="block text-sm font-medium leading-6 text-gray-900">
                    Título *
                  </label>
                  <div class="mt-2">
                    <input
                      id="title"
                      v-model="form.title"
                      type="text"
                      required
                      class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                      placeholder="Ej: Anuncio importante sobre nuevas políticas"
                    />
                  </div>
                  <p v-if="errors.title" class="mt-1 text-sm text-red-600">{{ errors.title[0] }}</p>
                </div>

                <!-- Content -->
                <div>
                  <label for="content" class="block text-sm font-medium leading-6 text-gray-900">
                    Contenido *
                  </label>
                  <div class="mt-2">
                    <textarea
                      id="content"
                      v-model="form.content"
                      rows="5"
                      required
                      class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                      placeholder="Escribe el contenido del post..."
                    ></textarea>
                  </div>
                  <p class="mt-1 text-xs text-gray-500">
                    Proporciona información clara y útil para los miembros de la organización
                  </p>
                  <p v-if="errors.content" class="mt-1 text-sm text-red-600">{{ errors.content[0] }}</p>
                </div>

                <!-- Link Section -->
                <div class="border-t border-gray-200 pt-6">
                  <div class="flex items-center justify-between mb-4">
                    <h4 class="text-md font-medium text-gray-900">Enlace Opcional</h4>
                    <button
                      type="button"
                      @click="showLinkSection = !showLinkSection"
                      class="text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      {{ showLinkSection ? 'Ocultar enlace' : 'Agregar enlace' }}
                    </button>
                  </div>

                  <div v-if="showLinkSection" class="space-y-4">
                    <!-- Link Name -->
                    <div>
                      <label for="link_name" class="block text-sm font-medium leading-6 text-gray-900">
                        Texto del Enlace
                      </label>
                      <div class="mt-2">
                        <input
                          id="link_name"
                          v-model="form.link_name"
                          type="text"
                          class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                          placeholder="Ej: Ver documento completo"
                        />
                      </div>
                      <p v-if="errors.link_name" class="mt-1 text-sm text-red-600">{{ errors.link_name[0] }}</p>
                    </div>

                    <!-- Link URL -->
                    <div>
                      <label for="link_url" class="block text-sm font-medium leading-6 text-gray-900">
                        URL del Enlace
                      </label>
                      <div class="mt-2">
                        <input
                          id="link_url"
                          v-model="form.link_url"
                          type="url"
                          class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                          placeholder="https://ejemplo.com/documento"
                        />
                      </div>
                      <p class="mt-1 text-xs text-gray-500">
                        Debe incluir http:// o https://
                      </p>
                      <p v-if="errors.link_url" class="mt-1 text-sm text-red-600">{{ errors.link_url[0] }}</p>
                    </div>

                    <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <p class="text-sm text-yellow-800">
                        <strong>Nota:</strong> Si agregas un enlace, tanto el texto como la URL son obligatorios.
                      </p>
                    </div>
                  </div>
                </div>

                <!-- Options -->
                <div class="border-t border-gray-200 pt-6">
                  <h4 class="text-md font-medium text-gray-900 mb-4">Opciones</h4>
                  
                  <div class="space-y-3">
                    <!-- Is Pinned -->
                    <div class="flex items-center">
                      <input
                        id="is_pinned"
                        v-model="form.is_pinned"
                        type="checkbox"
                        class="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                      <label for="is_pinned" class="ml-2 text-sm text-gray-700">
                        Fijar post (aparecerá en la parte superior)
                      </label>
                    </div>

                    <!-- Is Active (only for editing) -->
                    <div v-if="isEditing" class="flex items-center">
                      <input
                        id="is_active"
                        v-model="form.is_active"
                        type="checkbox"
                        class="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                      <label for="is_active" class="ml-2 text-sm text-gray-700">
                        Post activo (visible para los miembros)
                      </label>
                    </div>
                  </div>
                </div>

                <!-- Preview Section -->
                <div v-if="form.title || form.content" class="border-t border-gray-200 pt-6">
                  <h4 class="text-md font-medium text-gray-900 mb-4">Vista Previa</h4>
                  
                  <!-- Post Preview -->
                  <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div class="flex items-center space-x-2 mb-2">
                      <h5 class="text-lg font-semibold text-gray-900">
                        {{ form.title || 'Título del post' }}
                      </h5>
                      <span v-if="form.is_pinned" class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                        Fijado
                      </span>
                    </div>
                    <p class="text-gray-700 whitespace-pre-wrap mb-3">
                      {{ form.content || 'Contenido del post...' }}
                    </p>
                    <div v-if="form.link_name && form.link_url" class="inline-flex items-center px-3 py-2 border border-blue-300 text-sm font-medium rounded-md text-blue-700 bg-blue-50">
                      {{ form.link_name }}
                      <ArrowTopRightOnSquareIcon class="h-3 w-3 ml-1" />
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
                    :disabled="isSubmitting || !isFormValid"
                    class="inline-flex justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div v-if="isSubmitting" class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    <DocumentIcon v-else class="h-4 w-4 mr-2" />
                    {{ isSubmitting ? (isEditing ? 'Actualizando...' : 'Creando...') : (isEditing ? 'Actualizar Post' : 'Crear Post') }}
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
  DocumentIcon,
  ArrowTopRightOnSquareIcon
} from '@heroicons/vue/24/outline';
import { useOrganizationPostsStore } from '@/stores/organization_posts';
import { showNotification } from '@/shared/notification_message';

// Props
const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  post: {
    type: Object,
    default: null
  },
  organizationId: {
    type: Number,
    required: true
  }
});

// Emits
const emit = defineEmits(['close', 'saved']);

// Store
const postsStore = useOrganizationPostsStore();

// Reactive state
const isSubmitting = ref(false);
const errors = ref({});
const showLinkSection = ref(false);

const form = ref({
  title: '',
  content: '',
  link_name: '',
  link_url: '',
  is_pinned: false,
  is_active: true
});

// Computed properties
const isEditing = computed(() => !!props.post);

const isFormValid = computed(() => {
  const hasTitle = form.value.title.trim();
  const hasContent = form.value.content.trim();
  const hasValidLink = (!form.value.link_name && !form.value.link_url) || 
                      (form.value.link_name.trim() && form.value.link_url.trim());
  
  return hasTitle && hasContent && hasValidLink;
});

// Methods
const resetForm = () => {
  if (props.post) {
    // Editing - populate with existing data
    form.value = {
      title: props.post.title || '',
      content: props.post.content || '',
      link_name: props.post.link_name || '',
      link_url: props.post.link_url || '',
      is_pinned: props.post.is_pinned || false,
      is_active: props.post.is_active !== undefined ? props.post.is_active : true
    };
    showLinkSection.value = !!(props.post.link_name || props.post.link_url);
  } else {
    // Creating - reset to defaults
    form.value = {
      title: '',
      content: '',
      link_name: '',
      link_url: '',
      is_pinned: false,
      is_active: true
    };
    showLinkSection.value = false;
  }
  errors.value = {};
};

const handleSubmit = async () => {
  try {
    isSubmitting.value = true;
    errors.value = {};
    
    // Validate link fields
    const hasLinkName = form.value.link_name.trim();
    const hasLinkUrl = form.value.link_url.trim();
    
    if ((hasLinkName && !hasLinkUrl) || (!hasLinkName && hasLinkUrl)) {
      showNotification('Si agregas un enlace, tanto el texto como la URL son obligatorios', 'warning');
      return;
    }
    
    const postData = {
      title: form.value.title.trim(),
      content: form.value.content.trim(),
      is_pinned: form.value.is_pinned
    };
    
    // Add link data if both fields are provided
    if (hasLinkName && hasLinkUrl) {
      postData.link_name = form.value.link_name.trim();
      postData.link_url = form.value.link_url.trim();
    }
    
    // Add is_active only for editing
    if (isEditing.value) {
      postData.is_active = form.value.is_active;
    }
    
    let response;
    if (isEditing.value) {
      response = await postsStore.updatePost(props.organizationId, props.post.id, postData);
      showNotification('Post actualizado exitosamente', 'success');
    } else {
      response = await postsStore.createPost(props.organizationId, postData);
      showNotification('Post creado exitosamente', 'success');
    }
    
    emit('saved', response);
    
  } catch (error) {
    console.error('Error saving post:', error);
    
    if (error.response?.data?.details) {
      errors.value = error.response.data.details;
    } else if (error.response?.data?.error) {
      showNotification(error.response.data.error, 'error');
    } else {
      showNotification(`Error al ${isEditing.value ? 'actualizar' : 'crear'} el post`, 'error');
    }
  } finally {
    isSubmitting.value = false;
  }
};

const handleClose = () => {
  if (!isSubmitting.value) {
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

watch(() => props.post, () => {
  if (props.visible) {
    resetForm();
  }
});
</script>

