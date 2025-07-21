<template>
  <div class="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    <UseDocumentCard
      v-for="document in filteredavailableDocuments"
      :key="document.id"
      :document="document"
      @click="openModal"
    />
  </div>
</template>

<script setup>
import { computed, ref } from "vue";
import { useDynamicDocumentStore } from "@/stores/dynamicDocument";
import { useUserStore } from '@/stores/user';
import { UseDocumentCard } from "@/components/dynamic_document/cards";

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
 * Opens the modal and sets the selected document ID.
 * @param {string|number} documentId - The ID of the document to be used.
 */
function openModal(documentId) {
  // UseDocumentCard handles modal opening internally now
  console.log('Document clicked:', documentId);
}
</script>
