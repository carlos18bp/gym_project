<template>
  <div class="folders-grid">
    <!-- Folders Grid -->
    <div v-if="!isLoading && filteredFolders.length > 0" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      <FolderCard
        v-for="folder in filteredFolders"
        :key="folder.id"
        :folder="folder"
        @click="handleFolderClick"
        @edit="handleEditFolder"
        @delete="handleDeleteFolder"
        @add-documents="handleAddDocuments"
      />
    </div>

    <!-- Empty State -->
    <div v-else-if="!isLoading && sortedFolders.length === 0" class="text-center py-12">
      <FolderIcon class="w-16 h-16 text-gray-300 mx-auto mb-4" />
      <h3 class="text-lg font-medium text-gray-900 mb-2">No tienes carpetas aún</h3>
      <p class="text-gray-600 mb-6">Crea tu primera carpeta para organizar tus documentos</p>
      <button
        @click="handleCreateFolder"
        class="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
      >
        <PlusIcon class="w-5 h-5" />
        Crear Primera Carpeta
      </button>
    </div>

    <!-- No results state (when there are folders but search doesn't match) -->
    <div v-else-if="!isLoading && sortedFolders.length > 0 && filteredFolders.length === 0" class="text-center py-12">
      <FolderIcon class="w-16 h-16 text-gray-300 mx-auto mb-4" />
      <h3 class="text-lg font-medium text-gray-900 mb-2">No se encontraron carpetas</h3>
      <p class="text-gray-600">No hay carpetas que coincidan con tu búsqueda</p>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="flex justify-center items-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

// Icons
import { FolderIcon, PlusIcon } from '@heroicons/vue/24/outline';

// Components
import { FolderCard } from '@/components/dynamic_document/cards';

// Props
const props = defineProps({
  sortedFolders: {
    type: Array,
    required: true
  },
  searchQuery: {
    type: String,
    default: ''
  },
  isLoading: {
    type: Boolean,
    default: false
  }
});

// Emits
const emit = defineEmits([
  'folder-click',
  'edit-folder', 
  'delete-folder', 
  'add-documents',
  'create-folder'
]);

// Computed
const filteredFolders = computed(() => {
  if (!props.searchQuery.trim()) return props.sortedFolders;
  
  const query = props.searchQuery.toLowerCase();
  return props.sortedFolders.filter(folder => 
    folder.name.toLowerCase().includes(query)
  );
});

// Methods
const handleFolderClick = (folder) => {
  emit('folder-click', folder);
};

const handleEditFolder = (folder) => {
  emit('edit-folder', folder);
};

const handleDeleteFolder = (folder) => {
  emit('delete-folder', folder);
};

const handleAddDocuments = (folder) => {
  emit('add-documents', folder);
};

const handleCreateFolder = () => {
  emit('create-folder');
};
</script>

<style scoped>
.folders-grid {
  @apply w-full;
}
</style> 