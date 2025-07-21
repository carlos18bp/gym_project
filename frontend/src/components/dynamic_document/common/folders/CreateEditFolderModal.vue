<template>
  <ModalTransition v-if="isVisible">
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-xl shadow-xl max-w-md w-full">
        <div class="flex justify-between items-center p-6 border-b">
          <h3 class="text-lg font-semibold text-gray-900">
            {{ editingFolder ? 'Editar Carpeta' : 'Nueva Carpeta' }}
          </h3>
          <button @click="handleClose" class="text-gray-400 hover:text-gray-500">
            <XMarkIcon class="w-6 h-6" />
          </button>
        </div>

        <form @submit.prevent="handleSubmit" class="p-6">
          <!-- Folder Name -->
          <div class="mb-4">
            <label for="folderName" class="block text-sm font-medium text-gray-700 mb-2">
              Nombre de la carpeta
            </label>
            <input
              id="folderName"
              v-model="folderForm.name"
              type="text"
              required
              maxlength="100"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="Ej: Contratos Laborales"
            />
          </div>

          <!-- Color Selection -->
          <div class="mb-6">
            <label class="block text-sm font-medium text-gray-700 mb-3">
              Color de la carpeta
            </label>
            <div class="grid grid-cols-8 gap-2">
              <button
                v-for="color in availableColors"
                :key="color.id"
                type="button"
                @click="folderForm.color_id = color.id"
                :class="[
                  'w-8 h-8 rounded-full border-2 transition-all',
                  folderForm.color_id === color.id 
                    ? 'border-gray-800 scale-110' 
                    : 'border-gray-300 hover:border-gray-400'
                ]"
                :style="{ backgroundColor: color.hex }"
                :title="color.name"
              />
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="flex gap-3">
            <button
              type="button"
              @click="handleClose"
              class="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              :disabled="!folderForm.name.trim() || isSubmitting"
              class="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {{ isSubmitting ? 'Guardando...' : (editingFolder ? 'Actualizar' : 'Crear') }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </ModalTransition>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useDocumentFolderStore } from '@/stores/documentFolder';
import { getAllColors } from '@/shared/color_palette';
import { showNotification } from '@/shared/notification_message';

// Icons
import { XMarkIcon } from '@heroicons/vue/24/outline';

// Components
import ModalTransition from '@/components/layouts/animations/ModalTransition.vue';

// Props
const props = defineProps({
  isVisible: {
    type: Boolean,
    required: true
  },
  editingFolder: {
    type: Object,
    default: null
  }
});

// Emits
const emit = defineEmits(['close', 'success']);

// Store
const folderStore = useDocumentFolderStore();

// Reactive data
const isSubmitting = ref(false);
const folderForm = ref({
  name: '',
  color_id: 0
});

// Computed
const availableColors = computed(() => getAllColors());

// Methods - Declared before watchers to avoid initialization errors
const resetForm = () => {
  folderForm.value = {
    name: '',
    color_id: 0
  };
};

// Watch for editing folder changes
watch(() => props.editingFolder, (newFolder) => {
  if (newFolder) {
    folderForm.value = {
      name: newFolder.name,
      color_id: newFolder.color_id
    };
  } else {
    resetForm();
  }
}, { immediate: true });

// Watch for visibility changes
watch(() => props.isVisible, (isVisible) => {
  if (!isVisible) {
    resetForm();
  }
});

const handleClose = () => {
  emit('close');
};

const handleSubmit = async () => {
  if (!folderForm.value.name.trim()) return;
  
  isSubmitting.value = true;
  
  try {
    if (props.editingFolder) {
      await folderStore.updateFolder(props.editingFolder.id, folderForm.value);
      showNotification('Carpeta actualizada correctamente', 'success');
    } else {
      await folderStore.createFolder(folderForm.value);
      showNotification('Carpeta creada correctamente', 'success');
    }
    
    emit('success');
  } catch (error) {
    const action = props.editingFolder ? 'actualizar' : 'crear';
    showNotification(`Error al ${action} la carpeta`, 'error');
    console.error(`Error ${action} folder:`, error);
  } finally {
    isSubmitting.value = false;
  }
};
</script> 