<template>
    <!-- Document Completed -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      <DocumentCard
        v-for="document in filteredCompletedDocuments"
        :key="document.id"
        :document="document"
        :card-type="'lawyer'"
        :card-context="'finished'"
        :highlighted-doc-id="null"
        :status-icon="CheckCircleIcon"
        :status-text="'Completado'"
        :status-badge-classes="'bg-green-100 text-green-700 border border-green-200'"
        :document-store="documentStore"
        :user-store="userStore"
        :edit-route="`/dynamic_document_dashboard/document/use/editor/${document.id}/${encodeURIComponent(document.title.trim())}`"
        @refresh="$emit('refresh')"
      />
    </div>
</template>

<script setup>
import { computed, onMounted } from "vue";
import { CheckCircleIcon } from "@heroicons/vue/24/outline";
import { useDynamicDocumentStore } from "@/stores/dynamicDocument";
import { useUserStore } from "@/stores/user";
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

// Use userStore to get the signature
const signature = userStore.userSignature;
</script>
