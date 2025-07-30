<template>
      <!-- Documents list -->
      <SignatureDocumentCard
        v-for="document in filteredDocuments"
        :key="document.id"
        :document="document"
        :card-type="'signatures'"
        :card-context="'list'"
        :highlighted-doc-id="highlightedDocId"
        :document-store="documentStore"
        :user-store="userStore"
        @refresh="refreshDocuments"
        class="mb-4"
      />

      <!-- No documents message -->
      <div
        v-if="filteredDocuments.length === 0 && !isLoading"
        class="mt-6 flex flex-col items-center justify-center text-center text-gray-500 w-full"
      >
        <p class="text-lg font-semibold">
          {{ emptyMessage }}
        </p>
      </div>

    <!-- Loading indicator -->
    <div v-if="isLoading" class="mt-6 flex justify-center">
      <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <span>Cargando documentos...</span>
    </div>

  <!-- Modal de previsualización -->
  <DocumentPreviewModal
    :isVisible="showPreviewModal"
    :documentData="previewDocumentData"
    @close="showPreviewModal = false"
  />
</template>

<script setup>
import { computed, ref, onMounted, watch } from "vue";
import { useUserStore } from "@/stores/user";
import { useDynamicDocumentStore } from "@/stores/dynamic_document";
import { get_request } from "@/stores/services/request_http";
import { showNotification } from "@/shared/notification_message";
import { getAllColors, getColorById } from "@/shared/color_palette";
import { SignatureDocumentCard } from "@/components/dynamic_document/cards";
import DocumentPreviewModal from "@/components/dynamic_document/common/DocumentPreviewModal.vue";
import { showPreviewModal, previewDocumentData } from "@/shared/document_utils";

// Props
const props = defineProps({
  state: {
    type: String,
    required: true,
    validator: (value) => ['PendingSignatures', 'FullySigned'].includes(value)
  },
  searchQuery: {
    type: String,
    default: ''
  },
  selectedTags: {
    type: Array,
    default: () => []
  }
});

// Store instances
const userStore = useUserStore();
const documentStore = useDynamicDocumentStore();

// Reactive state
const documents = ref([]);
const isLoading = ref(false);

const emptyMessage = computed(() => {
  return props.state === 'PendingSignatures'
    ? 'No tienes documentos pendientes por firmar.'
    : 'No tienes documentos firmados.';
});

const filteredDocuments = computed(() => {
  const userRole = userStore.currentUser.role;
  const userId = userStore.currentUser.id;
  const userEmail = userStore.currentUser.email;
  
  let storeDocuments = [];
  
  // Role-specific logic
  if (userRole === 'lawyer') {
    // For lawyers, show documents they created
    if (props.state === 'PendingSignatures') {
      storeDocuments = documentStore.pendingSignatureDocuments.filter(doc => {
        return doc.created_by === userId;
      });
    } else {
      // For signed documents, show all they created
      storeDocuments = documentStore.fullySignedDocuments.filter(doc => 
        doc.created_by === userId
      );
    }
  } else {
    // For clients
    if (props.state === 'PendingSignatures') {
      // Show pending documents where client is a signer
      storeDocuments = documentStore.documents.filter(doc => {
        // Check if document is in PendingSignatures state
        if (doc.state !== 'PendingSignatures') {
          return false;
        }
        
        // Check if client is a signer by email
        const isSigner = doc.signatures?.some(sig => {
          return sig.signer_email === userEmail;
        });
        
        return isSigner;
      });
    } else {
      // Show signed documents where client is a signer
      storeDocuments = documentStore.documents.filter(doc => {
        // Check if document is in FullySigned state
        if (doc.state !== 'FullySigned') return false;
        
        // Check if client is a signer by email
        const isSigner = doc.signatures?.some(sig => 
          sig.signer_email === userEmail && sig.signed
        );
        
        return isSigner;
      });
    }
  }
  
  // Apply search filter
  if (props.searchQuery) {
    storeDocuments = storeDocuments.filter(doc => 
      doc.title.toLowerCase().includes(props.searchQuery.toLowerCase())
    );
  }
  
  // Apply tag filter if tags are selected
  if (props.selectedTags && props.selectedTags.length > 0) {
    const selectedTagIds = props.selectedTags.map(tag => tag.id);
    storeDocuments = storeDocuments.filter(doc => {
      if (!doc.tags || doc.tags.length === 0) return false;
      return doc.tags.some(tag => selectedTagIds.includes(tag.id));
    });
  }
  
  return storeDocuments;
});

/**
 * Computed property for document highlight
 */
const highlightedDocId = computed(() => {
  const storeId = documentStore.lastUpdatedDocumentId;
  const localId = localStorage.getItem('lastUpdatedDocumentId');
  
  const docExists = storeId && filteredDocuments.value.some(doc => String(doc.id) === String(storeId));
  
  if (docExists) {
    return storeId;
  } else if (localId) {
    const localDocExists = filteredDocuments.value.some(doc => String(doc.id) === String(localId));
    return localDocExists ? localId : null;
  }
  
  return null;
});

/**
 * Refreshes all document data
 */
const refreshDocuments = async () => {
  isLoading.value = true;
  try {
    // Ensure store has updated data
    await documentStore.init(true);
    
    // If no documents, try to load user-specific documents
    if (documentStore.pendingSignatureDocuments.length === 0 && 
        documentStore.fullySignedDocuments.length === 0) {
      const userId = userStore.currentUser.id;
      const userRole = userStore.currentUser.role;
      
      // Make a specific request based on role
      const endpoint = userRole === 'lawyer'
        ? `dynamic-documents/created-by/${userId}/pending-signatures/`
        : `dynamic-documents/user/${userId}/pending-documents-full/`;
      
      const response = await get_request(endpoint);
      if (response && response.data) {
        // Update store with new documents
        documentStore.$patch(state => {
          state.documents = [...state.documents, ...response.data];
        });
      }
    }
  } catch (error) {
    console.error('Error refreshing documents:', error);
    showNotification('Error al actualizar documentos', 'error');
  } finally {
    isLoading.value = false;
  }
};

/**
 * Initializes the component by fetching necessary data
 */
onMounted(async () => {
  await refreshDocuments();
});

// Watch for changes in the store's documents
watch(
  () => documentStore.documents,
  (newDocuments) => {
    // Handle document updates
  },
  { deep: true }
);

// Watch for changes in the user
watch(
  () => userStore.currentUser,
  (newUser) => {
    refreshDocuments();
  }
);

// Watch for search query changes
watch(
  () => props.searchQuery,
  (newQuery) => {
    if (!newQuery) {
      refreshDocuments();
    }
  }
);
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