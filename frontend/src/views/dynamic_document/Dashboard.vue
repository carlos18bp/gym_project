<template>
  <!-- Search bar and filter -->
  <SearchBarAndFilterBy @update:searchQuery="searchQuery = $event">
    <slot></slot>
  </SearchBarAndFilterBy>

  <!-- Main content -->
  <div class="p-10 px-4 sm:px-6 lg:px-8">
    <DocumentsNavigation
      @openNewDocument="showCreateDocumentModal = true"
      @updateCurrentSection="handleSection"
      :role="currentUser.role"
    />

    <!-- Documents for lawyers -->
    <div v-if="currentUser?.role === 'lawyer'">
      <div v-if="currentSection === 'documentFinished'" class="grid grid-cols-4 gap-4">
        <DocumentFinishedByClientList
          :searchQuery="searchQuery"
        />
      </div>
      <div v-if="currentSection === 'documentInProgress'" class="grid grid-cols-4 gap-4">
        <DocumentInProgressByClientList
          :searchQuery="searchQuery"
        />
      </div>
      <div v-if="currentSection === 'default'" class="grid grid-cols-4 gap-4">
        <DocumentListLawyer
          :searchQuery="searchQuery"
        />
      </div>

      <!-- No documents message -->
      <div
        v-if="currentSection === 'default' && filteredDocuments.length === 0"
        class="mt-6 text-center text-gray-400 font-regular"
      >
        <p>No hay documentos disponibles para mostrar.</p>
      </div>
    </div>

    <!-- Documents for clients -->
    <div v-if="currentUser?.role === 'client'">
      <UseDocument
        v-if="currentSection === 'useDocument'"
        :searchQuery="searchQuery"
      ></UseDocument>
      <div class="mt-8 grid grid-cols-4 gap-4">
        <DocumentListClient
          v-if="currentSection === 'default'"
          :searchQuery="searchQuery"
        ></DocumentListClient>
      </div>
    </div>
  </div>

  <!-- Modals -->
  <ModalTransition v-show="showCreateDocumentModal">
    <CreateDocumentByLawyer @close="closeModal" />
  </ModalTransition>
</template>

<script setup>
import { onMounted, computed, ref, watch } from "vue";
import { useUserStore } from "@/stores/user";
import { useDynamicDocumentStore } from "@/stores/dynamicDocument";

// Shared components
import SearchBarAndFilterBy from "@/components/layouts/SearchBarAndFilterBy.vue";
import DocumentsNavigation from "@/components/dynamic_document/layouts/DocumentsNavigation.vue";
import ModalTransition from "@/components/layouts/animations/ModalTransition.vue";

// Client components
import DocumentListClient from "@/components/dynamic_document/client/DocumentListClient.vue";
import UseDocument from "@/components/dynamic_document/client/UseDocument.vue";

// Lawyer components
import DocumentListLawyer from "@/components/dynamic_document/lawyer/DocumentListLawyer.vue";
import DocumentFinishedByClientList from "@/components/dynamic_document/lawyer/DocumentFinishedByClientList.vue";
import DocumentInProgressByClientList from "@/components/dynamic_document/lawyer/DocumentInProgressByClientList.vue";
import CreateDocumentByLawyer from "@/components/dynamic_document/lawyer/modals/CreateDocumentByLawyer.vue";

// Store instances
const userStore = useUserStore();
const documentStore = useDynamicDocumentStore();

// Reactive state
const searchQuery = ref("");
const currentSection = ref("default");
const showCreateDocumentModal = ref(false);

// Get the current user
const currentUser = computed(() => userStore.getCurrentUser);

// Get filtered documents using the store getter, ensuring role-specific documents
const filteredDocuments = computed(() => {
  let allDocuments = [];

  if (currentUser.value?.role === "lawyer") {
    allDocuments = documentStore.draftAndPublishedDocumentsUnassigned;
  } else if (currentUser.value?.role === "client") {
    allDocuments = documentStore.progressAndCompletedDocumentsByClient(
      currentUser.value.id
    );
  }

  return documentStore
    .filteredDocuments(searchQuery.value, userStore)
    .filter((doc) =>
      allDocuments.some((filteredDoc) => filteredDoc.id === doc.id)
    );
});

// Load data when the component is mounted
onMounted(async () => {
  // Initialize store data
  await userStore.init();
  await documentStore.init();
  
  documentStore.selectedDocument = null;
  
  // Make sure we are in the default section when loading
  currentSection.value = "default";
  // Check localStorage for saved document ID to highlight
  const savedId = localStorage.getItem('lastUpdatedDocumentId');
  
  if (savedId) {
    // Only set the ID if that document exists in our store
    const docExists = documentStore.documents.some(doc => doc.id.toString() === savedId);
    
    if (docExists) {
      documentStore.lastUpdatedDocumentId = parseInt(savedId);
    }
  }
});

/**
 * Handles section updates from the navigation.
 *
 * @param {string} message - The selected section name.
 */
const handleSection = (message) => {
  currentSection.value = message;
  // Clear any selected document when changing sections
  documentStore.selectedDocument = null;
};

/**
 * Closes any open modals.
 */
const closeModal = () => {
  showCreateDocumentModal.value = false;
  // Ensure we're showing the default section
  currentSection.value = "default";
  // Clear any selected document
  documentStore.selectedDocument = null;
};

/**
 * Watch for changes in lastUpdatedDocumentId to show document list
 * Only triggers when currentSection is 'default' to avoid UI bugs
 */
watch(
  () => documentStore.lastUpdatedDocumentId,
  (newId, oldId) => {
    if (newId && newId !== oldId && currentSection.value === 'default') {
      // Prevent multiple executions using timestamp check
      const lastExecutionTime = Date.now();
      if (!watch.lastExecutionTime || lastExecutionTime - watch.lastExecutionTime > 100) {
        watch.lastExecutionTime = lastExecutionTime;
        currentSection.value = "default";
      }
    }
  },
  { immediate: false }
);
</script>
