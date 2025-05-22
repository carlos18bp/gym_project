<template>
  <div v-if="isVisible" class="fixed inset-0 z-50 flex items-center justify-center">
    <div class="absolute inset-0 bg-black opacity-50" @click="close"></div>
    <div class="relative bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
      <!-- Modal header -->
      <div class="px-6 py-4 border-b border-gray-200">
        <h2 class="text-xl font-semibold text-gray-800">Versiones del documento</h2>
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
        <div v-if="loading" class="text-center py-10">
          <div class="spinner"></div>
          <p class="mt-4 text-gray-500">Cargando versiones del documento...</p>
        </div>
        
        <div v-else-if="!versions.length" class="text-center py-10">
          <svg class="h-12 w-12 mx-auto text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p class="mt-4 text-gray-500">No hay versiones disponibles para este documento.</p>
        </div>
        
        <div v-else>
          <div class="mb-4">
            <h3 class="text-lg font-medium text-gray-900">{{ documentTitle }}</h3>
            <p class="text-sm text-gray-500">Este documento tiene {{ versions.length }} versiones disponibles.</p>
          </div>
          
          <div class="mt-6">
            <table class="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th class="px-4 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Versión</th>
                  <th class="px-4 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                  <th class="px-4 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha de creación</th>
                  <th class="px-4 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Firmado por</th>
                  <th class="px-4 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acción</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr v-for="version in sortedVersions" :key="version.id">
                  <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    {{ version.version_type === 'original' ? 'Original' : 'v' + version.version_number }}
                  </td>
                  <td class="px-4 py-4 whitespace-nowrap">
                    <span 
                      :class="[
                        'px-2 inline-flex text-xs leading-5 font-semibold rounded-full',
                        version.version_type === 'original' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-green-100 text-green-800'
                      ]"
                    >
                      {{ version.version_display }}
                    </span>
                  </td>
                  <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                    {{ formatDate(version.created_at) }}
                  </td>
                  <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                    {{ version.signed_by || '—' }}
                  </td>
                  <td class="px-4 py-4 whitespace-nowrap text-sm font-medium">
                    <a 
                      v-if="version.file_url"
                      :href="version.file_url" 
                      target="_blank"
                      class="text-indigo-600 hover:text-indigo-900"
                    >
                      Descargar
                    </a>
                    <span v-else class="text-gray-400">No disponible</span>
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
import { ref, computed, watch } from 'vue';
import { useDynamicDocumentStore } from "@/stores/dynamicDocument";
import { showNotification } from "@/shared/notification_message";
import { get_request } from "@/stores/services/request_http";

/**
 * DocumentVersionsModal Component
 * 
 * This component displays a modal with all versions of a document.
 * It shows information such as version number, type, creation date, and signed by who.
 * It also provides download links for each version.
 */

const props = defineProps({
  isVisible: Boolean,
  documentId: Number
});

const emit = defineEmits(['close']);

// Store instances
const documentStore = useDynamicDocumentStore();

// Data
const versions = ref([]);
const loading = ref(false);
const documentTitle = ref('');

/**
 * Computed property to sort versions
 * Original version first, then by version number
 */
const sortedVersions = computed(() => {
  // Sort versions: original first, then by version number
  return [...versions.value].sort((a, b) => {
    if (a.version_type === 'original' && b.version_type !== 'original') {
      return -1;
    }
    if (a.version_type !== 'original' && b.version_type === 'original') {
      return 1;
    }
    return a.version_number - b.version_number;
  });
});

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
 * Load document versions data
 * Fetches both document metadata and all available versions
 */
const loadVersionsData = async () => {
  if (!props.documentId) {
    console.error('No document ID provided');
    return;
  }
  
  loading.value = true;
  
  try {
    console.log(`Loading versions for document ID: ${props.documentId}`);
    
    // Get document info first to get the title
    let docData = documentStore.documentById(props.documentId);
    
    if (!docData) {
      console.log('Document not in store cache, fetching from API');
      const docResponse = await get_request(`dynamic-documents/${props.documentId}/`);
      console.log('Document response:', docResponse);
      
      if (docResponse.status !== 200) {
        throw new Error(`Error loading document: ${docResponse.status}`);
      }
      
      documentTitle.value = docResponse.data.title;
    } else {
      console.log('Document found in store cache:', docData);
      documentTitle.value = docData.title;
    }
    
    // Get versions
    console.log(`Fetching versions for document: ${props.documentId}`);
    const response = await get_request(`dynamic-documents/${props.documentId}/versions/`);
    console.log('Versions response:', response);
    
    if (response.status === 200) {
      versions.value = response.data;
      console.log('Versions loaded:', versions.value);
    } else {
      throw new Error(`Error loading document versions: ${response.status}`);
    }
  } catch (error) {
    console.error("Error loading document versions:", error);
    if (error.response) {
      console.error("Error response data:", error.response.data);
    }
    versions.value = [];
    await showNotification("Error al cargar las versiones del documento", "error");
  } finally {
    loading.value = false;
  }
};

// Watch for changes in visibility and documentId
watch(() => props.isVisible, (newValue) => {
  if (newValue && props.documentId) {
    loadVersionsData();
  } else {
    versions.value = [];
    documentTitle.value = '';
  }
});

watch(() => props.documentId, (newValue) => {
  if (props.isVisible && newValue) {
    loadVersionsData();
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