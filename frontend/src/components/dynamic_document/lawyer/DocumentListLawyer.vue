<template>
  <!-- Prompt Documents (if any) -->
  <template v-if="props.promptDocuments && displayablePromptDocuments.length > 0">
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      <!-- Document Item -->
      <DocumentCard
        v-for="document in displayablePromptDocuments"
        :key="document.id"
        :document="document"
        :card-type="'lawyer'"
        :card-context="'prompt'"
        :highlighted-doc-id="highlightedDocId"
        :status-icon="getStatusIcon(document)"
        :status-text="getStatusText(document)"
        :status-badge-classes="getStatusBadgeClasses(document)"
        :document-store="documentStore"
        :user-store="userStore"
        :prompt-documents="true"
        @refresh="handleRefresh"
      >
        <!-- Additional signature status badge -->
        <template #additional-badges>
            <div 
              v-if="document.requires_signature" 
              class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
            :class="getSignatureStatusClasses(document)"
          >
            <!-- Different icons based on signature status -->
              <svg 
                v-if="document.fully_signed"
                class="h-3 w-3" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                stroke-width="2" 
                stroke-linecap="round" 
                stroke-linejoin="round"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              
              <svg 
                v-else-if="getCurrentUserSignature(document)?.signed"
                class="h-3 w-3" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                stroke-width="2" 
                stroke-linecap="round" 
                stroke-linejoin="round"
              >
                <path d="M20 6L9 17l-5-5"></path>
              </svg>
              
              <svg 
                v-else-if="getCurrentUserSignature(document)"
                class="h-3 w-3" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                stroke-width="2" 
                stroke-linecap="round" 
                stroke-linejoin="round"
              >
                <path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
              </svg>
              
              <svg 
                v-else
                class="h-3 w-3" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                stroke-width="2" 
                stroke-linecap="round" 
                stroke-linejoin="round"
              >
                <path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
              </svg>
              
              <span>
                {{ document.fully_signed ? 'Formalizado' : getSignatureStatus(document) }}
              </span>
            </div>
        </template>
      </DocumentCard>
    </div>
  </template>

  <!-- Regular Document Lists (if no promptDocuments) -->
  <template v-else-if="!props.promptDocuments">
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      <!-- Document Item -->
      <DocumentCard
        v-for="document in filteredDocuments"
        :key="document.id"
        :document="document"
        :card-type="'lawyer'"
        :card-context="'list'"
        :highlighted-doc-id="highlightedDocId"
        :status-icon="getStatusIcon(document)"
        :status-text="getStatusText(document)"
        :status-badge-classes="getStatusBadgeClasses(document)"
        :document-store="documentStore"
        :user-store="userStore"
        @refresh="handleRefresh"
      >
        <!-- Additional signature status badge -->
        <template #additional-badges>
            <div 
              v-if="document.requires_signature" 
              class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
            :class="getSignatureStatusClasses(document)"
          >
            <!-- Different icons based on signature status -->
              <svg 
                v-if="document.fully_signed"
                class="h-3 w-3" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                stroke-width="2" 
                stroke-linecap="round" 
                stroke-linejoin="round"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              
              <svg 
                v-else-if="getCurrentUserSignature(document)?.signed"
                class="h-3 w-3" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                stroke-width="2" 
                stroke-linecap="round" 
                stroke-linejoin="round"
              >
                <path d="M20 6L9 17l-5-5"></path>
              </svg>
              
              <svg 
                v-else-if="getCurrentUserSignature(document)"
                class="h-3 w-3" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                stroke-width="2" 
                stroke-linecap="round" 
                stroke-linejoin="round"
              >
                <path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
              </svg>
              
              <svg 
                v-else
                class="h-3 w-3" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                stroke-width="2" 
                stroke-linecap="round" 
                stroke-linejoin="round"
              >
                <path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
              </svg>
              
              <span>
                {{ document.fully_signed ? 'Formalizado' : getSignatureStatus(document) }}
              </span>
            </div>
        </template>
      </DocumentCard>
    </div>
  </template>

  <!-- Modal de previsualización -->
  <DocumentPreviewModal
    :isVisible="showPreviewModal"
    :documentData="previewDocumentData"
    @close="showPreviewModal = false"
  />
</template>

<script setup>
import { computed, ref, onMounted, watch } from "vue";
import { useRouter } from "vue-router";
import {
  PencilIcon,
  CheckCircleIcon,
} from "@heroicons/vue/24/outline";
import { useDynamicDocumentStore } from "@/stores/dynamic_document";
import { useUserStore } from "@/stores/user";
import { showNotification } from "@/shared/notification_message";
import { get_request } from "@/stores/services/request_http";
import { DocumentCard } from "@/components/dynamic_document/cards";
import DocumentPreviewModal from "@/components/dynamic_document/common/DocumentPreviewModal.vue";
import { showPreviewModal, previewDocumentData } from "@/shared/document_utils";

// Store instance
const documentStore = useDynamicDocumentStore();
const userStore = useUserStore();
const router = useRouter();

// Reactive state for pending and signed documents
const pendingSignatureDocuments = ref([]);
const signedDocuments = ref([]);

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

// --- Helper functions for DocumentCard props ---

/**
 * Get status icon based on document state
 */
const getStatusIcon = (document) => {
  if (document.state === 'Published' || document.state === 'FullySigned') {
    return CheckCircleIcon;
  }
  return PencilIcon;
};

/**
 * Get status text based on document state
 */
const getStatusText = (document) => {
  switch (document.state) {
    case 'Published': return 'Publicado';
    case 'Draft': return 'Borrador';
    case 'Progress': return 'En progreso';
    case 'Completed': return 'Completado';
    case 'PendingSignatures': return 'Pendiente de firmas';
    case 'FullySigned': return 'Completamente firmado';
    default: return 'Desconocido';
  }
};

/**
 * Get status badge classes based on document state
 */
const getStatusBadgeClasses = (document) => {
  switch (document.state) {
    case 'Published':
    case 'FullySigned':
      return 'bg-green-100 text-green-700 border border-green-200';
    case 'Draft':
    case 'Progress':
      return 'bg-blue-100 text-blue-700 border border-blue-200';
    case 'PendingSignatures':
      return 'bg-yellow-100 text-yellow-700 border border-yellow-200';
    case 'Completed':
      return 'bg-purple-100 text-purple-700 border border-purple-200';
    default:
      return 'bg-gray-100 text-gray-700 border border-gray-200';
  }
};

/**
 * Get signature status classes
 */
const getSignatureStatusClasses = (document) => {
  if (document.fully_signed) {
    return 'bg-green-100 text-green-700 border border-green-200';
  } else if (getCurrentUserSignature(document)?.signed && !document.fully_signed) {
    return 'bg-blue-100 text-blue-700 border border-blue-200';
  } else if (getCurrentUserSignature(document) && !getCurrentUserSignature(document)?.signed) {
    return 'bg-yellow-100 text-yellow-700 border border-yellow-200';
  } else {
    return 'bg-gray-100 text-gray-700 border border-gray-200';
  }
};

// --- Start of new computed properties for separate lists ---

// Documents managed by the lawyer (e.g., Draft, Published), EXCLUDING FullySigned
const lawyerManagedNonFullySignedDocuments = computed(() => {
  if (props.promptDocuments) return []; // Not used if promptDocuments are active

  const docs = documentStore.getDocumentsByLawyerId(userStore.currentUser.id) || [];
  const filteredDocs = docs.filter(doc => doc.state !== 'FullySigned');
  
  // Get selected tag IDs
  const selectedTagIds = props.selectedTags ? props.selectedTags.map(tag => tag.id) : [];
  
  // Apply search and tag filters
  const searchAndTagFiltered = documentStore.filteredDocumentsBySearchAndTags(
    props.searchQuery, 
    userStore, 
    selectedTagIds
  );
  
  // Find intersection between lawyer docs and filtered docs
  return searchAndTagFiltered.filter(doc => 
    filteredDocs.some(lawyerDoc => lawyerDoc.id === doc.id)
  );
});

// Filtered prompt documents (if provided)
const displayablePromptDocuments = computed(() => {
  if (props.promptDocuments && props.promptDocuments.length > 0) {
    let filteredPromptDocs = props.promptDocuments.filter(doc => 
      doc.title && doc.title.toLowerCase().includes((props.searchQuery || '').toLowerCase())
    );
    
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
  return [];
});

// Retrieve documents in drafted and published from the store, applying the search filter.
const filteredDocuments = computed(() => {
  if (props.promptDocuments) {
    return displayablePromptDocuments.value;
  }
  return lawyerManagedNonFullySignedDocuments.value;
});

// Computed property to determine which document should be highlighted
const highlightedDocId = computed(() => {
  // If we have prompt documents, don't show any highlight from store/localStorage
  if (props.promptDocuments) {
    return null;
  }

  const storeId = documentStore.lastUpdatedDocumentId;
  const localId = localStorage.getItem('lastUpdatedDocumentId');
  
  const allDisplayedDocs = [...lawyerManagedNonFullySignedDocuments.value];
  
  const docExistsInStoreId = storeId && allDisplayedDocs.some(doc => String(doc.id) === String(storeId));
  if (docExistsInStoreId) {
    return storeId;
  }
  
  const docExistsInLocalId = localId && allDisplayedDocs.some(doc => String(doc.id) === String(localId));
  if (docExistsInLocalId) {
    return localId;
  }
  
  return null;
});

/**
 * Fetch pending and signed documents for the current lawyer
 */
const fetchLawyerDocuments = async () => {
  try {
    const userId = userStore.currentUser.id;

    const pendingResponse = await get_request(`dynamic-documents/user/${userId}/pending-documents-full/`);
    const signedResponse = await get_request(`dynamic-documents/user/${userId}/signed-documents/`);

    if (pendingResponse.status === 200) {
      pendingSignatureDocuments.value = pendingResponse.data;
    }

    if (signedResponse.status === 200) {
      signedDocuments.value = signedResponse.data;
    }
  } catch (error) {
    console.error('Error fetching lawyer documents:', error);
    if (error.response) {
      console.error('Error response data:', error.response.data);
      console.error('Error status:', error.response.status);
    }
  }
};

/**
 * Check if the current user is a signer for the document and get their signature record
 * @param {object} document - The document to check
 * @returns {object|null} - The signature record for the current user or null
 */
const getCurrentUserSignature = (document) => {
  // First, verify document has signatures and requires them
  if (!document.signatures || !document.requires_signature) {
    return null;
  }
  
  // Get current user ID as string for comparison
  const currentUserId = String(userStore.currentUser.id);
  
  // Find signature for current user
  return document.signatures.find(sig => String(sig.signer_id) === currentUserId);
};

/**
 * Gets the signature status display text for a document
 * @param {Object} document - The document object
 * @returns {String} - Status text for display
 */
const getSignatureStatus = (document) => {
  if (!document.requires_signature) {
    return '';
  }
  
  if (document.fully_signed) {
    return 'Documento formalizado';
  }
  
  // Check if current user has already signed
  const currentUserSignature = getCurrentUserSignature(document);
  
  if (document.signatures && document.signatures.length > 0) {
    const totalSignatures = document.signatures.length;
    const signedCount = document.signatures.filter(sig => sig.signed).length;
    
    if (currentUserSignature && currentUserSignature.signed) {
      if (signedCount === 1 && totalSignatures > 1) {
        return `Has firmado. Faltan ${totalSignatures - signedCount} firmas más`;
      } else if (signedCount < totalSignatures) {
        return `Has firmado. Faltan ${totalSignatures - signedCount} firmas más`;
      }
    }
    
    return `Firmas: ${signedCount}/${totalSignatures}`;
  }
  
  return currentUserSignature ? 'Requiere tu firma' : 'Requiere firmas';
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
        
        // Remove and re-add classes to restart animation
        element.classList.remove("animate-pulse-highlight-green", "animate-pulse-highlight-blue");
        
        // Force a reflow before adding the class again
        void element.offsetWidth;
        
        // Determine which animation to use based on document state
        const documentElement = element.querySelector('[data-document-id]') || element;
        const isPublished = documentElement.classList.contains('border-green-400');
        
        // Add the appropriate animation class
        if (isPublished) {
          element.classList.add("animate-pulse-highlight-green");
        } else {
          element.classList.add("animate-pulse-highlight-blue");
        }
        
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
  // If we have prompt documents, don't initialize highlights
  if (props.promptDocuments) {
    return;
  }

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

  // Fetch pending and signed documents
  fetchLawyerDocuments();
});

const handleRefresh = async () => {
  // Refresh the document list
  await documentStore.init();
};
</script>

<style scoped>
@keyframes pulse-highlight-green {
  0% {
    box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.6);
    border-color: rgb(74, 222, 128);
    background-color: rgba(34, 197, 94, 0.03);
    transform: scale(1);
  }
  50% {
    box-shadow: 0 0 10px 5px rgba(34, 197, 94, 0.4);
    border-color: rgb(74, 222, 128);
    background-color: rgba(34, 197, 94, 0.1);
    transform: scale(1.02);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.6);
    border-color: rgb(74, 222, 128);
    background-color: rgba(34, 197, 94, 0.03);
    transform: scale(1);
  }
}

@keyframes pulse-highlight-blue {
  0% {
    box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.6);
    border-color: rgb(147, 197, 253);
    background-color: rgba(59, 130, 246, 0.019);
    transform: scale(1);
  }
  50% {
    box-shadow: 0 0 10px 5px rgba(59, 130, 246, 0.4);
    border-color: rgb(147, 197, 253);
    background-color: rgba(59, 130, 246, 0.1);
    transform: scale(1.02);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.6);
    border-color: rgb(147, 197, 253);
    background-color: rgba(59, 130, 246, 0.019);
    transform: scale(1);
  }
}

@keyframes pulse-highlight-yellow {
  0% {
    box-shadow: 0 0 0 0 rgba(234, 179, 8, 0.6);
    border-color: rgb(253, 224, 71);
    background-color: rgba(234, 179, 8, 0.019);
    transform: scale(1);
  }
  50% {
    box-shadow: 0 0 10px 5px rgba(234, 179, 8, 0.4);
    border-color: rgb(253, 224, 71);
    background-color: rgba(234, 179, 8, 0.1);
    transform: scale(1.02);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(234, 179, 8, 0.6);
    border-color: rgb(253, 224, 71);
    background-color: rgba(234, 179, 8, 0.019);
    transform: scale(1);
  }
}

.animate-pulse-highlight-green {
  animation: pulse-highlight-green 1s ease-in-out 3;
  animation-fill-mode: forwards;
  border-width: 1px !important;
  position: relative;
  z-index: 10;
}

.animate-pulse-highlight-blue {
  animation: pulse-highlight-blue 1s ease-in-out 3;
  animation-fill-mode: forwards;
  border-width: 1px !important;
  position: relative;
  z-index: 10;
}

.animate-pulse-highlight-yellow {
  animation: pulse-highlight-yellow 1s ease-in-out 3;
  animation-fill-mode: forwards;
  border-width: 1px !important;
  position: relative;
  z-index: 10;
}

/* Tooltip arrow styles */
.tooltip-with-arrow:after {
  content: '';
  position: absolute;
  bottom: -4px;
  left: 10px;
  margin-left: -5px;
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 5px solid #1f2937; /* Match tooltip background color */
}
</style>
