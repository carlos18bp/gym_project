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
import { useDynamicDocumentStore } from "@/stores/dynamic_document";
import { useUserStore } from "@/stores/auth/user";
import { showNotification } from "@/shared/notification_message";
import { get_request } from "@/stores/services/request_http";

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