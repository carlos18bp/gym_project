<template>
  <!-- Document List -->
  <div v-if="filteredDocuments.length > 0" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
    <!-- Document Item -->
    <DocumentCard
      v-for="document in filteredDocuments"
      :key="document.id"
      :document="document"
      :card-type="'client'"
      :card-context="'list'"
      :highlighted-doc-id="highlightedDocId"
      :status-icon="document.state === 'Completed' ? CheckCircleIcon : PencilIcon"
      :status-text="document.state === 'Completed' ? 'Completado' : 'En Progreso'"
      :status-badge-classes="document.state === 'Completed' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-blue-100 text-blue-700 border border-blue-200'"
      :document-store="documentStore"
      :user-store="userStore"
      :prompt-documents="props.promptDocuments"
      :edit-modal-component="'UseDocumentByClient'"
      @click="handleDocumentClick"
      @refresh="handleRefresh"
    />
  </div>
    
    <!-- No documents message -->
    <div
      v-if="filteredDocuments.length === 0"
      class="mt-6 flex flex-col items-center justify-center text-center text-gray-500 w-full p-8 rounded-xl"
    >
      <p class="text-lg font-semibold mb-2">
        No hay documentos disponibles para mostrar.
      </p>
      <p class="text-sm">
        Contacta a tu abogado para gestionar tus documentos.
      </p>
    </div>

  <!-- Modal de previsualización -->
  <DocumentPreviewModal
    :isVisible="showPreviewModal"
    :documentData="previewDocumentData"
    @close="showPreviewModal = false"
  />
</template>

<script setup>
import {
  CheckCircleIcon,
  PencilIcon,
} from "@heroicons/vue/24/outline";
import { computed, ref, watch, onMounted } from "vue";
import { useDynamicDocumentStore } from "@/stores/dynamic_document";
import { useUserStore } from "@/stores/user";
import { showNotification } from "@/shared/notification_message";
import { DocumentCard } from "@/components/dynamic_document/cards";
import DocumentPreviewModal from "@/components/dynamic_document/common/DocumentPreviewModal.vue";

import {
  showPreviewModal,
  previewDocumentData,
  openPreviewModal,
} from "@/shared/document_utils";
import { useRecentViews } from '@/composables/useRecentViews';
import { get_request } from "@/stores/services/request_http";

// Store instances
const documentStore = useDynamicDocumentStore();
const userStore = useUserStore();
const { registerView } = useRecentViews();

// Reactive state
const currentUser = computed(() => userStore.getCurrentUser);
const documents = ref([]);
const isLoading = ref(false);

// Use userStore to get the signature
const signature = userStore.userSignature;

// Computed property that determines which document should be highlighted
// It first checks if the store's lastUpdatedDocumentId exists in filtered documents
// If not, tries to use the localStorage's lastUpdatedDocumentId
const highlightedDocId = computed(() => {
  // If we have prompt documents, don't show any highlight
  if (props.promptDocuments) {
    return null;
  }

  const storeId = documentStore.lastUpdatedDocumentId;
  const localId = localStorage.getItem('lastUpdatedDocumentId');
  
  // Verify if storeId exists in filtered documents
  const docExists = storeId && filteredDocuments.value.some(doc => String(doc.id) === String(storeId));
  
  if (docExists) {
    return storeId;
  } else if (localId) {
    // Verify if localStorage ID exists in filtered documents
    const localDocExists = filteredDocuments.value.some(doc => String(doc.id) === String(localId));
    return localDocExists ? localId : null;
  }
  
  return null;
});

const props = defineProps({
  searchQuery: String,
  selectedTags: {
    type: Array,
    default: () => []
  },
  promptDocuments: {
    type: Array,
    default: null
  }
});

// Initialize data when component mounts
onMounted(async () => {
  // Initialize stores
  await userStore.init();
  await documentStore.init();
  
  // If we have prompt documents, don't initialize highlights
  if (props.promptDocuments) {
    return;
  }

  // Ensure documents are loaded
  await documentStore.init();
  
  // Cargar documentos firmados
  await fetchDocuments();
  
  const savedId = localStorage.getItem('lastUpdatedDocumentId');
  
  if (savedId && !documentStore.lastUpdatedDocumentId) {
    documentStore.lastUpdatedDocumentId = savedId;
  }
  
  // Check if the ID exists in our document list
  if (documentStore.lastUpdatedDocumentId) {
    const exists = filteredDocuments.value.some(doc => String(doc.id) === String(documentStore.lastUpdatedDocumentId));
  }
});

// Watch for changes in lastUpdatedDocumentId
watch(() => documentStore.lastUpdatedDocumentId, (newId) => {
  // If we have prompt documents, don't update highlights
  if (props.promptDocuments) {
    return;
  }

  if (newId) {
    localStorage.setItem('lastUpdatedDocumentId', newId);
  }
});

// Retrieve documents in progress and completed from the store, applying the search filter.
const filteredDocuments = computed(() => {  
  // If there are documents from the prompt, apply the same filter used with normal documents
  if (props.promptDocuments) {
    // Apply the same filtering logic to promptDocuments
    const clientId = currentUser.value?.id;
    
    // Filter prompt documents to only include progress and completed for this client
    let filteredPromptDocs = props.promptDocuments.filter(doc => {
      const docClientId = doc.assigned_to ? String(doc.assigned_to) : null;
      const queryClientId = String(clientId);
      
      return docClientId === queryClientId && 
             (doc.state === "Progress" || doc.state === "Completed");
    });
    
    // Apply search filter if it exists
    if (props.searchQuery) {
      const lowerQuery = props.searchQuery.toLowerCase();
      filteredPromptDocs = filteredPromptDocs.filter(doc => {
        return (
          doc.title.toLowerCase().includes(lowerQuery) ||
          doc.state.toLowerCase().includes(lowerQuery) ||
          (doc.assigned_to &&
            userStore &&
            (userStore.userById(doc.assigned_to)?.first_name?.toLowerCase().includes(lowerQuery) ||
             userStore.userById(doc.assigned_to)?.last_name?.toLowerCase().includes(lowerQuery) ||
             userStore.userById(doc.assigned_to)?.email?.toLowerCase().includes(lowerQuery) ||
             userStore.userById(doc.assigned_to)?.identification?.toLowerCase().includes(lowerQuery)))
        );
      });
    }
    
    // Apply tag filter if tags are selected
    if (props.selectedTags && props.selectedTags.length > 0) {
      const selectedTagIds = props.selectedTags.map(tag => tag.id);
      filteredPromptDocs = filteredPromptDocs.filter(doc => {
        if (!doc.tags || doc.tags.length === 0) return false;
        return doc.tags.some(tag => selectedTagIds.includes(tag.id));
      });
    }
    
    return filteredPromptDocs;
  }

  // If there's no prompt, use normal logic
  // First, get all progress and completed documents for this client
  const allProgressAndCompletedDocs =
    documentStore.progressAndCompletedDocumentsByClient(currentUser.value?.id);
  
  // Get selected tag IDs
  const selectedTagIds = props.selectedTags ? props.selectedTags.map(tag => tag.id) : [];
  
  // Then apply both search and tag filters
  const searchAndTagFiltered = documentStore.filteredDocumentsBySearchAndTags(
    props.searchQuery, 
    userStore, 
    selectedTagIds
  );
  
  // Finally, find intersection between both sets
  const result = searchAndTagFiltered.filter((doc) =>
    allProgressAndCompletedDocs.some(
      (progressOrCompletedDoc) => String(progressOrCompletedDoc.id) === String(doc.id)
    )
  );
  
  return result;
});

/**
 * Fetches documents for the current user
 */
const fetchDocuments = async () => {
  isLoading.value = true;
  try {
    const userId = userStore.currentUser.id;
    if (!userId) return;

    const response = await get_request(`dynamic-documents/user/${userId}/pending-documents-full/`);
    documents.value = response.data;
  } catch (error) {
    console.error('Error fetching documents:', error);
    if (error.response) {
      console.error('Error details:', error.response.data);
    }
    await showNotification('Error al cargar documentos', 'error');
    documents.value = [];
  } finally {
    isLoading.value = false;
  }
};

/**
 * Handle document click - registers view and opens preview
 */
const handleDocumentClick = async (document) => {
  await registerView('document', document.id);
  openPreviewModal(document);
};

// Make sure highlighted document ID is updated when filtered documents change
watch(filteredDocuments, (newDocs) => {
  // If we have prompt documents, don't update highlights
  if (props.promptDocuments) {
    return;
  }

  // If we have a lastUpdatedDocumentId, verify it exists in the list
  if (documentStore.lastUpdatedDocumentId) {
    const exists = newDocs.some(doc => String(doc.id) === String(documentStore.lastUpdatedDocumentId));
    
    // If not found but we have documents, use the newest one
    if (!exists && newDocs.length > 0) {
      // Sort by ID to get newest document
      const sortedDocs = [...newDocs].sort((a, b) => b.id - a.id);
      const newId = sortedDocs[0].id;
      
      documentStore.lastUpdatedDocumentId = newId;
      localStorage.setItem('lastUpdatedDocumentId', newId);
    }
  }
});

/**
 * Function to force highlight a specific document
 * Directly manipulates DOM to apply visual effects
 * @param {string|number} documentId - ID of the document to highlight
 */
const forceHighlight = (documentId) => {
  if (!documentId) return;
  
  // Update lastUpdatedDocumentId in the store
  documentStore.lastUpdatedDocumentId = documentId;
  localStorage.setItem('lastUpdatedDocumentId', documentId);
  
  // Find the actual DOM element using data-document-id
  setTimeout(() => {
    try {
      // Find the element by attribute selector
      const documentElements = document.querySelectorAll(`[data-document-id="${documentId}"]`);
      
      if (documentElements.length > 0) {
        const element = documentElements[0];
        
        // Apply styles directly
        element.style.border = "3px solid #3b82f6";
        
        // Remove and re-add classes to restart animation
        element.classList.remove("animate-pulse-highlight");
        element.classList.remove("border-secondary");
        element.classList.remove("shadow-md");
        
        // Force a reflow before adding the class again
        void element.offsetWidth;
        
        // Add the classes again
        element.classList.add("animate-pulse-highlight");
        element.classList.add("border-secondary");
        element.classList.add("shadow-md");
        
        // Ensure visibility
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    } catch (error) {
      console.error("Error forcing highlight:", error);
    }
  }, 100);
};

// Expose the forceHighlight function globally for use by other components
window.forceDocumentHighlight = forceHighlight;

/**
 * Refreshes the document data after an action (like signing).
 */
const handleRefresh = async () => {
  // Reload documents using the store
  await documentStore.init(true);
};
</script>

<style scoped>
@keyframes pulse-highlight {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.6);
    border-color: rgba(59, 130, 246, 0.8);
    transform: scale(1);
  }
  50% {
    box-shadow: 0 0 10px 5px rgba(59, 130, 246, 0.4);
    border-color: rgba(59, 130, 246, 0.8);
    background-color: rgba(59, 130, 246, 0.1);
    transform: scale(1.02);
  }
}

.animate-pulse-highlight {
  animation: pulse-highlight 1s ease-in-out 3;
  border-width: 2px !important;
  position: relative;
  z-index: 10;
}
</style>
