<template>
    <!-- Document Completed -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      <div
        v-for="document in filteredCompletedDocuments"
        :key="document.id"
        class="relative bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 p-4 cursor-pointer focus:outline-none focus:ring-0"
      >
        <!-- Header with status and menu -->
        <div class="flex justify-between items-start mb-3">
          <div class="flex items-center gap-2">
            <!-- Status Badge -->
            <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">
              <CheckCircleIcon class="w-3.5 h-3.5" />
              <span>Completado</span>
            </div>
          </div>
          
          <!-- Menu -->
          <Menu as="div" class="relative inline-block text-left">
            <div>
              <MenuButton class="flex items-center justify-center w-8 h-8 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors focus:outline-none focus:ring-0">
                <span class="sr-only">Open options</span>
                <EllipsisVerticalIcon class="w-5 h-5" aria-hidden="true" />
              </MenuButton>
            </div>
    
            <transition
              enter-active-class="transition ease-out duration-100"
              enter-from-class="transform opacity-0 scale-95"
              enter-to-class="transform opacity-100 scale-100"
              leave-active-class="transition ease-in duration-75"
              leave-from-class="transform opacity-100 scale-100"
              leave-to-class="transform opacity-0 scale-95"
            >
              <MenuItems
                class="absolute right-0 z-10 mt-2 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black/5 focus:outline-none"
              >
                <div class="py-1">
                  <MenuItem
                    v-for="option in documentFinishedOptions"
                    :key="option.label"
                  >
                    <button
                      @click="handleOptionClick(option, document)"
                      class="block w-full text-left px-4 py-2 text-sm font-regular cursor-pointer hover:bg-gray-100 transition focus:outline-none"
                    >
                      {{ option.label }}
                    </button>
                  </MenuItem>
                </div>
              </MenuItems>
            </transition>
          </Menu>
        </div>

        <!-- Document Content -->
        <div class="space-y-2">
          <!-- Title -->
          <h3 class="text-lg font-semibold text-gray-900 leading-tight">
            {{ document.title }}
          </h3>
          
          <!-- Client Name -->
          <p class="text-sm text-gray-600 leading-relaxed">
            Cliente: {{ getClientName(document.assigned_to) }}
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
      </div>
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
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/vue";
import {
  CheckCircleIcon,
  EllipsisVerticalIcon,
} from "@heroicons/vue/24/outline";
import { useDynamicDocumentStore } from "@/stores/dynamicDocument";
import { useUserStore } from "@/stores/user";
import { getAllColors, getColorById } from "@/shared/color_palette";

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
 * Computes the list of completed documents for the current user.
 *
 * @returns {Array} List of completed documents.
 */
const filteredCompletedDocuments = computed(() => {
  const allCompletedDocuments = documentStore.completedDocumentsByClient;
  
  // Get selected tag IDs
  const selectedTagIds = props.selectedTags ? props.selectedTags.map(tag => tag.id) : [];
  
  // Apply search and tag filters
  const searchAndTagFiltered = documentStore.filteredDocumentsBySearchAndTags(
    props.searchQuery, 
    userStore, 
    selectedTagIds
  );
  
  // Find intersection between completed docs and filtered docs
  return searchAndTagFiltered.filter((doc) =>
    allCompletedDocuments.some((progressDoc) => progressDoc.id === doc.id)
  );
});

/**
 * List of available actions for finished documents.
 */
const documentFinishedOptions = [
  { label: "Editar", action: "edit" },
  { label: "Previsualización", action: "preview" },
  { label: "Descargar PDF", action: "downloadPDF" },
  { label: "Descargar Word", action: "downloadWord" },
];

/**
 * Handles user selection of document actions.
 *
 * @param {Object} option - The selected option from the menu.
 * @param {Object} document - The document being acted upon.
 */
const handleOptionClick = (option, document) => {
  switch (option.action) {
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
      console.warn("Unknown action:", option.action);
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
