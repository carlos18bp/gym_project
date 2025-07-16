<template>
  <div class="folder-management">
    <!-- Header with Create Folder Button -->
    <div class="flex justify-between items-center mb-6">
      <div>
        <h2 class="text-xl font-semibold text-gray-900">Mis Carpetas</h2>
        <p class="text-sm text-gray-600 mt-1">Organiza tus documentos, firmas y formatos en carpetas personalizadas</p>
      </div>
      <button
        @click="handleCreateFolder"
        class="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
      >
        <PlusIcon class="w-5 h-5" />
        Nueva Carpeta
      </button>
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

const handleCloseAddDocumentsModal = () => {
  showAddDocumentsModal.value = false;
  folderForDocuments.value = null;
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
    handleCloseAddDocumentsModal();
    showNotification(`${validSelectedIds.length} documento(s) agregado(s) a la carpeta`, 'success');
    
    // Emit event to navigate to main view
    emit('navigate-to-main');
    
    // Update the UI immediately with optimistic updates
    try {
      // First, update the folder store with fresh data
      await folderStore.fetchFolderById(folderForDocuments.value.id, true);
      
      // Get the updated folder from store
      const updatedFolder = folderStore.getFolderById(folderForDocuments.value.id);
      
      if (updatedFolder) {
        // Update the folderForDocuments to reflect new state
        folderForDocuments.value = updatedFolder;
        
        // Update selected folder if it's the same one that's open
        if (selectedFolder.value?.id === folderForDocuments.value.id) {
          selectedFolder.value = updatedFolder;
        }
      }
      
      console.log('Folder data refreshed successfully');
    } catch (refreshError) {
      console.warn('Error refreshing folder data:', refreshError);
      
      // If refresh fails, try optimistic update
      try {
        // Manually add the selected documents to the current folder display
        const documentsToAdd = validSelectedIds.map(id => {
          // Find the document in the available documents
          const allAvailableDocs = [
            ...documentStore.progressAndCompletedDocumentsByClient(currentUser.value?.id),
            ...documentStore.publishedDocumentsUnassigned,
            ...documentStore.pendingSignatureDocuments,
            ...documentStore.fullySignedDocuments
          ];
          return allAvailableDocs.find(doc => doc.id === id);
        }).filter(doc => doc != null);
        
        if (documentsToAdd.length > 0) {
          // Update folderForDocuments optimistically
          folderForDocuments.value = {
            ...folderForDocuments.value,
            documents: [...folderForDocuments.value.documents, ...documentsToAdd]
          };
          
          // Update selectedFolder if it's open
          if (selectedFolder.value?.id === folderForDocuments.value.id) {
            selectedFolder.value = {
              ...selectedFolder.value,
              documents: [...selectedFolder.value.documents, ...documentsToAdd]
            };
          }
          
          console.log('Applied optimistic update with', documentsToAdd.length, 'documents');
        }
      } catch (optimisticError) {
        console.warn('Optimistic update also failed:', optimisticError);
      }
    }
    
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