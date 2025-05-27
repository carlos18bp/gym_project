<template>
  <div>
    <div class="mb-6">
      <h2 class="text-xl font-semibold text-gray-800 mb-4">Documentos firmados por ti</h2>
      
      <!-- Signed Documents -->
      <div
        v-for="document in signedDocuments"
        :key="document.id"
        :data-document-id="document.id"
        class="flex items-center gap-3 py-2 px-4 border rounded-xl cursor-pointer mb-3 border-green-400 bg-green-300/10"
        @click="(e) => {
          // Only trigger preview if click was not on the menu
          if (!e.target.closest('.menu-container')) {
            handlePreviewDocument(document);
          }
        }"
      >
        <svg 
          class="h-6 w-6 text-green-500" 
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
        
        <div class="flex justify-between items-center w-full">
          <div class="grid gap-1">
            <div class="flex items-center">
              <span class="text-base font-medium">{{ document.title }}</span>
              <span v-if="document.pending_signatures > 0" class="bg-yellow-100 text-yellow-800 text-xs font-medium px-2 py-0.5 rounded ml-2">
                Pendiente: {{ document.pending_signatures }}/{{ document.total_signatures }}
              </span>
              <span v-else class="bg-green-100 text-green-800 text-xs font-medium px-2 py-0.5 rounded ml-2">
                Completado
              </span>
            </div>
            <span class="text-sm font-regular text-gray-400">
              Firmado el {{ formatDate(document.user_signed_at) }}
            </span>
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
                  <!-- Preview option -->
                  <MenuItem>
                    <button
                      class="block w-full text-left px-4 py-2 text-sm font-regular hover:bg-gray-100 transition"
                      @click="handlePreviewDocument(document)"
                    >
                      Previsualizar
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
                  
                  <!-- Download latest version -->
                  <MenuItem v-if="document.versions && document.versions.length > 0">
                    <button
                      class="block w-full text-left px-4 py-2 text-sm font-regular hover:bg-gray-100 transition"
                      @click="downloadLatestVersion(document)"
                    >
                      Descargar PDF firmado
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
        v-if="signedDocuments.length === 0 && !isLoading"
        class="mt-6 flex flex-col items-center justify-center text-center text-gray-500 w-full"
      >
        <p class="text-lg font-semibold">
          No tienes documentos firmados.
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
import { ref, onMounted } from "vue";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/vue";
import { EllipsisVerticalIcon } from "@heroicons/vue/24/outline";
import { useUserStore } from "@/stores/user";
import { useDynamicDocumentStore } from "@/stores/dynamicDocument";
import { get_request } from "@/stores/services/request_http";
import { showNotification } from "@/shared/notification_message";
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

// Store instances
const userStore = useUserStore();
const documentStore = useDynamicDocumentStore();
const { registerView } = useRecentViews();

// Reactive state
const signedDocuments = ref([]);
const isLoading = ref(false);
const showSignaturesModal = ref(false);
const showVersionsModal = ref(false);
const selectedDocumentId = ref(null);

/**
 * Fetches signed documents for the current user
 */
const fetchSignedDocuments = async () => {
  isLoading.value = true;
  try {
    console.log('==== GETTING SIGNED DOCUMENTS ====');
    
    // Using the endpoint for signed documents
    const userId = userStore.currentUser.id;
    console.log('Current user ID:', userId);
    
    const response = await get_request(`dynamic-documents/user/${userId}/signed-documents/`);
    
    if (response && response.data) {
      console.log('Number of signed documents received:', response.data.length);
      signedDocuments.value = response.data;
      
      if (signedDocuments.value.length > 0) {
        console.log('Signed documents found:', signedDocuments.value.length);
      } else {
        console.log('No signed documents found');
      }
    } else {
      console.warn('Response does not contain expected data or format:', response);
      signedDocuments.value = [];
    }
  } catch (error) {
    console.error('Error fetching signed documents:', error);
    if (error.response) {
      console.error('Error details:', error.response.data);
    }
    showNotification('Error al cargar documentos firmados', 'error');
    signedDocuments.value = [];
  } finally {
    isLoading.value = false;
  }
};

/**
 * Refreshes all document data
 */
const refreshDocuments = async () => {
  await fetchSignedDocuments();
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

/**
 * Downloads the latest version of a signed document
 * @param {Object} document - The document to download
 */
const downloadLatestVersion = async (document) => {
  try {
    if (!document.versions || document.versions.length === 0) {
      await showNotification("No hay versiones disponibles para este documento", "error");
      return;
    }
    
    // Sort versions by creation date (newest first)
    const sortedVersions = [...document.versions].sort((a, b) => 
      new Date(b.created_at) - new Date(a.created_at)
    );
    
    // Find the latest signed version
    const signedVersion = sortedVersions.find(v => v.version_type === 'signed');
    
    if (signedVersion) {
      await showNotification("Descargando documento firmado...", "info");
      await downloadFile(signedVersion.file_url, `${document.title}_firmado.pdf`);
    } else {
      // If no signed version, download the original
      const originalVersion = sortedVersions[0];
      await showNotification("Descargando documento original...", "info");
      await downloadFile(originalVersion.file_url, `${document.title}.pdf`);
    }
  } catch (error) {
    console.error('Error downloading document:', error);
    await showNotification("Error al descargar el documento", "error");
  }
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