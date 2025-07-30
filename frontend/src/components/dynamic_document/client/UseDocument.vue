<template>
  <div class="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    <UseDocumentCard
      v-for="document in filteredavailableDocuments"
      :key="document.id"
      :document="document"
      :show-menu-options="false"
      @document-created="handleDocumentCreated"
    />
  </div>
</template>

<script setup>
import { computed, ref } from "vue";
import { useDynamicDocumentStore } from "@/stores/dynamic_document";
import { useUserStore } from '@/stores/auth/user';
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
