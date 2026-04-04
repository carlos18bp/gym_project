<template>
  <ModalTransition v-show="isOpen">
    <div class="w-full h-full flex items-center justify-center p-4" @click.self="emit('close')">
      <div class="relative bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col">
        <!-- Header -->
        <div class="px-6 py-4 border-b border-gray-200">
          <h2 class="text-xl font-semibold text-gray-800">Agregar a Carpeta</h2>
          <p class="text-sm text-gray-500 mt-1">
            {{ document?.title || 'Documento' }}
          </p>
          <button
            @click="emit('close')"
            class="absolute top-4 right-4 text-gray-400 hover:text-gray-500 transition-colors"
          >
            <XMarkIcon class="h-6 w-6" />
          </button>
        </div>

        <!-- Body -->
        <div class="flex-grow overflow-y-auto">
          <!-- Loading -->
          <div v-if="folderStore.isLoading" class="flex items-center justify-center py-12">
            <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-secondary"></div>
          </div>

          <!-- Empty state -->
          <div v-else-if="folderStore.folders.length === 0" class="text-center py-12 px-6">
            <FolderIcon class="mx-auto h-12 w-12 text-gray-300" />
            <h3 class="mt-2 text-sm font-medium text-gray-900">No tienes carpetas</h3>
            <p class="mt-1 text-sm text-gray-500">
              Crea una carpeta desde la sección de Carpetas para organizar tus documentos.
            </p>
          </div>

          <!-- Folder list -->
          <ul v-else class="divide-y divide-gray-100">
            <li
              v-for="folder in folderStore.folders"
              :key="folder.id"
              @click="!alreadyInFolder(folder) && handleSelectFolder(folder)"
              :class="[
                'flex items-center gap-3 px-6 py-4 transition-colors',
                alreadyInFolder(folder)
                  ? 'opacity-60 cursor-not-allowed bg-gray-50'
                  : 'cursor-pointer hover:bg-gray-50',
                isAdding && selectedFolderId === folder.id ? 'opacity-60 pointer-events-none' : ''
              ]"
            >
              <!-- Folder icon with color -->
              <div
                class="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
                :style="getFolderIconStyle(folder)"
              >
                <FolderIcon class="h-5 w-5" :style="{ color: getFolderColor(folder).dark }" />
              </div>

              <!-- Folder name and doc count -->
              <div class="flex-grow min-w-0">
                <p class="text-sm font-medium text-gray-900 truncate">{{ folder.name }}</p>
                <p class="text-xs text-gray-500">
                  {{ folder.document_ids?.length || 0 }} documento{{ (folder.document_ids?.length || 0) !== 1 ? 's' : '' }}
                </p>
              </div>

              <!-- "Ya agregado" badge -->
              <span
                v-if="alreadyInFolder(folder)"
                class="flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700"
              >
                Ya agregado
              </span>

              <!-- Loading spinner for selected folder -->
              <div
                v-else-if="isAdding && selectedFolderId === folder.id"
                class="flex-shrink-0"
              >
                <div class="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-secondary"></div>
              </div>

              <!-- Arrow icon for available folders -->
              <ChevronRightIcon v-else class="flex-shrink-0 h-4 w-4 text-gray-400" />
            </li>
          </ul>
        </div>

        <!-- Footer -->
        <div class="px-6 py-4 border-t border-gray-100 flex justify-end">
          <button
            @click="emit('close')"
            class="px-4 py-2 text-sm font-medium rounded-md border border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  </ModalTransition>
</template>

<script setup>
import { ref, watch } from 'vue';
import ModalTransition from '@/components/layouts/animations/ModalTransition.vue';
import { useDocumentFolderStore } from '@/stores/dynamic_document/folders';
import { getColorById } from '@/shared/color_palette';
import { showNotification } from '@/shared/notification_message';
import {
  XMarkIcon,
  FolderIcon,
  ChevronRightIcon,
} from '@heroicons/vue/24/outline';

const props = defineProps({
  isOpen: { type: Boolean, required: true },
  document: { type: Object, default: null },
});

const emit = defineEmits(['close']);

const folderStore = useDocumentFolderStore();
const isAdding = ref(false);
const selectedFolderId = ref(null);

// Load folders when modal opens
watch(() => props.isOpen, (val) => {
  if (val) {
    folderStore.fetchFolders();
  }
});

const alreadyInFolder = (folder) => {
  return folder.document_ids?.includes(props.document?.id);
};

const getFolderColor = (folder) => {
  return getColorById(folder.color_id ?? 0);
};

const getFolderIconStyle = (folder) => {
  const color = getFolderColor(folder);
  return { backgroundColor: color.light };
};

const handleSelectFolder = async (folder) => {
  if (isAdding.value) return;
  isAdding.value = true;
  selectedFolderId.value = folder.id;
  try {
    await folderStore.addDocumentsToFolder(folder.id, [props.document.id]);
    await showNotification(`Documento agregado a "${folder.name}"`, 'success');
    emit('close');
  } catch (e) {
    console.error('Error adding document to folder:', e);
    await showNotification('Error al agregar el documento a la carpeta', 'error');
  } finally {
    isAdding.value = false;
    selectedFolderId.value = null;
  }
};
</script>
