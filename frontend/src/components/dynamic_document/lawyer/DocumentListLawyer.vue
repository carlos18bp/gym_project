<template>
  <div class="mt-8 flex flex-wrap gap-6">
    <div
      v-for="document in filteredDocuments"
      :key="document.id"
      :data-document-id="document.id"
      :class="[
        'flex items-center gap-2 py-2 px-4 border rounded-md cursor-pointer transition',
        document.state === 'Published'
          ? 'border-green-400 bg-green-300/30 hover:bg-green-300/50'
          : 'border-stroke bg-white hover:bg-gray-100',
        highlightedDocId && String(highlightedDocId) === String(document.id) ? 'animate-pulse-highlight' : ''
      ]"
      :style="highlightedDocId && String(highlightedDocId) === String(document.id) ? 'border: 3px solid #3b82f6 !important;' : ''"
    >
      <component
        :is="document.state === 'Published' ? CheckCircleIcon : PencilIcon"
        :class="
          document.state === 'Published'
            ? 'size-6 text-green-500'
            : 'size-6 text-secondary'
        "
      />
      <span class="text-base font-medium">{{ document.title }}</span>

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
            class="absolute left-0 z-10 mt-2 w-56 rounded-md bg-white shadow-lg ring-1 ring-black/5"
          >
            <MenuItem
              v-for="option in getDocumentOptions(document)"
              :key="option.label"
            >
              <button
                class="w-full text-left px-4 py-2 text-sm font-regular transition flex items-center gap-2"
                :disabled="option.disabled"
                @click="
                  !option.disabled && handleOption(option.action, document)
                "
                :class="{
                  'opacity-50 cursor-not-allowed': option.disabled,
                  'cursor-pointer': !option.disabled,
                }"
              >
                <NoSymbolIcon
                  v-if="option.disabled"
                  class="size-5 text-gray-400"
                  aria-hidden="true"
                />
                {{ option.label }}
              </button>
            </MenuItem>
          </MenuItems>
        </transition>
      </Menu>
    </div>
  </div>

  <!-- Edit Document Modal -->
  <ModalTransition v-show="showEditDocumentModal">
    <CreateDocumentByLawyer @close="closeEditModal" />
  </ModalTransition>

  <!-- Preview Modal -->
  <DocumentPreviewModal
    :isVisible="showPreviewModal"
    :documentData="previewDocumentData"
    @close="showPreviewModal = false"
  />
</template>

<script setup>
import { computed, ref, onMounted, watch } from "vue";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/vue";
import {
  EllipsisVerticalIcon,
  PencilIcon,
  CheckCircleIcon,
  NoSymbolIcon,
} from "@heroicons/vue/24/outline";
import { useDynamicDocumentStore } from "@/stores/dynamicDocument";
import ModalTransition from "@/components/layouts/animations/ModalTransition.vue";
import CreateDocumentByLawyer from "@/components/dynamic_document/lawyer/modals/CreateDocumentByLawyer.vue";
import { showNotification } from "@/shared/notification_message";
import { showConfirmationAlert } from "@/shared/confirmation_alert";

import {
  showPreviewModal,
  previewDocumentData,
  openPreviewModal,
} from "@/shared/document_utils";
import DocumentPreviewModal from "@/components/dynamic_document/common/DocumentPreviewModal.vue";

// Store instance
const documentStore = useDynamicDocumentStore();

// Reactive state
const showEditDocumentModal = ref(false);
const lastUpdatedDocId = ref(null);

const props = defineProps({
  searchQuery: String,
});

// Retrieve documents in drafted and published from the store, applying the search filter.
const filteredDocuments = computed(() => {
  const allDraftAndPublishedDocs =
    documentStore.draftAndPublishedDocumentsUnassigned;
  
  const filtered = documentStore
    .filteredDocuments(props.searchQuery, "")
    .filter((doc) =>
      allDraftAndPublishedDocs.some(
        (draftAndPublishedDoc) => draftAndPublishedDoc.id === doc.id
      )
    );
  
  return filtered;
});

// Computed property to determine which document should be highlighted
const highlightedDocId = computed(() => {
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

/**
 * Get the available options for a document based on its state.
 * If the document has undefined variables, the "Publicar" option is disabled.
 * @param {object} document - The document to evaluate.
 * @returns {Array} - List of options.
 */
const getDocumentOptions = (document) => {
  const baseOptions = [
    { label: "Editar", action: "edit" },
    { label: "Eliminar", action: "delete" },
    { label: "Previsualización", action: "preview" },
  ];

  // Add state-based options with validations
  if (document.state === "Draft") {
    baseOptions.push({
      label: "Publicar",
      action: "publish",
      disabled: !canPublishDocument(document),
    });
  } else if (document.state === "Published") {
    baseOptions.push({
      label: "Mover a Borrador",
      action: "draft",
      disabled: false,
    });
  }

  return baseOptions;
};

/**
 * Check if a document can be published by verifying all variable values are filled.
 * @param {object} document - The document to check.
 * @returns {boolean} - True if the document can be published, false otherwise.
 */
const canPublishDocument = (document) => {
  return document.variables.every(
    (variable) => variable.value && variable.value.trim().length > 0
  );
};

/**
 * Handle document option actions.
 * @param {string} action - The action to perform.
 * @param {object} document - The document to apply the action on.
 */
const handleOption = async (action, document) => {
  switch (action) {
    case "edit":
      documentStore.selectedDocument = document;
      showEditDocumentModal.value = true;
      break;
    case "delete":
      const confirmed = await showConfirmationAlert(
        `¿Deseas eliminar el documento '${document.title}'?`
      );
      if (confirmed) {
        await documentStore.deleteDocument(document.id);
        await showNotification("Documento eliminado correctamente.", "success");
      }
      break;
    case "publish":
      await publishDocument(document);
      // La notificación se omite porque se hará redirección automática
      break;
    case "draft":
      await moveToDraft(document);
      // La notificación se omite porque se hará redirección automática
      break;
    case "preview":
      openPreviewModal(document);
      break;
    default:
      console.warn(`Acción desconocida: ${action}`);
  }
};

/**
 * Publish the document by updating its state.
 * @param {object} document - The document to publish.
 */
const publishDocument = async (document) => {
  const updatedData = {
    ...document,
    state: "Published",
  };
  const response = await documentStore.updateDocument(document.id, updatedData);
  
  // Set this document as the last updated to highlight it
  documentStore.lastUpdatedDocumentId = document.id;
  localStorage.setItem('lastUpdatedDocumentId', document.id);
  
  // Try to force highlight first
  forceHighlight(document.id);
  
  // Check if we're already on the dashboard
  const currentPath = window.location.pathname;
  const isDashboard = currentPath === '/dynamic_document_dashboard' || 
                      currentPath === '/dynamic_document_dashboard/';
  
  if (!isDashboard) {
    // Only redirect if not already on dashboard
    setTimeout(() => {
      window.location.href = '/dynamic_document_dashboard';
    }, 800);
  }
};

/**
 * Move the document to draft state.
 * @param {object} document - The document to update.
 */
const moveToDraft = async (document) => {
  const updatedData = {
    ...document,
    state: "Draft",
  };
  const response = await documentStore.updateDocument(document.id, updatedData);
  
  // Set this document as the last updated to highlight it
  documentStore.lastUpdatedDocumentId = document.id;
  localStorage.setItem('lastUpdatedDocumentId', document.id);
  
  // Try to force highlight first
  forceHighlight(document.id);
  
  // Check if we're already on the dashboard
  const currentPath = window.location.pathname;
  const isDashboard = currentPath === '/dynamic_document_dashboard' || 
                      currentPath === '/dynamic_document_dashboard/';
  
  if (!isDashboard) {
    // Only redirect if not already on dashboard
    setTimeout(() => {
      window.location.href = '/dynamic_document_dashboard';
    }, 800);
  }
};

/**
 * Close the edit modal and clear the document reference.
 * Can receive an object with the ID of the updated document to highlight it.
 */
const closeEditModal = (eventData) => {
  showEditDocumentModal.value = false;
  documentStore.selectedDocument = null;
  
  // Check if we received data about which document was updated
  if (eventData && eventData.updatedDocId) {
    // Set the ID for visual highlight
    documentStore.lastUpdatedDocumentId = eventData.updatedDocId;
    localStorage.setItem('lastUpdatedDocumentId', eventData.updatedDocId);
    
    // Try to force highlight first
    forceHighlight(eventData.updatedDocId);
    
    // Check if we're already on the dashboard
    const currentPath = window.location.pathname;
    const isDashboard = currentPath === '/dynamic_document_dashboard' || 
                        currentPath === '/dynamic_document_dashboard/';
    
    if (!isDashboard) {
      // Only redirect if not already on dashboard
      setTimeout(() => {
        window.location.href = '/dynamic_document_dashboard';
      }, 800);
    }
  }
};

// Make sure highlighted document ID is updated when filtered documents change
watch(filteredDocuments, (newDocs) => {
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
 * Forces highlight on a specific document by directly manipulating DOM
 * @param {string|number} documentId - ID of the document to highlight
 */
const forceHighlight = (documentId) => {
  if (!documentId) return;
  
  // Find the actual DOM element
  setTimeout(() => {
    try {
      // Find element by attribute selector
      const documentElements = document.querySelectorAll(`[data-document-id="${documentId}"]`);
      
      if (documentElements.length > 0) {
        const element = documentElements[0];
        
        // Apply styles directly
        element.style.border = "2px solid #3b82f6";
        
        // Remove and re-add classes to restart animation
        element.classList.remove("animate-pulse-highlight");
        
        // Force a reflow before adding the class again
        void element.offsetWidth;
        
        // Add the classes again
        element.classList.add("animate-pulse-highlight");
        
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

// Initialize data when component mounts
onMounted(async () => {
  // Ensure documents are loaded
  await documentStore.init();
  
  const savedId = localStorage.getItem('lastUpdatedDocumentId');
  
  if (savedId) {
    documentStore.lastUpdatedDocumentId = savedId;
    
    // Force detection of changes in Vue
    setTimeout(() => {
      const docExists = filteredDocuments.value.some(doc => String(doc.id) === String(savedId));
      
      // If document exists, force a highlight
      if (docExists) {
        forceHighlight(savedId);
      }
    }, 500);
  }
});
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
