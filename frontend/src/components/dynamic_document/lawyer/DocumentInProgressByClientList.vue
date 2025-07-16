<template>
    <!-- Document In Progress -->
    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
      <DocumentCard
        v-for="document in filteredProgressDocuments"
        :key="document.id"
        :document="document"
        :menu-options="documentEditingOptions"
        :highlighted-doc-id="null"
        status-text="En Progreso"
        :status-icon="PencilIcon"
        status-badge-classes="bg-blue-100 text-blue-700 border border-blue-200"
        @click="openPreviewModal"
        @menu-action="handleOptionClick"
      />
    </div>
  <!-- Document Preview Modal -->
  <DocumentPreviewModal
    :isVisible="showPreviewModal"
    :documentData="previewDocumentData"
    @close="showPreviewModal = false"
  />
</template>

<script setup>
import { computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { PencilIcon } from "@heroicons/vue/24/outline";
import { useDynamicDocumentStore } from "@/stores/dynamicDocument";
import { useUserStore } from "@/stores/user";
import { DocumentCard } from "@/components/dynamic_document/cards";

import {
  showPreviewModal,
  previewDocumentData,
  openPreviewModal,
} from "@/shared/document_utils";
import DocumentPreviewModal from "@/components/dynamic_document/common/DocumentPreviewModal.vue";

const documentStore = useDynamicDocumentStore();
const userStore = useUserStore();
const router = useRouter();

/**
 * Initializes the document and user stores when the component is mounted.
 */
onMounted(() => {
  documentStore.init();
  userStore.init();
});

const props = defineProps({
  /**
   * Search query used to filter documents.
   * @type {String}
   */
  searchQuery: String,
  /**
   * Selected tags to filter documents.
   * @type {Array}
   */
  selectedTags: {
    type: Array,
    default: () => []
  },
});

/**
 * Computes the list of in-progress documents for the current user based on the search query.
 *
 * @returns {Array} List of documents that are in progress and match the search criteria.
 */
const filteredProgressDocuments = computed(() => {
  const allProgressDocuments = documentStore.progressDocumentsByClient;
  
  // Get selected tag IDs
  const selectedTagIds = props.selectedTags ? props.selectedTags.map(tag => tag.id) : [];
  
  // Apply search and tag filters
  const searchAndTagFiltered = documentStore.filteredDocumentsBySearchAndTags(
    props.searchQuery, 
    userStore, 
    selectedTagIds
  );
  
  // Find intersection between progress docs and filtered docs
  return searchAndTagFiltered.filter((doc) =>
    allProgressDocuments.some((progressDoc) => progressDoc.id === doc.id)
  );
});

/**
 * List of available actions for documents that are being edited.
 */
const documentEditingOptions = [
  { label: "Editar", action: "edit" },
  { label: "Previsualización", action: "preview" },
  { label: "Descargar PDF", action: "downloadPDF" },
  { label: "Descargar Word", action: "downloadWord" },
];

/**
 * Handles user selection of document actions.
 *
 * @param {String} action - The action to perform.
 * @param {Object} document - The document being acted upon.
 */
const handleOptionClick = (action, document) => {
  switch (action) {
    case "edit":
      openEditModal(document);
      break;
    case "preview":
      openPreviewModal(document);
      break;
    case "downloadPDF":
      downloadPDFDocument(document);
      break;
    case "downloadWord":
      downloadWordDocument(document);
      break;
    default:
      console.warn("Unknown action:", action);
  }
};

/**
 * Redirects to the document editor page with the selected document.
 *
 * @param {Object} document - The document to be edited.
 */
const openEditModal = (document) => {
  const encodedTitle = encodeURIComponent(document.title.trim());
  router.push(
    `/dynamic_document_dashboard/document/use/editor/${document.id}/${encodedTitle}`
  );
};

/**
 * Retrieves the client's full name based on their ID.
 *
 * @param {Number} clientId - The ID of the client.
 * @returns {String} The full name of the client or "Desconocido" if not found.
 */
const getClientName = (clientId) => {
  const client = userStore.userById(clientId);
  return client ? `${client.first_name} ${client.last_name}` : "Desconocido";
};

/**
 * Download the document as PDF.
 * @param {Object} doc - The document to download.
 */
 const downloadPDFDocument = (doc) => {
  documentStore.downloadPDF(doc.id, doc.title);
};

/**
 * Download the document as Word.
 * @param {Object} doc - The document to download.
 */
const downloadWordDocument = (doc) => {
  documentStore.downloadWord(doc.id, doc.title);
};

// Use userStore to get the signature
const signature = userStore.userSignature;
</script>
