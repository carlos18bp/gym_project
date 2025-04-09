<template>
    <!-- Document Item -->
    <div
      v-for="document in filteredDocuments"
      :key="document.id"
      :data-document-id="document.id"
      class="flex items-center gap-3 py-2 px-4 border rounded-xl cursor-pointer"
      :class="{
        'border-green-400 bg-green-300/30': document.state === 'Completed',
        'border-stroke bg-white': document.state === 'Progress',
        'border-secondary shadow-md animate-pulse-highlight': String(document.id) === String(highlightedDocId),
      }"
    >
      <component
        :is="document.state === 'Completed' ? CheckCircleIcon : PencilIcon"
        class="size-6"
        :class="{
          'text-green-500': document.state === 'Completed',
          'text-secondary': document.state === 'Progress',
        }"
      />
      <div class="flex justify-between items-center w-full">
        <div class="grid gap-1">
          <span class="text-base font-medium">{{ document.title }}</span>
          <span class="text-sm font-regular text-gray-400">{{
            document.description
          }}</span>
        </div>
        <Menu as="div" class="relative inline-block text-left">
          <MenuButton class="flex items-center text-gray-400">
            <EllipsisVerticalIcon class="size-6" aria-hidden="true" />
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
              class="absolute z-10 mt-2 w-56 rounded-md bg-white shadow-lg ring-1 ring-black/5 focus:outline-none"
              :class="[
                props.promptDocuments ? 'right-auto left-0 -translate-x-[calc(100%-24px)]' : 'right-0 left-auto'
              ]"
            >
              <div class="py-1">
                <!-- Edit/Complete option -->
                <MenuItem>
                  <button
                    class="block w-full text-left px-4 py-2 text-sm font-regular hover:bg-gray-100 transition"
                    @click="openEditModal(document)"
                  >
                    {{ document.state === "Completed" ? "Editar" : "Completar" }}
                  </button>
                </MenuItem>
  
                <!-- Preview option -->
                <MenuItem v-if="document.state === 'Completed'">
                  <button
                    class="block w-full text-left px-4 py-2 text-sm font-regular hover:bg-gray-100 transition"
                    @click="handlePreviewDocument(document)"
                  >
                    Previsualizar
                  </button>
                </MenuItem>
  
                <!-- Delete option -->
                <MenuItem>
                  <button
                    class="block w-full text-left px-4 py-2 text-sm font-regular hover:bg-gray-100 transition"
                    @click="deleteDocument(document)"
                  >
                    Eliminar
                  </button>
                </MenuItem>
  
                <!-- Options only for Completed state -->
                <template v-if="document.state === 'Completed'">
                  <MenuItem>
                    <button
                      class="block w-full text-left px-4 py-2 text-sm font-regular hover:bg-gray-100 transition"
                      @click="downloadPDFDocument(document)"
                    >
                      Descargar PDF
                    </button>
                  </MenuItem>
                  <MenuItem>
                    <button
                      class="block w-full text-left px-4 py-2 text-sm font-regular hover:bg-gray-100 transition"
                      @click="downloadWordDocument(document)"
                    >
                      Descargar Word
                    </button>
                  </MenuItem>
                  <MenuItem>
                    <button
                      class="block w-full text-left px-4 py-2 text-sm font-regular hover:bg-gray-100 transition"
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

    <!-- No documents message -->
    <div
      v-if="filteredDocuments.length === 0"
      class="mt-6 flex flex-col items-center justify-center text-center text-gray-500 w-full"
    >
      <p class="text-lg font-semibold">
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
  </div>

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

import {
  showPreviewModal,
  previewDocumentData,
  openPreviewModal,
} from "@/shared/document_utils";
import DocumentPreviewModal from "@/components/dynamic_document/common/DocumentPreviewModal.vue";
import { useRecentViews } from '@/composables/useRecentViews';

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
  promptDocuments: {
    type: Array,
    default: null
  }
});

// Initialize data when component mounts
onMounted(async () => {
  // If we have prompt documents, don't initialize highlights
  if (props.promptDocuments) {
    return;
  }

  // Ensure documents are loaded
  await documentStore.init();
  
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
    
    return filteredPromptDocs;
  }

  // If there's no prompt, use normal logic
  // First, get all progress and completed documents for this client
  const allProgressAndCompletedDocs =
    documentStore.progressAndCompletedDocumentsByClient(currentUser.value?.id);
  
  // Then apply search filter if it exists
  const searchFiltered = documentStore.filteredDocuments(props.searchQuery, userStore);
  
  // Finally, find intersection between both sets
  const result = searchFiltered.filter((doc) =>
    allProgressAndCompletedDocs.some(
      (progressOrCompletedDoc) => String(progressOrCompletedDoc.id) === String(doc.id)
    )
  );
  
  return result;
});

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
