<template>
  <div class="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    <UseDocumentCard
      v-for="document in filteredavailableDocuments"
      :key="document.id"
      :document="document"
      @click="openModal"
    />

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
import ModalTransition from "@/components/layouts/animations/ModalTransition.vue";
import UseDocumentByClient from "@/components/dynamic_document/client/modals/UseDocumentByClient.vue";
import { computed, ref } from "vue";
import { useDynamicDocumentStore } from "@/stores/dynamicDocument";
import { useUserStore } from '@/stores/user';
import { UseDocumentCard } from "@/components/dynamic_document/cards";

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
