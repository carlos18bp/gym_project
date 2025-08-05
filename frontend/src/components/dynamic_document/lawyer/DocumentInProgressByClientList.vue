<template>
    <!-- Document In Progress -->
    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
      <DocumentCard
        v-for="document in filteredProgressDocuments"
        :key="document.id"
        :document="document"
        :card-type="'lawyer'"
        :card-context="'progress'"
        :highlighted-doc-id="null"
        :status-icon="PencilIcon"
        :status-text="'En Progreso'"
        :status-badge-classes="'bg-blue-100 text-blue-700 border border-blue-200'"
        :document-store="documentStore"
        :user-store="userStore"
        :edit-route="`/dynamic_document_dashboard/document/use/editor/${document.id}/${encodeURIComponent(document.title.trim())}`"
        @refresh="$emit('refresh')"
      />
    </div>
</template>

<script setup>
import { computed, onMounted } from "vue";
import { PencilIcon } from "@heroicons/vue/24/outline";
import { useDynamicDocumentStore } from "@/stores/dynamic_document";
import { useUserStore } from "@/stores/auth/user";
import { DocumentCard } from "@/components/dynamic_document/cards";

const documentStore = useDynamicDocumentStore();
const userStore = useUserStore();

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

const emit = defineEmits(['refresh']);

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

// Use userStore to get the signature
const signature = userStore.userSignature;
</script>
