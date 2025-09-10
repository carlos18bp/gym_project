<template>
  <!-- Available documents -->
  <div v-if="filteredavailableDocuments.length > 0" class="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    <UseDocumentCard
      v-for="document in filteredavailableDocuments"
      :key="document.id"
      :document="document"
      :show-menu-options="true"
      @document-created="handleDocumentCreated"
    />
  </div>

  <!-- Empty state message when no documents are available -->
  <div
    v-else
    class="mt-8 flex flex-col items-center justify-center text-center text-gray-500 w-full p-12 rounded-xl bg-gray-50 border-2 border-dashed border-gray-200"
  >
    <svg 
      class="w-16 h-16 mb-4 text-gray-300"
      fill="none" 
      stroke="currentColor" 
      viewBox="0 0 24 24"
    >
      <path 
        stroke-linecap="round" 
        stroke-linejoin="round" 
        stroke-width="1.5" 
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
    <h3 class="text-lg font-semibold mb-2 text-gray-700">
      No hay plantillas disponibles
    </h3>
    <p class="text-sm mb-4 max-w-md">
      {{ getEmptyStateMessage }}
    </p>
    <div class="flex flex-col sm:flex-row gap-3 mt-2">
      <div class="text-xs text-gray-400 bg-gray-100 px-3 py-2 rounded-lg">
        💡 <strong>Tip:</strong> Las plantillas son creadas por los abogados
      </div>
    </div>
  </div>

  <!-- Global preview modal -->
  <DocumentPreviewModal
    :isVisible="showPreviewModal"
    :documentData="previewDocumentData"
    @close="showPreviewModal = false"
  />
</template>

<script setup>
import { computed, ref } from "vue";
import { useDynamicDocumentStore } from "@/stores/dynamic_document";
import { useUserStore } from '@/stores/auth/user';
import { UseDocumentCard } from "@/components/dynamic_document/cards";
import DocumentPreviewModal from "@/components/dynamic_document/common/DocumentPreviewModal.vue";
import { showPreviewModal, previewDocumentData } from "@/shared/document_utils";

const documentStore = useDynamicDocumentStore();
const userStore = useUserStore();

const props = defineProps({
  searchQuery: String,
  selectedTags: {
    type: Array,
    default: () => []
  },
});

// Retrieve documents in drafted and published from the store, applying the search filter.
const filteredavailableDocuments = computed(() => {
  const allPublishedDocs = documentStore.publishedDocumentsUnassigned;
  
  // Get selected tag IDs
  const selectedTagIds = props.selectedTags ? props.selectedTags.map(tag => tag.id) : [];
  
  // Apply search and tag filters
  const searchAndTagFiltered = documentStore.filteredDocumentsBySearchAndTags(
    props.searchQuery, 
    userStore, 
    selectedTagIds
  );
  
  // Find intersection between published docs and filtered docs
  return searchAndTagFiltered.filter((doc) =>
    allPublishedDocs.some((publishedDoc) => publishedDoc.id === doc.id)
  );
});

// Use userStore to get the signature
const signature = userStore.userSignature;

/**
 * Computed message for empty state based on filters applied
 */
const getEmptyStateMessage = computed(() => {
  const hasSearchQuery = props.searchQuery && props.searchQuery.trim().length > 0;
  const hasTagFilters = props.selectedTags && props.selectedTags.length > 0;
  
  if (hasSearchQuery && hasTagFilters) {
    return 'No se encontraron plantillas que coincidan con tu búsqueda y filtros seleccionados. Intenta ajustar los criterios de búsqueda.';
  } else if (hasSearchQuery) {
    return 'No se encontraron plantillas que coincidan con tu búsqueda. Intenta con otros términos o contacta a tu abogado.';
  } else if (hasTagFilters) {
    return 'No hay plantillas disponibles con las etiquetas seleccionadas. Prueba con otras etiquetas o contacta a tu abogado.';
  } else {
    return 'Actualmente no hay plantillas de documentos jurídicos disponibles para usar. Contacta a tu abogado para que publique plantillas.';
  }
});

/**
 * Handles document creation event from cards
 * @param {Object} data - Data received from the card, may contain updatedDocId
 */
function handleDocumentCreated(data) {
  // Handle document creation if needed (highlighting, navigation, etc.)
  if (data && data.updatedDocId) {
    documentStore.lastUpdatedDocumentId = data.updatedDocId;
    localStorage.setItem('lastUpdatedDocumentId', data.updatedDocId);
    
    // The card already handles navigation/highlighting internally
    // This is just for backup in case we need additional logic
  }
}
</script>
