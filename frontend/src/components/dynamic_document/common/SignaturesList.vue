<template>
  <div>
    <div class="mb-6">   
      <!-- Documents list -->
      <div
        v-for="document in filteredDocuments"
        :key="document.id"
        :data-document-id="document.id"
        class="flex items-center gap-3 py-2 px-4 border rounded-xl cursor-pointer hover:bg-gray-50 mb-4"
        :class="{
          'border-yellow-400 bg-yellow-300/10': document.state === 'PendingSignatures',
          'border-green-400 bg-green-50': document.state === 'FullySigned',
          'border-stroke shadow-md animate-pulse-highlight': String(document.id) === String(highlightedDocId),
        }"
        @click="(e) => {
          // Only trigger preview if click was not on the menu
          if (!e.target.closest('.menu-container')) {
            handlePreviewDocument(document);
          }
        }"
      >
        <svg 
          class="h-6 w-6"
          :class="{
            'text-yellow-500': document.state === 'PendingSignatures',
            'text-green-500': document.state === 'FullySigned'
          }"
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          stroke-width="2" 
          stroke-linecap="round" 
          stroke-linejoin="round"
        >
          <path v-if="document.state === 'PendingSignatures'" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
          <path v-else d="M20 6L9 17l-5-5"></path>
        </svg>
        
        <div class="flex justify-between items-center w-full">
          <div class="grid gap-1">
            <span class="text-base font-medium">{{ document.title }}</span>
            <div class="flex items-center gap-2 text-sm text-gray-500">
              <span>Estado de firmas:</span>
              <span :class="{
                'bg-blue-100 text-blue-800': document.state === 'PendingSignatures',
                'bg-green-100 text-green-800': document.state === 'FullySigned'
              }" class="text-xs font-medium px-2 py-0.5 rounded">
                {{ getCompletedSignatures(document) }}/{{ getTotalSignatures(document) }}
              </span>
            </div>
          </div>
          
          <Menu as="div" class="relative inline-block text-left menu-container">
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
                class="absolute z-10 mt-2 w-56 rounded-md bg-white shadow-lg ring-1 ring-black/5 focus:outline-none right-0 left-auto"
              >
                <div class="py-1">
                  <!-- View signatures option (only if document requires signatures and has correct state) -->
                  <MenuItem v-if="document.requires_signature && (document.state === 'PendingSignatures' || document.state === 'FullySigned')">
                    <button
                      class="block w-full text-left px-4 py-2 text-sm font-regular hover:bg-gray-100 transition"
                      @click="viewDocumentSignatures(document)"
                    >
                      Estado de las firmas
                    </button>
                  </MenuItem>

                  <!-- Sign document option -->
                  <MenuItem v-if="canSignDocument(document)">
                    <button
                      class="block w-full text-left px-4 py-2 text-sm font-regular hover:bg-gray-100 transition"
                      @click="signDocument(document)"
                    >
                      Firmar documento
                    </button>
                  </MenuItem>

                  <!-- Download signed document option (only for fully signed documents) -->
                  <MenuItem v-if="document.state === 'FullySigned'">
                    <button
                      class="block w-full text-left px-4 py-2 text-sm font-regular hover:bg-gray-100 transition"
                      @click="downloadSignedDocument(document)"
                    >
                      Descargar Documento firmado
                    </button>
                  </MenuItem>

                  <!-- Download PDF option -->
                  <MenuItem v-if="document.state === 'PendingSignatures'">
                    <button
                      class="block w-full text-left px-4 py-2 text-sm font-regular hover:bg-gray-100 transition"
                      @click="downloadPDFDocument(document)"
                    >
                      Descargar PDF
                    </button>
                  </MenuItem>
                  
                  <!-- Preview option -->
                  <MenuItem>
                    <button
                      class="block w-full text-left px-4 py-2 text-sm font-regular hover:bg-gray-100 transition"
                      @click="handlePreviewDocument(document)"
                    >
                      Previsualizar
                    </button>
                  </MenuItem>
                </div>
              </MenuItems>
            </transition>
          </Menu>
        </div>
      </div>

      <!-- No documents message -->
      <div
        v-if="filteredDocuments.length === 0 && !isLoading"
        class="mt-6 flex flex-col items-center justify-center text-center text-gray-500 w-full"
      >
        <p class="text-lg font-semibold">
          {{ emptyMessage }}
        </p>
      </div>
    </div>

    <!-- Loading indicator -->
    <div v-if="isLoading" class="mt-6 flex justify-center">
      <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <span>Cargando documentos...</span>
    </div>
    
    <!-- Preview Modal -->
    <DocumentPreviewModal
      :isVisible="showPreviewModal"
      :documentData="previewDocumentData"
      @close="showPreviewModal = false"
    />
    
    <!-- Signatures Modal -->
    <DocumentSignaturesModal 
      :isVisible="showSignaturesModal"
      :documentId="selectedDocumentId"
      @close="closeSignaturesModal"
      @refresh="refreshDocuments"
    />
    
    <!-- Electronic Signature Modal -->
    <ModalTransition v-if="showSignatureModal">
      <div class="p-4 sm:p-6">
        <div class="bg-white rounded-xl shadow-xl max-w-3xl w-full mx-auto">
          <div class="flex justify-between items-center p-4 border-b">
            <h2 class="text-lg font-medium text-primary">Firma Electrónica</h2>
            <button @click="showSignatureModal = false" class="text-gray-400 hover:text-gray-500 p-1 rounded-full hover:bg-gray-100">
              <XMarkIcon class="h-6 w-6" />
            </button>
          </div>
          <div class="p-4 sm:p-6">
            <ElectronicSignature 
              :user-id="userStore.currentUser.id"
              :initial-show-options="!userStore.currentUser.has_signature"
              @signatureSaved="handleSignatureSaved"
              @cancel="showSignatureModal = false"
            />
          </div>
        </div>
      </div>
    </ModalTransition>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, watch } from "vue";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/vue";
import { EllipsisVerticalIcon, XMarkIcon } from "@heroicons/vue/24/outline";
import { useUserStore } from "@/stores/user";
import { useDynamicDocumentStore } from "@/stores/dynamicDocument";
import { get_request, create_request } from "@/stores/services/request_http";
import { showNotification } from "@/shared/notification_message";
import { showConfirmationAlert } from "@/shared/confirmation_alert";
import {
  showPreviewModal,
  previewDocumentData,
  openPreviewModal,
  downloadFile,
} from "@/shared/document_utils";
import DocumentPreviewModal from "@/components/dynamic_document/common/DocumentPreviewModal.vue";
import DocumentSignaturesModal from "@/components/dynamic_document/common/DocumentSignaturesModal.vue";
import { useRecentViews } from '@/composables/useRecentViews';
import { useRouter } from 'vue-router';
import SignatureModal from "@/components/electronic_signature/SignatureModal.vue";
import ModalTransition from "@/components/layouts/animations/ModalTransition.vue";
import ElectronicSignature from "@/components/electronic_signature/ElectronicSignature.vue";

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
  }
});

// Store instances
const userStore = useUserStore();
const documentStore = useDynamicDocumentStore();
const { registerView } = useRecentViews();
const router = useRouter();

// Reactive state
const documents = ref([]);
const isLoading = ref(false);
const showSignaturesModal = ref(false);
const selectedDocumentId = ref(null);
const showSignatureModal = ref(false);

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
  
  if (props.searchQuery) {
    storeDocuments = storeDocuments.filter(doc => 
      doc.title.toLowerCase().includes(props.searchQuery.toLowerCase())
    );
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

/**
 * Sign a document
 */
const signDocument = async (document) => {
  try {
    const userId = userStore.currentUser.id;
    const userEmail = userStore.currentUser.email;
    
    if (!document.requires_signature) {
      await showNotification("This document does not require signatures", "error");
      return;
    }
    
    const currentUserSignature = document.signatures.find(s => s.signer_email === userEmail);
    
    if (!currentUserSignature) {
      await showNotification("No estás autorizado para firmar este documento", "error");
      return;
    }
    
    if (currentUserSignature.signed) {
      await showNotification("Ya has firmado este documento", "info");
      return;
    }
    
    if (!userStore.currentUser.has_signature) {
      await showNotification("Para firmar documentos necesitas tener una firma registrada.", "info");
      
      const createSignature = await showConfirmationAlert(
        "¿Deseas crear una firma electrónica ahora?",
        "Crear firma electrónica",
        "Crear firma",
        "Cancelar"
      );
      
      if (createSignature) {
        showSignatureModal.value = true;
      } else {
        await showNotification("Necesitas una firma para poder firmar documentos.", "warning");
      }
      return;
    }

    const confirmed = await showConfirmationAlert(
      `¿Estás seguro de que deseas firmar el documento "${document.title}"?`,
      "Confirmar firma digital",
      "Firmar documento",
      "Cancelar"
    );

    if (!confirmed) {
      await showNotification("Operación de firma cancelada", "info");
      return;
    }

    const signUrl = `dynamic-documents/${document.id}/sign/${userId}/`;
    
    try {
      await showNotification("Procesando firma del documento...", "info");
      
      const response = await create_request(signUrl, {});
      
      if (response.status === 200 || response.status === 201) {
        await showNotification(`¡Documento "${document.title}" firmado correctamente!`, "success");
        
        await refreshDocuments();
        await documentStore.init(true);
        
        if (document.id) {
          localStorage.setItem('lastUpdatedDocumentId', document.id.toString());
          documentStore.lastUpdatedDocumentId = document.id;
        }
        
        await showNotification("Redirigiendo al panel de documentos...", "info");
        
        // Use router.push instead of window.location to maintain session state
        router.push('/dynamic_document_dashboard');
      } else {
        throw new Error(`Unexpected server response: ${response.status} ${response.statusText}`);
      }
    } catch (requestError) {
      console.error('Error in HTTP request:', requestError);
      if (requestError.response) {
        console.error('Error response details:', requestError.response.data);
        console.error('HTTP status:', requestError.response.status);
      }
      throw requestError;
    }
  } catch (error) {
    console.error('General error signing document:', error);
    if (error.response) {
      console.error('Error details:', error.response.data);
    }
    await showNotification(`Error al firmar el documento: ${error.message}`, "error");
  }
};

/**
 * Opens the preview modal and registers the document view
 */
const handlePreviewDocument = async (document) => {
  await registerView('document', document.id);
  openPreviewModal(document);
};

/**
 * Shows signatures modal for a document
 */
const viewDocumentSignatures = (document) => {
  if (!document.requires_signature) {
    showNotification('Este documento no requiere firmas', 'warning');
    return;
  }
  
  selectedDocumentId.value = document.id;
  showSignaturesModal.value = true;
};

/**
 * Closes the signatures modal
 */
const closeSignaturesModal = () => {
  showSignaturesModal.value = false;
};

/**
 * Gets the total number of required signatures for the document
 */
const getTotalSignatures = (document) => {
  if (!document.signatures) return 0;
  // Count all required signatures
  return document.signatures.length;
};

/**
 * Gets the number of completed signatures for the document
 */
const getCompletedSignatures = (document) => {
  if (!document.signatures) return 0;
  // Count signatures that are already signed
  return document.signatures.filter(sig => sig.signed).length;
};

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
      fetchDocuments();
    }
  }
);

// Add this function in the script section
const canSignDocument = (document) => {
  // Document must require signatures and be in pending state
  if (!document.requires_signature || document.state !== 'PendingSignatures') {
    return false;
  }
  
  // Must have signatures configured
  if (!document.signatures || document.signatures.length === 0) {
    return false;
  }
  
  // Check if current user has a pending signature
  const userEmail = userStore.currentUser.email;
  
  const userSignature = document.signatures.find(s => s.signer_email === userEmail);
  
  if (!userSignature) {
    return false;
  }
  
  if (userSignature.signed) {
    return false;
  }
  
  return true;
};

/**
 * Downloads the signed document with signatures information
 */
const downloadSignedDocument = async (document) => {
  try {
    console.log('=== DOWNLOADING SIGNED DOCUMENT ===');
    console.log('Document:', {
      id: document.id,
      title: document.title,
      state: document.state,
      signatures: document.signatures
    });

    // Verificar que el documento esté completamente firmado
    if (document.state !== 'FullySigned') {
      console.log('❌ Document is not fully signed');
      showNotification('El documento debe estar completamente firmado para descargarlo', 'warning');
      return;
    }

    // Verificar que el documento tenga firmas
    if (!document.signatures || document.signatures.length === 0) {
      console.log('❌ Document has no signatures');
      showNotification('El documento no tiene firmas registradas', 'warning');
      return;
    }

    // Construir la URL y descargar el archivo
    const url = `dynamic-documents/${document.id}/generate-signatures-pdf/`;
    console.log('Downloading from URL:', url);
    
    // Usar el servicio de descarga
    await downloadFile(url, `firmas_${document.title}.pdf`);
    
    console.log('✅ Document downloaded successfully');
  } catch (error) {
    console.error('❌ Error downloading signed document:', error);
    showNotification('Error al descargar el documento firmado', 'error');
  }
};

// Add handler for signature creation completion
const handleSignatureSaved = async (signatureData) => {
  // Get updated user information from backend
  const updatedUser = await userStore.getUserInfo();
  
  // Update has_signature property immediately in the current user object
  if (userStore.currentUser) {
    userStore.currentUser.has_signature = true;
  }
  
  showNotification("Firma electrónica guardada correctamente", "success");
  
  // Close the modal after a small delay to allow the notification to be visible
  setTimeout(() => {
    showSignatureModal.value = false;
  }, 500);
};

// Add this function in the script section
const downloadPDFDocument = (doc) => {
  documentStore.downloadPDF(doc.id, doc.title);
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