<template>
  <div class="folder-management">
    <!-- Header with Create Folder Button - Responsive -->
    <div class="mb-6">
      <!-- Desktop Layout -->
      <div class="hidden sm:flex justify-between items-center">
        <div>
          <h2 class="text-xl font-semibold text-gray-900">Mis Carpetas</h2>
          <p class="text-sm text-gray-600 mt-1">Organiza tus documentos, firmas y formatos en carpetas personalizadas</p>
        </div>
        <button
          @click="handleCreateFolder"
          class="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all duration-200 shadow-sm hover:shadow-md"
        >
          <PlusIcon class="w-5 h-5" />
          Nueva Carpeta
        </button>
      </div>

      <!-- Mobile Layout -->
      <div class="sm:hidden">
        <div class="text-center mb-4">
          <h2 class="text-xl font-semibold text-gray-900">Mis Carpetas</h2>
          <p class="text-sm text-gray-600 mt-1 px-2">Organiza tus documentos, firmas y formatos en carpetas personalizadas</p>
        </div>
        <button
          @click="handleCreateFolder"
          class="w-full flex items-center justify-center gap-3 px-4 py-4 bg-primary text-white rounded-xl hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all duration-200 shadow-sm hover:shadow-md font-medium text-base"
        >
          <PlusIcon class="w-6 h-6" />
          Nueva Carpeta
        </button>
      </div>
    </div>

    <!-- Folders Grid Component -->
    <FoldersGrid
      :sorted-folders="sortedFolders"
      :search-query="searchQuery"
      :is-loading="isLoading"
      @folder-click="handleOpenFolderDetails"
      @edit-folder="handleEditFolder"
      @delete-folder="handleDeleteFolder"
      @add-documents="handleOpenAddDocumentsModal"
      @create-folder="handleCreateFolder"
    />

    <!-- Create/Edit Folder Modal -->
    <CreateEditFolderModal
      :is-visible="showCreateFolderModal"
      :editing-folder="editingFolder"
      @close="handleCloseCreateEditModal"
      @success="handleFolderSaved"
    />

    <!-- Folder Details Modal -->
    <FolderDetailsModal
      :folder="selectedFolder"
      @close="handleCloseFolderDetails"
      @add-documents="handleOpenAddDocumentsModal"
      @remove-document="handleRemoveDocumentFromFolder"
      @view-document="handleViewDocument"
      @use-document="handleUseDocument"
      @document-action="handleDocumentAction"
    />

    <!-- Add Documents Modal -->
    <AddDocumentsModal
      :is-visible="showAddDocumentsModal"
      :folder="folderForDocuments"
      @close="handleCloseAddDocumentsModal"
      @add-documents="handleAddSelectedDocumentsToFolder"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useDocumentFolderStore } from '@/stores/documentFolder';
import { useDynamicDocumentStore } from '@/stores/dynamicDocument';
import { useUserStore } from '@/stores/user';
import { showNotification } from '@/shared/notification_message';

// Icons
import { PlusIcon } from '@heroicons/vue/24/outline';

// Components
import {
  CreateEditFolderModal,
  FolderDetailsModal,
  AddDocumentsModal,
  FoldersGrid
} from './index.js';

// Props
const props = defineProps({
  searchQuery: {
    type: String,
    default: ''
  },
  selectedTags: {
    type: Array,
    default: () => []
  }
});

// Emits
const emit = defineEmits(['refresh', 'navigate-to-main']);

// Stores
const folderStore = useDocumentFolderStore();
const documentStore = useDynamicDocumentStore();
const userStore = useUserStore();

// Reactive data
const showCreateFolderModal = ref(false);
const editingFolder = ref(null);
const selectedFolder = ref(null);
const showAddDocumentsModal = ref(false);
const folderForDocuments = ref(null);

// Computed properties
const isLoading = computed(() => folderStore.isLoading);
const sortedFolders = computed(() => folderStore.sortedFolders);
const currentUser = computed(() => userStore.currentUser);

// Initialize data
onMounted(async () => {
  await folderStore.init();
  await documentStore.init();
});

// Watch for refresh events
watch(() => props.searchQuery, () => {
  // Could implement real-time search here if needed
});

// Watch for folder store updates to sync selectedFolder
watch(() => folderStore.folders, (newFolders) => {
  // If there's a selectedFolder, update it with fresh data from store
  if (selectedFolder.value && newFolders && newFolders.length > 0) {
    const updatedFolder = newFolders.find(folder => folder.id === selectedFolder.value.id);
    if (updatedFolder) {
      const oldCount = selectedFolder.value.documents?.length || 0;
      const newCount = updatedFolder.documents?.length || 0;
      
      // Only update if there's actually a change to avoid unnecessary re-renders
      if (JSON.stringify(selectedFolder.value) !== JSON.stringify(updatedFolder)) {
        selectedFolder.value = { ...updatedFolder };
        console.log(`🔄 FolderManagement: Synced selectedFolder "${updatedFolder.name}" with store. Documents: ${oldCount} → ${newCount}`);
      }
    }
  }
}, { deep: true });

// Create/Edit Folder Modal Handlers
const handleCreateFolder = () => {
  editingFolder.value = null;
  showCreateFolderModal.value = true;
};

const handleEditFolder = (folder) => {
  editingFolder.value = folder;
  showCreateFolderModal.value = true;
};

const handleCloseCreateEditModal = () => {
  showCreateFolderModal.value = false;
  editingFolder.value = null;
};

const handleFolderSaved = () => {
  handleCloseCreateEditModal();
};

// Folder Details Modal Handlers
const handleOpenFolderDetails = (folder) => {
  selectedFolder.value = folder;
};

const handleCloseFolderDetails = () => {
  selectedFolder.value = null;
};

// Delete Folder Handler
const handleDeleteFolder = async (folder) => {
  if (confirm(`¿Estás seguro de que quieres eliminar la carpeta "${folder.name}"?`)) {
    try {
      await folderStore.deleteFolder(folder.id);
      showNotification(`Carpeta "${folder.name}" eliminada correctamente`, 'success');
    } catch (error) {
      showNotification('Error al eliminar la carpeta', 'error');
      console.error('Error deleting folder:', error);
    }
  }
};

// Add Documents Modal Handlers
const handleOpenAddDocumentsModal = (folder) => {
  folderForDocuments.value = folder;
  showAddDocumentsModal.value = true;
};

const handleCloseAddDocumentsModal = async (documentsAdded = false) => {
  showAddDocumentsModal.value = false;
  folderForDocuments.value = null;
  
  // If documents were added, refresh the selected folder
  if (documentsAdded && selectedFolder.value) {
    try {
      await refreshSelectedFolder();
    } catch (error) {
      console.warn('Error refreshing folder after adding documents:', error);
    }
  }
};

/**
 * Refresh the currently selected folder data
 */
const refreshSelectedFolder = async () => {
  if (!selectedFolder.value) return;
  
  try {
    // Fetch fresh data from backend
    await folderStore.fetchFolderById(selectedFolder.value.id, true);
    
    // Get updated folder from store
    const updatedFolder = folderStore.getFolderById(selectedFolder.value.id);
    
    if (updatedFolder) {
      // Force reactivity by replacing the entire object
      selectedFolder.value = { ...updatedFolder };
      console.log('✅ Selected folder refreshed successfully');
    }
  } catch (error) {
    console.error('❌ Error refreshing selected folder:', error);
    throw error;
  }
};

const handleAddSelectedDocumentsToFolder = async (selectedDocumentIds) => {
  if (!folderForDocuments.value || selectedDocumentIds.length === 0) return;
  
  try {
    // Get current document IDs in folder - ensure they are valid integers
    const currentDocumentIds = folderForDocuments.value.documents
      .map(doc => doc.id)
      .filter(id => id != null && !isNaN(parseInt(id)))
      .map(id => parseInt(id));
    
    // Validate selected document IDs - ensure they are valid integers
    const validSelectedIds = selectedDocumentIds
      .filter(id => id != null && !isNaN(parseInt(id)))
      .map(id => parseInt(id));
    
    // Combine with selected documents (remove duplicates)
    const updatedDocumentIds = [...new Set([...currentDocumentIds, ...validSelectedIds])];
    
    // Debug information
    console.log('Current document IDs:', currentDocumentIds);
    console.log('Selected document IDs:', validSelectedIds);
    console.log('Updated document IDs:', updatedDocumentIds);
    
    // Validate that all IDs are positive integers
    if (updatedDocumentIds.some(id => !Number.isInteger(id) || id <= 0)) {
      throw new Error('IDs de documentos inválidos detectados');
    }
    
    // Update folder with new document IDs
    await folderStore.updateFolder(folderForDocuments.value.id, {
      document_ids: updatedDocumentIds
    });
    
    // Close modal and show success message immediately after successful update
    await handleCloseAddDocumentsModal(true); // true = documents were added
    showNotification(`${validSelectedIds.length} documento(s) agregado(s) a la carpeta`, 'success');
    
    // Emit event to navigate to main view
    emit('navigate-to-main');
    
  } catch (error) {
    console.error('Error adding documents to folder:', error);
    console.error('Error details:', error.response?.data || error.message);
    
    // Only show error if the main update operation failed
    if (error.response?.status) {
      showNotification(`Error al agregar documentos: ${error.response.data?.detail || error.message}`, 'error');
    } else {
      showNotification('Error al agregar documentos a la carpeta', 'error');
    }
  }
};

// Document Management Handlers
const handleRemoveDocumentFromFolder = async (documentId) => {
  if (!selectedFolder.value) return;
  
  try {
    // Validate and parse document ID
    const docIdToRemove = parseInt(documentId);
    if (!Number.isInteger(docIdToRemove) || docIdToRemove <= 0) {
      throw new Error('ID de documento inválido');
    }
    
    // Get current document IDs except the one to remove - ensure they are valid integers
    const updatedDocumentIds = selectedFolder.value.documents
      .map(doc => doc.id)
      .filter(id => id != null && !isNaN(parseInt(id)))
      .map(id => parseInt(id))
      .filter(id => id !== docIdToRemove);
    
    // Debug information
    console.log('Removing document ID:', docIdToRemove);
    console.log('Updated document IDs after removal:', updatedDocumentIds);
    
    // Update folder with new document IDs
    await folderStore.updateFolder(selectedFolder.value.id, {
      document_ids: updatedDocumentIds
    });
    
    // Show success message immediately after successful update
    showNotification('Documento removido de la carpeta', 'success');
    
    // Close the folder details modal and navigate to main view
    selectedFolder.value = null;
    emit('navigate-to-main');
    
    // Update the UI immediately
    try {
      // First, update the folder store with fresh data
      await folderStore.fetchFolderById(selectedFolder.value.id, true);
      
      // Get the updated folder from store
      const updatedFolder = folderStore.getFolderById(selectedFolder.value.id);
      if (updatedFolder) {
        selectedFolder.value = updatedFolder;
      }
      
      console.log('Folder data refreshed successfully after removal');
    } catch (refreshError) {
      console.warn('Error refreshing folder data:', refreshError);
      
      // If refresh fails, apply optimistic update
      try {
        // Remove the document from the current selectedFolder display
        selectedFolder.value = {
          ...selectedFolder.value,
          documents: selectedFolder.value.documents.filter(doc => doc.id !== docIdToRemove)
        };
        
        console.log('Applied optimistic removal for document ID:', docIdToRemove);
      } catch (optimisticError) {
        console.warn('Optimistic update failed:', optimisticError);
      }
    }
    
  } catch (error) {
    console.error('Error removing document from folder:', error);
    console.error('Error details:', error.response?.data || error.message);
    
    // Only show error if the main update operation failed
    if (error.response?.status) {
      showNotification(`Error al remover documento: ${error.response.data?.detail || error.message}`, 'error');
    } else {
      showNotification('Error al remover el documento de la carpeta', 'error');
    }
  }
};

// Document Action Handlers
const handleViewDocument = (document) => {
  // Handle document viewing - could emit an event or navigate
  console.log('View document:', document);
};

const handleUseDocument = (document) => {
  // Handle using a document format
  console.log('Use document:', document);
};

const handleDocumentAction = (action, document) => {
  // Handle various document actions (download, edit, etc.)
  console.log('Document action:', action, document);
};
</script>

<style scoped>
.folder-management {
  @apply w-full;
}
</style> 