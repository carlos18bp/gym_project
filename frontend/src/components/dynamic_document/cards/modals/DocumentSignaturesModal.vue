<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center">
    <div class="absolute inset-0 bg-black opacity-50" @click="close"></div>
    <div class="relative bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
      <!-- Modal header -->
      <div class="px-6 py-4 border-b border-gray-200">
        <h2 class="text-xl font-semibold text-gray-800">Estado de firmas del documento</h2>
        <button 
          @click="close" 
          class="absolute top-4 right-4 text-gray-400 hover:text-gray-500"
        >
          <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      <!-- Modal body -->
      <div class="p-6 overflow-y-auto flex-grow">
        <div v-if="!document" class="text-center py-10">
          <div class="spinner"></div>
          <p class="mt-4 text-gray-500">Cargando información de firmas...</p>
        </div>
        
        <div v-else>
          <div class="mb-4">
            <h3 class="text-lg font-medium text-gray-900">{{ document.title }}</h3>
            <p class="text-sm text-gray-500">
              <span class="inline-flex items-center">
                <span 
                  :class="[
                    'inline-block w-3 h-3 rounded-full mr-2',
                    document.state === 'FullySigned'
                      ? 'bg-green-500'
                      : document.state === 'Rejected'
                        ? 'bg-red-500'
                        : document.state === 'Expired'
                          ? 'bg-gray-400'
                          : 'bg-yellow-500'
                  ]"
                ></span>
                {{
                  document.state === 'FullySigned'
                    ? 'Documento completamente firmado'
                    : document.state === 'Rejected'
                      ? 'Documento rechazado'
                      : document.state === 'Expired'
                        ? 'Documento expirado'
                        : 'Pendiente de firmas'
                }}
              </span>
            </p>
            <p v-if="document.creator" class="text-sm text-gray-500 mt-1">
              Creado por: {{ document.creator.name }} ({{ document.creator.email }})
            </p>
            <p class="text-sm text-gray-500 mt-1">
              Firmas: {{ document.completed_signatures || 0 }}/{{ document.total_signatures || 0 }}
            </p>
          </div>
          
          <div class="mt-6">
            <table class="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th class="px-4 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usuario</th>
                  <th class="px-4 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                  <th class="px-4 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha de firma</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <!-- Si tenemos signers en el nuevo formato, usamos eso -->
                <tr v-for="signer in document.signers || []" :key="'sig_' + signer.signature_id" :class="{'bg-blue-50': signer.is_current_user}">
                  <td class="px-4 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                      <div>
                        <div class="text-sm font-medium text-gray-900 flex items-center">
                          {{ signer.signer_name }}
                          <span v-if="signer.is_current_user" class="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">Tú</span>
                        </div>
                        <div class="text-sm text-gray-500">{{ signer.signer_email }}</div>
                      </div>
                    </div>
                  </td>
                  <td class="px-4 py-4 whitespace-nowrap">
                    <span 
                      :class="[
                        'px-2 inline-flex text-xs leading-5 font-semibold rounded-full',
                        signer.rejected
                          ? 'bg-red-100 text-red-800'
                          : signer.signed 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-yellow-100 text-yellow-800'
                      ]"
                    >
                      {{ signer.rejected ? 'Rechazado' : signer.signed ? 'Firmado' : 'Pendiente' }}
                    </span>
                  </td>
                  <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                    {{ signer.signed_at ? formatDate(signer.signed_at) : (signer.rejected_at ? formatDate(signer.rejected_at) : '—') }}
                  </td>
                </tr>
                
                <!-- Compatibilidad con el formato antiguo -->
                <tr v-if="!document.signers && document.signatures" v-for="signature in document.signatures" :key="'old_' + signature.id">
                  <td class="px-4 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                      <div>
                        <div class="text-sm font-medium text-gray-900">
                          {{ signature.signer_name || signature.signer_email }}
                        </div>
                        <div class="text-sm text-gray-500">{{ signature.signer_email }}</div>
                      </div>
                    </div>
                  </td>
                  <td class="px-4 py-4 whitespace-nowrap">
                    <span 
                      :class="[
                        'px-2 inline-flex text-xs leading-5 font-semibold rounded-full',
                        signature.rejected
                          ? 'bg-red-100 text-red-800'
                          : signature.signed 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-yellow-100 text-yellow-800'
                      ]"
                    >
                      {{ signature.rejected ? 'Rechazado' : signature.signed ? 'Firmado' : 'Pendiente' }}
                    </span>
                  </td>
                  <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                    {{ signature.signed_at ? formatDate(signature.signed_at) : (signature.rejected_at ? formatDate(signature.rejected_at) : '—') }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      <!-- Modal footer -->
      <div class="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
        <div class="flex gap-3">
          <!-- Firmar documento button - only show if user can sign -->
          <button
            v-if="canCurrentUserSign"
            @click="handleSignDocument"
            class="px-4 py-2 bg-green-600 text-white hover:bg-green-700 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors"
          >
            Firmar documento
          </button>
          <!-- Rechazar documento button - only show if user can sign -->
          <button
            v-if="canCurrentUserSign"
            @click="openRejectModal"
            class="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors"
          >
            Rechazar documento
          </button>
        </div>
        <button 
          @click="close" 
          class="px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400"
        >
          Cerrar
        </button>
      </div>
    </div>

    <!-- Reject Document Modal -->
    <div
      v-if="showRejectModal"
      class="fixed inset-0 z-[60] flex items-center justify-center bg-black/40"
    >
      <div class="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
        <div class="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h2 class="text-sm font-semibold text-gray-900">Rechazar documento</h2>
          <button
            type="button"
            class="p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            @click="closeRejectModal"
          >
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="px-4 py-4 space-y-3 text-sm text-gray-700">
          <p>
            Estás a punto de rechazar el documento
            <span class="font-semibold">"{{ document?.title }}"</span>.
          </p>
          <p class="text-xs text-gray-500">
            El rechazo devolverá el documento al abogado creador para que pueda revisarlo, editarlo o archivarlo.
          </p>
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">
              Motivo del rechazo (opcional)
            </label>
            <textarea
              v-model="rejectComment"
              rows="4"
              class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-secondary focus:border-transparent resize-none"
              placeholder="Describe brevemente por qué no estás de acuerdo con el documento..."
            ></textarea>
          </div>
        </div>
        <div class="px-4 py-3 border-t border-gray-100 flex justify-end gap-2 bg-gray-50">
          <button
            type="button"
            class="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-100"
            @click="closeRejectModal"
          >
            Cancelar
          </button>
          <button
            type="button"
            class="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
            @click="confirmRejectDocument"
          >
            Rechazar documento
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed } from 'vue';
import { useDynamicDocumentStore } from "@/stores/dynamic_document";
import { useUserStore } from "@/stores/auth/user";
import { showNotification } from "@/shared/notification_message";
import { showConfirmationAlert } from "@/shared/confirmation_alert";
import { get_request, create_request } from "@/stores/services/request_http";
import { registerUserActivity, ACTION_TYPES } from "@/stores/dashboard/activity_feed";

/**
 * DocumentSignaturesModal Component
 * 
 * This component displays a modal with signature information for a document.
 */

const props = defineProps({
  documentId: Number
});

const emit = defineEmits(['close', 'refresh']);

// Store instances
const documentStore = useDynamicDocumentStore();
const userStore = useUserStore();

// Data
const document = ref(null);
const showRejectModal = ref(false);
const rejectComment = ref('');

// Computed
const canCurrentUserSign = computed(() => {
  if (!document.value || !document.value.requires_signature || document.value.state !== 'PendingSignatures') {
    return false;
  }
  
  if (!document.value.signers || document.value.signers.length === 0) {
    return false;
  }
  
  const currentUserSigner = document.value.signers.find(s => s.is_current_user);
  
  if (!currentUserSigner || currentUserSigner.signed) {
    return false;
  }
  
  return true;
});

// Methods
/**
 * Close the modal and emit close event
 */
const close = () => {
  emit('close');
};

/**
 * Format date string
 * @param {string} dateString - The date string to format
 * @returns {string} - Formatted date
 */
const formatDate = (dateString) => {
  if (!dateString) return '—';
  
  const date = new Date(dateString);
  return date.toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * Load document data with signatures
 */
const loadDocumentData = async () => {
  if (!props.documentId) {
    console.error('No document ID provided');
    return;
  }
  
  try {
    // Get current user ID
    const userId = userStore.currentUser.id;
    
    // Use the endpoint that returns all document data
    const response = await get_request(`dynamic-documents/user/${userId}/pending-documents-full/`);
    
    if (response.status !== 200) {
      throw new Error(`Error loading documents: ${response.status}`);
    }
    
    // Find the specific document by ID
    const documentData = response.data.find(doc => doc.id === props.documentId);
    
    if (!documentData) {
      // If not found, try to find directly
      const docResponse = await get_request(`dynamic-documents/${props.documentId}/`);
      
      if (docResponse.status !== 200) {
        throw new Error(`Error loading document: ${docResponse.status}`);
      }
      
      // Assuming the direct API doesn't return signer information in the new format
      // but might return signatures in the old format
      document.value = docResponse.data;
    } else {
      // Use the document found in the new endpoint response
      document.value = documentData;
    }
  } catch (error) {
    console.error("Error loading document data:", error);
    if (error.response) {
      console.error("Error response data:", error.response.data);
    }
    document.value = null;
    await showNotification("Error al cargar la información de firmas", "error");
  }
};

// Watch for changes in documentId and load data immediately
watch(() => props.documentId, (newValue) => {
  if (newValue) {
    loadDocumentData();
  }
}, { immediate: true });

// Watch for changes in the document store to refresh data
watch(() => documentStore.documents, () => {
  // Refresh document data when store updates
  if (props.documentId) {
    loadDocumentData();
  }
}, { deep: true });

/**
 * Handle sign document action
 */
const handleSignDocument = async () => {
  try {
    const userId = userStore.currentUser.id;
    
    if (!userStore.currentUser.has_signature) {
      await showNotification("Para firmar documentos necesitas tener una firma registrada.", "info");
      
      const createSignature = await showConfirmationAlert(
        "¿Deseas crear una firma electrónica ahora?"
      );
      
      if (createSignature) {
        emit('open-electronic-signature');
      } else {
        await showNotification("Necesitas una firma para poder firmar documentos.", "warning");
      }
      return;
    }

    const confirmed = await showConfirmationAlert(
      `¿Estás seguro de que deseas firmar el documento "${document.value.title}"?`
    );

    if (!confirmed) {
      await showNotification("Operación de firma cancelada", "info");
      return;
    }
    
    const signUrl = `dynamic-documents/${document.value.id}/sign/${userId}/`;
    
    await showNotification("Procesando firma del documento...", "info");
    
    const response = await create_request(signUrl, {});
    
    if (response.status === 200 || response.status === 201) {
      await showNotification(`¡Documento "${document.value.title}" firmado correctamente!`, "success");

      // Register activity for document signing
      try {
        await registerUserActivity(
          ACTION_TYPES.FINISH,
          `Firmaste el documento "${document.value.title}"`
        );
      } catch (activityError) {
        console.warn('No se pudo registrar la actividad de firma:', activityError);
      }

      // Refresh document data
      await loadDocumentData();
      emit('refresh');
    } else {
      throw new Error(`Unexpected server response: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.error('Error signing document:', error);
    await showNotification(`Error al firmar el documento: ${error.message}`, "error");
  }
};

/**
 * Open reject modal
 */
const openRejectModal = () => {
  rejectComment.value = '';
  showRejectModal.value = true;
};

/**
 * Close reject modal
 */
const closeRejectModal = () => {
  showRejectModal.value = false;
  rejectComment.value = '';
};

/**
 * Confirm reject document
 */
const confirmRejectDocument = async () => {
  if (!document.value) {
    return;
  }
  try {
    const userId = userStore.currentUser.id;
    const url = `dynamic-documents/${document.value.id}/reject/${userId}/`;
    const payload = rejectComment.value ? { comment: rejectComment.value } : {};
    const response = await create_request(url, payload);
    if (response && (response.status === 200 || response.status === 201)) {
      await showNotification('Documento rechazado correctamente.', 'success');
      // Register activity for rejection
      try {
        await registerUserActivity(
          ACTION_TYPES.FINISH,
          `Rechazaste el documento "${document.value.title}"`
        );
      } catch (activityError) {
        console.warn('No se pudo registrar la actividad de rechazo:', activityError);
      }
      closeRejectModal();
      close();
      emit('refresh');
    } else {
      await showNotification('Error al rechazar el documento.', 'error');
    }
  } catch (error) {
    console.error('Error rejecting document:', error);
    await showNotification('Error al rechazar el documento.', 'error');
  }
};
</script>

<style scoped>
.spinner {
  border: 3px solid rgba(0, 0, 0, 0.1);
  border-radius: 50%;
  border-top: 3px solid #3498db;
  width: 30px;
  height: 30px;
  animation: spin 1s linear infinite;
  margin: 0 auto;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style> 