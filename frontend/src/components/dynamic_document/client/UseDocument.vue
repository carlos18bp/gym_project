<template>
  <div class="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    <div
      v-for="document in filteredavailableDocuments"
      :key="document.id"
      @click="openModal(document.id)"
      class="relative bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 p-4 cursor-pointer group"
    >
      <!-- Header with status -->
      <div class="flex justify-between items-start mb-3">
        <div class="flex items-center gap-2">
          <!-- Status Badge -->
          <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">
            <DocumentArrowUpIcon class="w-3.5 h-3.5" />
            <span>Disponible</span>
          </div>
        </div>
        
        <!-- Arrow Icon -->
        <ChevronRightIcon class="w-5 h-5 text-gray-400 group-hover:text-gray-600 transition-colors" />
      </div>

      <!-- Document Content -->
      <div class="space-y-2">
        <!-- Title -->
        <h3 class="text-lg font-semibold text-gray-900 leading-tight">
          {{ document.title }}
        </h3>
        
        <!-- Description -->
        <p v-if="document.description" class="text-sm text-gray-600 leading-relaxed">
          {{ document.description }}
        </p>
        
        <!-- Tags Section -->
        <div v-if="document.tags && document.tags.length > 0" class="pt-2">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-xs font-medium text-gray-500">Etiquetas:</span>
            <div class="flex items-center gap-1.5">
              <div 
                v-for="tag in document.tags" 
                :key="tag.id"
                class="group relative"
              >
                <div 
                  class="w-5 h-5 rounded-full cursor-pointer transition-all duration-200 hover:scale-110 hover:ring-2 hover:ring-offset-1 shadow-sm"
                  :style="{ 
                    backgroundColor: getColorById(tag.color_id)?.hex || '#9CA3AF',
                    boxShadow: `0 0 0 1px ${getColorById(tag.color_id)?.dark || '#6B7280'}40`
                  }"
                  :title="tag.name"
                ></div>
                
                <!-- Tooltip -->
                <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-50">
                  <div class="bg-gray-900 text-white text-xs rounded-lg py-1.5 px-2.5 whitespace-nowrap shadow-lg">
                    {{ tag.name }}
                    <div class="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[4px] border-r-[4px] border-t-[4px] border-transparent border-t-gray-900"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Click to use indicator -->
      <div class="mt-3 pt-2 border-t border-gray-100">
        <div class="flex items-center gap-2 text-xs text-gray-500">
          <div class="w-2 h-2 bg-blue-500 rounded-full"></div>
          <span>Hacer clic para usar este documento</span>
        </div>
      </div>
    </div>

    <!-- Modal -->
    <ModalTransition v-show="showUseDocumentModal">
      <UseDocumentByClient
        :document-id="selectedDocumentId"
        v-if="selectedDocumentId !== null"
        @close="closeModal"
      />
    </ModalTransition>
  </div>
</template>

<script setup>
import {
  ChevronRightIcon,
  DocumentArrowUpIcon,
} from "@heroicons/vue/24/outline";
import ModalTransition from "@/components/layouts/animations/ModalTransition.vue";
import UseDocumentByClient from "@/components/dynamic_document/client/modals/UseDocumentByClient.vue";
import { computed, ref } from "vue";
import { useDynamicDocumentStore } from "@/stores/dynamicDocument";
import { useUserStore } from '@/stores/user';
import { getAllColors, getColorById } from "@/shared/color_palette";

const documentStore = useDynamicDocumentStore();
const userStore = useUserStore();
const showUseDocumentModal = ref(false);
const selectedDocumentId = ref(null);

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
 * Opens the modal and sets the selected document ID.
 *
 * @param {string|number} documentId - The ID of the document to be used.
 */
function openModal(documentId) {
  if (documentId) {
    selectedDocumentId.value = documentId;
    showUseDocumentModal.value = true;
  }
}

/**
 * Close the modal and clear the selected document.
 * Also handles visual highlighting of updated documents if necessary.
 * 
 * @param {Object} data - Data received from the modal, may contain updatedDocId
 */
const closeModal = (data) => {
  showUseDocumentModal.value = false;
  selectedDocumentId.value = null;
  
  // If we receive an updated document ID, update lastUpdatedDocumentId
  if (data && data.updatedDocId) {
    documentStore.lastUpdatedDocumentId = data.updatedDocId;
    localStorage.setItem('lastUpdatedDocumentId', data.updatedDocId);
    
    // Check if we're already on the dashboard page
    const currentPath = window.location.pathname;
    const isDashboard = currentPath === '/dynamic_document_dashboard' || 
                        currentPath === '/dynamic_document_dashboard/';
    
    if (!isDashboard) {
      // Only redirect if we're not already on the dashboard
      setTimeout(() => {
        window.location.href = '/dynamic_document_dashboard';
      }, 500);
    } else {
      // No need to redirect, just force a highlight
      setTimeout(() => {
        // Trigger a highlight effect using the global function
        if (window.forceDocumentHighlight) {
          window.forceDocumentHighlight(data.updatedDocId);
        }
      }, 100);
    }
  }
};
</script>
