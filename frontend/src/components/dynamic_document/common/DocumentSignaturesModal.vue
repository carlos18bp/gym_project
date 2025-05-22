<template>
  <div v-if="isVisible" class="fixed inset-0 z-50 flex items-center justify-center">
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
                    document.fully_signed ? 'bg-green-500' : 'bg-yellow-500'
                  ]"
                ></span>
                {{ document.fully_signed ? 'Documento completamente firmado' : 'Pendiente de firmas' }}
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
                  <th class="px-4 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
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
                        signer.signed 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      ]"
                    >
                      {{ signer.signed ? 'Firmado' : 'Pendiente' }}
                    </span>
                  </td>
                  <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                    {{ signer.signed_at ? formatDate(signer.signed_at) : '—' }}
                  </td>
                  <td class="px-4 py-4 whitespace-nowrap text-sm font-medium">
                    <button 
                      v-if="canRemoveSignature(signer)"
                      @click="removeSignature(signer)"
                      class="text-red-600 hover:text-red-900"
                    >
                      Eliminar
                    </button>
                    <span v-else class="text-gray-400">—</span>
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
                        signature.signed 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      ]"
                    >
                      {{ signature.signed ? 'Firmado' : 'Pendiente' }}
                    </span>
                  </td>
                  <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                    {{ signature.signed_at ? formatDate(signature.signed_at) : '—' }}
                  </td>
                  <td class="px-4 py-4 whitespace-nowrap text-sm font-medium">
                    <button 
                      v-if="canRemoveSignature(signature)"
                      @click="removeSignature(signature)"
                      class="text-red-600 hover:text-red-900"
                    >
                      Eliminar
                    </button>
                    <span v-else class="text-gray-400">—</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      <!-- Modal footer -->
      <div class="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end">
        <button 
          @click="close" 
          class="px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400"
        >
          Cerrar
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useDynamicDocumentStore } from "@/stores/dynamicDocument";
import { useUserStore } from "@/stores/user";
import { showConfirmationAlert } from "@/shared/confirmation_alert";
import { showNotification } from "@/shared/notification_message";
import { get_request, delete_request } from "@/stores/services/request_http";

/**
 * DocumentSignaturesModal Component
 * 
 * This component displays a modal with signature information for a document.
 * It allows viewing all signers and, for document creators, removing pending signatures.
 */

const props = defineProps({
  isVisible: Boolean,
  documentId: Number
});

const emit = defineEmits(['close', 'refresh']);

// Store instances
const documentStore = useDynamicDocumentStore();
const userStore = useUserStore();

// Data
const document = ref(null);

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
 * Check if current user can remove this signature
 * @param {Object} signature - The signature record (old or new format)
 * @returns {boolean} - True if can remove
 */
const canRemoveSignature = (signature) => {
  // Only the document creator can remove signatures
  if (!document.value || !userStore.currentUser) return false;
  
  // Check if the document has creator information
  if (document.value.creator) {
    // New format: verify if the current user is the creator
    if (String(document.value.creator.id) !== String(userStore.currentUser.id)) {
      return false;
    }
  } else {
    // Old format: verify if the current user is the creator
    if (document.value.created_by !== userStore.currentUser.id) {
      return false;
    }
  }
  
  // Cannot remove signatures that are already signed
  // New format: signature has signed field
  if ('signed' in signature) {
    return !signature.signed;
  }
  
  return false;
};

/**
 * Remove a signature request
 * @param {Object} signature - The signature to remove (old or new format)
 */
const removeSignature = async (signature) => {
  if (!canRemoveSignature(signature)) return;
  
  // Get the signer ID
  let signerId;
  
  if ('signer_id' in signature) {
    // New format
    signerId = signature.signer_id;
  } else if ('id' in signature) {
    // Old format
    signerId = signature.id;
  } else {
    console.error('Unknown signature format:', signature);
    await showNotification("Error al identificar al firmante", "error");
    return;
  }
  
  const signerName = signature.signer_name || signature.signer_email || 'este firmante';
  
  const confirmed = await showConfirmationAlert(
    `¿Estás seguro de que deseas eliminar esta solicitud de firma para ${signerName}?`,
    "Eliminar solicitud de firma",
    "Eliminar",
    "Cancelar"
  );
  
  if (!confirmed) return;
  
  try {
    console.log(`Removing signature for document ${document.value.id} and user ${signerId}`);
    const response = await delete_request(`dynamic-documents/${document.value.id}/remove-signature/${signerId}/`);
    console.log('Signature removal response:', response);
    
    if (response.status === 200) {
      await showNotification("Solicitud de firma eliminada correctamente", "success");
      
      // Refresh document data
      loadDocumentData();
      
      // Notify parent to refresh document list
      emit('refresh');
    } else {
      throw new Error(`Error removing signature request: ${response.statusText}`);
    }
  } catch (error) {
    console.error("Error removing signature request:", error);
    if (error.response) {
      console.error("Error response data:", error.response.data);
    }
    await showNotification("Error al eliminar la solicitud de firma", "error");
  }
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
    console.log(`Loading document with ID: ${props.documentId}`);
    
    // Get current user ID
    const userId = userStore.currentUser.id;
    console.log('Current user ID:', userId);
    
    // Use the endpoint that returns all document data
    const response = await get_request(`dynamic-documents/user/${userId}/pending-documents-full/`);
    console.log('Response from pending-documents-full endpoint:', response);
    
    if (response.status !== 200) {
      throw new Error(`Error loading documents: ${response.status}`);
    }
    
    // Find the specific document by ID
    const documentData = response.data.find(doc => doc.id === props.documentId);
    
    if (!documentData) {
      console.log('Document not found in response, trying direct API lookup');
      // If not found, try to find directly
      const docResponse = await get_request(`dynamic-documents/${props.documentId}/`);
      console.log('Direct document response:', docResponse);
      
      if (docResponse.status !== 200) {
        throw new Error(`Error loading document: ${docResponse.status}`);
      }
      
      // Assuming the direct API doesn't return signer information in the new format
      // but might return signatures in the old format
      document.value = docResponse.data;
    } else {
      // Use the document found in the new endpoint response
      console.log('Document found in response:', documentData);
      document.value = documentData;
    }
    
    console.log('Document loaded with signatures:', document.value);
  } catch (error) {
    console.error("Error loading document data:", error);
    if (error.response) {
      console.error("Error response data:", error.response.data);
    }
    document.value = null;
    await showNotification("Error al cargar la información de firmas", "error");
  }
};

// Watch for changes in visibility and documentId
watch(() => props.isVisible, (newValue) => {
  if (newValue && props.documentId) {
    loadDocumentData();
  } else {
    document.value = null;
  }
});

watch(() => props.documentId, (newValue) => {
  if (props.isVisible && newValue) {
    loadDocumentData();
  }
});
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