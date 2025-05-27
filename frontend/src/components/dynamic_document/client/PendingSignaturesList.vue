<template>
  <div>
    <div class="mb-6">
      <h2 class="text-xl font-semibold text-gray-800 mb-4">Documentos pendientes de firma</h2>
      
      <!-- Documents pending signature -->
      <div
        v-for="document in pendingSignatureDocuments"
        :key="document.id"
        :data-document-id="document.id"
        class="flex items-center gap-3 py-4 px-5 border rounded-xl cursor-pointer hover:bg-gray-50 mb-4"
        :class="{
          'border-yellow-400 bg-yellow-300/10': !document.fully_signed,
          'border-stroke shadow-md animate-pulse-highlight': String(document.id) === String(highlightedDocId),
        }"
        @click="handlePreviewDocument(document)"
      >
        <svg 
          class="h-6 w-6 text-yellow-500" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          stroke-width="2" 
          stroke-linecap="round" 
          stroke-linejoin="round"
        >
          <path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
        </svg>
        
        <div class="flex justify-between items-center w-full">
          <div class="grid gap-1">
            <span class="text-base font-medium">{{ document.title }}</span>
            <div class="flex items-center gap-2 text-sm text-gray-500">
              <span>Estado de firmas:</span>
              <span class="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded">
                {{ document.completed_signatures || 0 }}/{{ document.total_signatures || 0 }}
              </span>
            </div>
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
                class="absolute z-10 mt-2 w-56 rounded-md bg-white shadow-lg ring-1 ring-black/5 focus:outline-none right-0 left-auto"
              >
                <div class="py-1">
                  <!-- Preview option -->
                  <MenuItem>
                    <button
                      class="block w-full text-left px-4 py-2 text-sm font-regular hover:bg-gray-100 transition"
                      @click="handlePreviewDocument(document)"
                    >
                      Previsualizar
                    </button>
                  </MenuItem>
                  
                  <!-- Sign document option -->
                  <MenuItem v-slot="{ active }">
                    <button
                      class="block w-full text-left px-4 py-2 text-sm font-regular hover:bg-gray-100 transition text-blue-600"
                      @click.stop.prevent="signDocument(document)"
                    >
                      Firmar documento
                    </button>
                  </MenuItem>
                  
                  <!-- View signatures option -->
                  <MenuItem>
                    <button
                      class="block w-full text-left px-4 py-2 text-sm font-regular hover:bg-gray-100 transition"
                      @click="viewDocumentSignatures(document)"
                    >
                      Ver firmas
                    </button>
                  </MenuItem>
                  
                  <!-- View versions option -->
                  <MenuItem>
                    <button
                      class="block w-full text-left px-4 py-2 text-sm font-regular hover:bg-gray-100 transition"
                      @click="viewDocumentVersions(document)"
                    >
                      Ver versiones
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
        v-if="pendingSignatureDocuments.length === 0 && !isLoading"
        class="mt-6 flex flex-col items-center justify-center text-center text-gray-500 w-full"
      >
        <p class="text-lg font-semibold">
          No tienes documentos pendientes por firmar.
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
    
    <!-- Versions Modal -->
    <DocumentVersionsModal 
      :isVisible="showVersionsModal"
      :documentId="selectedDocumentId"
      @close="closeVersionsModal"
    />
  </div>
</template>

<script setup>
import { computed, ref, onMounted } from "vue";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/vue";
import { EllipsisVerticalIcon } from "@heroicons/vue/24/outline";
import { useUserStore } from "@/stores/user";
import { useDynamicDocumentStore } from "@/stores/dynamicDocument";
import { get_request, create_request } from "@/stores/services/request_http";
import axios from "axios";
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
import DocumentVersionsModal from "@/components/dynamic_document/common/DocumentVersionsModal.vue";
import { useRecentViews } from '@/composables/useRecentViews';

/**
 * PendingSignaturesList Component
 * 
 * This component displays a list of documents pending signature by the current user.
 * It provides functionality to preview documents, view signatures, view versions, and sign documents.
 */

// Store instances
const userStore = useUserStore();
const documentStore = useDynamicDocumentStore();
const { registerView } = useRecentViews();

// Reactive state
const pendingSignatureDocuments = ref([]);
const isLoading = ref(false);
const showSignaturesModal = ref(false);
const showVersionsModal = ref(false);
const selectedDocumentId = ref(null);

/**
 * Computed property for document highlight
 * Returns the ID of the document that should be highlighted based on either store or localStorage
 */
const highlightedDocId = computed(() => {
  const storeId = documentStore.lastUpdatedDocumentId;
  const localId = localStorage.getItem('lastUpdatedDocumentId');
  
  // Verify if storeId exists in filtered documents
  const docExists = storeId && pendingSignatureDocuments.value.some(doc => String(doc.id) === String(storeId));
  
  if (docExists) {
    return storeId;
  } else if (localId) {
    // Verify if localStorage ID exists in filtered documents
    const localDocExists = pendingSignatureDocuments.value.some(doc => String(doc.id) === String(localId));
    return localDocExists ? localId : null;
  }
  
  return null;
});

/**
 * Fetches pending signature documents for the current user
 */
const fetchPendingSignatures = async () => {
  isLoading.value = true;
  try {
    console.log('==== GETTING PENDING DOCUMENTS ====');
    
    // Using the endpoint that requires the userId
    const userId = userStore.currentUser.id;
    console.log('Current user ID:', userId);
    
    const response = await get_request(`dynamic-documents/user/${userId}/pending-documents-full/`);
    
    if (response && response.data) {
      console.log('Pending documents response (status):', response.status);
      console.log('Number of documents received:', response.data.length);
      pendingSignatureDocuments.value = response.data;
      
      if (pendingSignatureDocuments.value.length > 0) {
        console.log('Pending signature documents found:', pendingSignatureDocuments.value.length);
        console.log('First document:', pendingSignatureDocuments.value[0]);
      } else {
        console.log('No pending signature documents found');
      }
    } else {
      console.warn('Response does not contain expected data or format:', response);
      pendingSignatureDocuments.value = [];
    }
  } catch (error) {
    console.error('Error fetching pending signatures:', error);
    if (error.response) {
      console.error('Error details:', error.response.data);
    }
    showNotification('Error al cargar documentos pendientes de firma', 'error');
    pendingSignatureDocuments.value = [];
  } finally {
    isLoading.value = false;
  }
};

/**
 * Refreshes all document data
 */
const refreshDocuments = async () => {
  await fetchPendingSignatures();
};

/**
 * Initializes the component by fetching necessary data
 */
onMounted(async () => {
  await refreshDocuments();
});

/**
 * Formats a date string into a localized format
 * @param {string} dateString - The date string to format
 * @returns {string} - The formatted date string
 */
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

/**
 * Sign a document
 * @param {object} document - The document to sign
 */
const signDocument = async (document) => {
  try {
    console.log('=== STARTING SIGNING PROCESS ===');
    console.log('Document to sign:', document);
    
    // Get current user ID
    const userId = userStore.currentUser.id;
    console.log('Current user ID:', userId);
    
    // Verify if the current user is authorized to sign this document
    const currentUserSigner = document.signers.find(s => s.is_current_user);
    
    if (!currentUserSigner) {
      console.error('Current user not found among document signers');
      await showNotification("No estás autorizado para firmar este documento", "error");
      return;
    }
    
    if (currentUserSigner.signed) {
      console.log('User has already signed this document');
      await showNotification("Ya has firmado este documento", "info");
      return;
    }
    
    // Check if the user has a registered signature
    if (!userStore.currentUser.has_signature) {
      console.log('User has no registered signature.');
      
      // Show informative alert first
      await showNotification("Para firmar documentos necesitas tener una firma registrada.", "info");
      
      // Then ask if they want to create a signature
      setTimeout(async () => {
        try {
          const createSignature = await showConfirmationAlert(
            "¿Deseas crear una firma electrónica ahora?",
            "Crear firma electrónica",
            "Crear firma",
            "Cancelar"
          );
          
          if (createSignature) {
            console.log('User accepted to create a signature. Redirecting...');
            await showNotification("Redirigiendo a la página de creación de firma...", "info");
            // Small pause before redirecting so the user can see the notification
            setTimeout(() => {
              // Redirect to the signature creation page
              window.location.href = '/user/signature';
            }, 1000);
          } else {
            console.log('User canceled signature creation');
            await showNotification("Necesitas una firma para poder firmar documentos.", "warning");
          }
        } catch (error) {
          console.error('Error in confirmation dialog:', error);
          await showNotification("Ocurrió un error. Intenta nuevamente más tarde.", "error");
        }
      }, 500); // Small delay for the notification to show first
      
      return;
    }

    // Show confirmation dialog before signing
    console.log('Showing signature confirmation dialog...');
    const confirmed = await showConfirmationAlert(
      `¿Estás seguro de que deseas firmar el documento "${document.title}"?`,
      "Confirmar firma digital",
      "Firmar documento",
      "Cancelar"
    );

    if (!confirmed) {
      console.log('User canceled document signing');
      await showNotification("Operación de firma cancelada", "info");
      return;
    }

    // Prepare HTTP request
    const signUrl = `dynamic-documents/${document.id}/sign/${userId}/`;
    console.log('Complete signing URL:', signUrl);
    
    try {
      console.log('Sending POST request to backend...');
      await showNotification("Procesando firma del documento...", "info");
      
      // Use create_request which already has CSRF token and base URL configured
      const response = await create_request(signUrl, {});
      
      console.log('Complete server response:', response);
      
      if (response.status === 200 || response.status === 201) {
        console.log('Signing successful!', response.data);
        
        // Show success notification
        await showNotification(`¡Documento "${document.title}" firmado correctamente!`, "success");
        
        // Refresh the list of pending signature documents
        console.log('Refreshing pending documents list...');
        await refreshDocuments();
        
        // Ensure the store is also updated
        console.log('Updating global store...');
        await documentStore.init(true);
        
        // Set the signed document ID for interface updates
        if (document.id) {
          console.log('Saving signed document ID:', document.id);
          localStorage.setItem('lastUpdatedDocumentId', document.id.toString());
          documentStore.lastUpdatedDocumentId = document.id;
        }
        
        // Wait a moment before redirecting to allow updates to complete
        console.log('Scheduling redirect to dashboard...');
        await showNotification("Redirigiendo al panel de documentos...", "info");
        
        setTimeout(() => {
          console.log('Redirecting to documents dashboard...');
          window.location.href = '/dynamic_document_dashboard';
        }, 3000);
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
 * @param {Object} document - The document to preview
 */
const handlePreviewDocument = async (document) => {
  await registerView('document', document.id);
  openPreviewModal(document);
};

/**
 * Shows signatures modal for a document
 * @param {Object} document - The document to view signatures for
 */
const viewDocumentSignatures = (document) => {
  selectedDocumentId.value = document.id;
  showSignaturesModal.value = true;
};

/**
 * Shows versions modal for a document
 * @param {Object} document - The document to view versions for
 */
const viewDocumentVersions = (document) => {
  selectedDocumentId.value = document.id;
  showVersionsModal.value = true;
};

/**
 * Closes the signatures modal
 */
const closeSignaturesModal = () => {
  showSignaturesModal.value = false;
};

/**
 * Closes the versions modal
 */
const closeVersionsModal = () => {
  showVersionsModal.value = false;
};

// Use userStore to get the signature
const signature = userStore.userSignature;
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