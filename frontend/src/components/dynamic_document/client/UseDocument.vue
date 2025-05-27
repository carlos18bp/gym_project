<template>
  <div class="mt-8 flex flex-wrap gap-6">
    <button
      v-for="document in filteredavailableDocuments"
      :key="document.id"
      @click="openModal(document.id)"
      class="flex items-center gap-3 py-2 px-4 border rounded-xl border-stroke bg-white hover:bg-gray-100"
    >
      <DocumentArrowUpIcon class="size-6 text-secondary" />
      <div class="grid gap-1">
        <span class="text-base font-medium">{{ document.title }}</span>
        <span class="text-sm font-regular text-gray-400">{{
          document.description
        }}</span>
      </div>
      <ChevronRightIcon class="size-6 text-gray-400" />
    </button>

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

const documentStore = useDynamicDocumentStore();
const userStore = useUserStore();
const showUseDocumentModal = ref(false);
const selectedDocumentId = ref(null);

const props = defineProps({
  searchQuery: String,
});

// Retrieve documents in drafted and published from the store, applying the search filter.
const filteredavailableDocuments = computed(() => {
  const allPublishedDocs = documentStore.publishedDocumentsUnassigned;
  return documentStore
    .filteredDocuments(props.searchQuery, "")
    .filter((doc) =>
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
