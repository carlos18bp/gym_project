<template>
  <!-- Document List -->
  <div v-if="filteredDocuments.length > 0" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
    <!-- Document Item -->
    <div
      v-for="document in filteredDocuments"
      :key="document.id"
      :data-document-id="document.id"
      class="relative bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 p-4 cursor-pointer focus:outline-none focus:ring-0 focus:border-gray-200"
      :class="{
        'border-green-400 bg-green-50/50 shadow-green-100': document.state === 'Completed',
        'border-blue-300 bg-blue-50/30 shadow-blue-100': document.state === 'Progress',
        'shadow-lg animate-pulse-highlight': String(document.id) === String(highlightedDocId),
      }"
      @click="(e) => {
        // Only trigger preview if click was not on the menu
        if (!e.target.closest('.menu-container')) {
          handlePreviewDocument(document);
        }
      }"
    >
        <!-- Header with status and menu -->
        <div class="flex justify-between items-start mb-3">
          <div class="flex items-center gap-2">
            <!-- Status Badge -->
            <div 
              class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
              :class="{
                'bg-green-100 text-green-700 border border-green-200': document.state === 'Completed',
                'bg-blue-100 text-blue-700 border border-blue-200': document.state === 'Progress',
              }"
            >
              <component
                :is="document.state === 'Completed' ? CheckCircleIcon : PencilIcon"
                class="w-3.5 h-3.5"
              />
              <span>{{ document.state === 'Completed' ? 'Completado' : 'En Progreso' }}</span>
            </div>
          </div>
          
          <!-- Menu -->
          <Menu as="div" class="relative inline-block text-left menu-container">
            <MenuButton class="flex items-center justify-center w-8 h-8 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors focus:outline-none focus:ring-0 focus:border-none">
              <EllipsisVerticalIcon class="w-5 h-5" aria-hidden="true" />
            </MenuButton>
            <transition
              enter-active-class="transition ease-out duration-100"
              enter-from-class="transform opacity-0 scale-95"
              enter-to-class="transform opacity-100 scale-100"
              leave-active-class="transition ease-in duration-75"
              leave-from-class="transform opacity-100 scale-100"
              leave-to-class="transform opacity-0 scale-95"
            >
              <MenuItems
                class="absolute z-10 mt-2 w-56 rounded-md bg-white shadow-lg ring-1 ring-black/5 focus:outline-none focus:ring-0"
                :class="[
                  props.promptDocuments ? 'right-auto left-0 -translate-x-[calc(100%-24px)]' : 'right-0 left-auto'
                ]"
              >
                <div class="py-1">
                  <!-- Edit/Complete option -->
                  <MenuItem>
                    <button
                      class="block w-full text-left px-4 py-2 text-sm font-regular hover:bg-gray-100 transition focus:outline-none focus:ring-0 focus:border-none"
                      @click="openEditModal(document)"
                    >
                      {{ document.state === "Completed" ? "Editar" : "Completar" }}
                    </button>
                  </MenuItem>
    
                  <!-- Preview option -->
                  <MenuItem v-if="document.state === 'Completed'">
                    <button
                      class="block w-full text-left px-4 py-2 text-sm font-regular hover:bg-gray-100 transition focus:outline-none focus:ring-0 focus:border-none"
                      @click="handlePreviewDocument(document)"
                    >
                      Previsualizar
                    </button>
                  </MenuItem>
    
                  <!-- Delete option -->
                  <MenuItem>
                    <button
                      class="block w-full text-left px-4 py-2 text-sm font-regular hover:bg-gray-100 transition focus:outline-none focus:ring-0 focus:border-none"
                      @click="deleteDocument(document)"
                    >
                      Eliminar
                    </button>
                  </MenuItem>
    
                  <!-- Options only for Completed state -->
                  <template v-if="document.state === 'Completed'">
                    <MenuItem>
                      <button
                        class="block w-full text-left px-4 py-2 text-sm font-regular hover:bg-gray-100 transition focus:outline-none focus:ring-0 focus:border-none"
                        @click="downloadPDFDocument(document)"
                      >
                        Descargar PDF
                      </button>
                    </MenuItem>
                    <MenuItem>
                      <button
                        class="block w-full text-left px-4 py-2 text-sm font-regular hover:bg-gray-100 transition focus:outline-none focus:ring-0 focus:border-none"
                        @click="downloadWordDocument(document)"
                      >
                        Descargar Word
                      </button>
                    </MenuItem>                    
                    <MenuItem>
                      <button
                        class="block w-full text-left px-4 py-2 text-sm font-regular hover:bg-gray-100 transition focus:outline-none focus:ring-0 focus:border-none"
                        @click="openEmailModal(document)"
                      >
                        Enviar
                      </button>
                    </MenuItem>
                  </template>
                </div>
              </MenuItems>
            </transition>
          </Menu>
        </div>

        <!-- Document Content -->
        <div class="space-y-2">
          <!-- Title -->
          <h3 class="text-lg font-semibold text-gray-900 leading-tight">
            {{ document.title }}
          </h3>
          
          <!-- Description -->
          <p v-if="document.description" class="text-sm text-gray-600 leading-relaxed">
            {{ document.description }}
          </p>
          
          <!-- Tags Section -->
          <div v-if="document.tags && document.tags.length > 0" class="pt-2">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-xs font-medium text-gray-500">Etiquetas:</span>
              <div class="flex items-center gap-1.5">
                <div 
                  v-for="tag in document.tags" 
                  :key="tag.id"
                  class="group relative"
                >
                  <div 
                    class="w-5 h-5 rounded-full cursor-pointer transition-all duration-200 hover:scale-110 hover:ring-2 hover:ring-offset-1 shadow-sm"
                    :style="{ 
                      backgroundColor: getColorById(tag.color_id)?.hex || '#9CA3AF',
                      boxShadow: `0 0 0 1px ${getColorById(tag.color_id)?.dark || '#6B7280'}40`
                    }"
                    :title="tag.name"
                  ></div>
                  
                  <!-- Tooltip -->
                  <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-50">
                    <div class="bg-gray-900 text-white text-xs rounded-lg py-1.5 px-2.5 whitespace-nowrap shadow-lg">
                      {{ tag.name }}
                      <div class="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[4px] border-r-[4px] border-t-[4px] border-transparent border-t-gray-900"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
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

    <!-- Edit Document Modal -->
    <ModalTransition v-show="showEditDocumentModal">
      <UseDocumentByClient
        :document-id="selectedDocumentId"
        @close="closeEditModal"
      />
    </ModalTransition>

  <!-- Preview Modal -->
  <DocumentPreviewModal
    :isVisible="showPreviewModal"
    :documentData="previewDocumentData"
    @close="showPreviewModal = false"
  />

  <!-- Modal Email -->
  <ModalTransition v-show="showSendDocumentViaEmailModal">
    <SendDocument
      @closeEmailModal="closeEmailModal()"
      :emailDocument="emailDocument"
    />
  </ModalTransition>
  
  <!-- Signatures Modal -->
  <DocumentSignaturesModal 
    :isVisible="showSignaturesModal"
    :documentId="selectedDocumentId"
    @close="closeSignaturesModal"
    @refresh="handleRefresh"
  />
</template>

<script setup>
import {
  CheckCircleIcon,
  EllipsisVerticalIcon,
  PencilIcon,
} from "@heroicons/vue/24/outline";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/vue";
import ModalTransition from "@/components/layouts/animations/ModalTransition.vue";
import SendDocument from "@/components/dynamic_document/layouts/modals/SendDocument.vue";
import UseDocumentByClient from "@/components/dynamic_document/client/modals/UseDocumentByClient.vue";
import { computed, ref, watch, onMounted } from "vue";
import { useDynamicDocumentStore } from "@/stores/dynamicDocument";
import { useUserStore } from "@/stores/user";
import { showNotification } from "@/shared/notification_message";
import { showConfirmationAlert } from "@/shared/confirmation_alert";
import { getAllColors, getColorById } from "@/shared/color_palette";

import {
  showPreviewModal,
  previewDocumentData,
  openPreviewModal,
  downloadFile,
} from "@/shared/document_utils";
import DocumentPreviewModal from "@/components/dynamic_document/common/DocumentPreviewModal.vue";
import { useRecentViews } from '@/composables/useRecentViews';
import DocumentSignaturesModal from "@/components/dynamic_document/common/DocumentSignaturesModal.vue";
import { get_request } from "@/stores/services/request_http";

// Store instances
const documentStore = useDynamicDocumentStore();
const userStore = useUserStore();
const { registerView } = useRecentViews();

// Reactive state
const currentUser = computed(() => userStore.getCurrentUser);
const showEditDocumentModal = ref(false);
const selectedDocumentId = ref(null);
const showSendDocumentViaEmailModal = ref(false);
const emailDocument = ref({});
const showSignaturesModal = ref(false);
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
 * Download the document as PDF.
 * @param {Object} doc - The document to download.
 */
const downloadPDFDocument = (doc) => {
  documentStore.downloadPDF(doc.id, doc.title);
};

/**
 * Download the document as Word.
 * @param {Object} doc - The document to download.
 */
const downloadWordDocument = (doc) => {
  documentStore.downloadWord(doc.id, doc.title);
};

/**
 * Delete the document.
 * @param {object} document - The document to delete.
 */
const deleteDocument = async (document) => {
  // Show modal confirmation
  const confirmed = await showConfirmationAlert(
    `¿Deseas eliminar el documento "${document.title}"?`
  );

  // Delete in confirmed case
  if (confirmed) {
    await documentStore.deleteDocument(document.id);
    await showNotification("Documento eliminado exitosamente.", "success");
  }
};

/**
 * Open the edit modal for the selected document.
 * @param {object} document - The document to edit or complete.
 */
const openEditModal = (document) => {
  documentStore.selectedDocument = document; // Set selected document in the store
  selectedDocumentId.value = document.id;
  showEditDocumentModal.value = true;
};

/**
 * Close the edit modal and clear the selected document.
 * @param {Object} data - Data received from the modal, may contain updatedDocId
 */
const closeEditModal = (data) => {
  showEditDocumentModal.value = false;
  
  // Check if we have received updatedDocId from the modal
  if (data && data.updatedDocId) {
    // Apply highlighting using our function
    forceHighlight(data.updatedDocId);
  }
  
  documentStore.clearSelectedDocument();
};

/**
 * Opens the email modal and sets the selected document.
 *
 * @param {Object} doc - The document to be sent via email.
 */
const openEmailModal = (doc) => {
  emailDocument.value = doc;
  showSendDocumentViaEmailModal.value = true;
};

/**
 * Closes the email modal and resets the selected document.
 */
const closeEmailModal = () => {
  emailDocument.value = {};
  showSendDocumentViaEmailModal.value = false;
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
 * Opens the preview modal and registers the document view
 * @param {Object} doc - The document to preview
 */
const handlePreviewDocument = async (document) => {
  await registerView('document', document.id);
  openPreviewModal(document);
};

/**
 * Navigate to signature view for a document.
 * @param {object} document - The document to view signatures for.
 */
const viewDocumentSignatures = (document) => {
  selectedDocumentId.value = document.id;
  showSignaturesModal.value = true;
};

/**
 * Closes the signatures modal and resets the selected document.
 */
const closeSignaturesModal = () => {
  showSignaturesModal.value = false;
};

/**
 * Refreshes the document data after an action (like signing).
 */
const handleRefresh = async () => {
  // Reload documents using the store
  await documentStore.init(true);
  
  // If we're in a component that displays store-based data,
  // ensure the data is updated
  const docExists = filteredDocuments.value.some(doc => 
    String(doc.id) === String(selectedDocumentId.value)
  );
  
  if (docExists) {
    documentStore.lastUpdatedDocumentId = selectedDocumentId.value;
    localStorage.setItem('lastUpdatedDocumentId', selectedDocumentId.value);
    forceHighlight(selectedDocumentId.value);
  }
};

/**
 * Function to format dates
 */
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
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
