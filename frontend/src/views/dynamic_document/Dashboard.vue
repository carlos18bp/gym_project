<template>
  <!-- Search bar and filter -->
  <SearchBarAndFilterBy @update:searchQuery="searchQuery = $event" />

  <!-- Main content -->
  <div class="pb-10 px-4 sm:px-6 lg:px-8 lg:pt-10">
    <DocumentsNavigation
      @openNewDocument="showCreateDocumentModal = true"
      @updateCurrentSection="handleSection"
      :role="currentUser.role"
    />

    <!-- Documents for lawyers -->
    <div v-if="currentUser?.role === 'lawyer'">
      <DocumentFinishedByClientList
        v-if="currentSection === 'documentFinished'"
        :searchQuery="searchQuery"
      />
      <DocumentInProgressByClientList
        v-if="currentSection === 'documentInProgress'"
        :searchQuery="searchQuery"
      />
      <DocumentListLawyer
        v-if="currentSection === 'default'"
        :searchQuery="searchQuery"
      />

      <!-- No documents message -->
      <div
        v-if="currentSection === 'default' && filteredDocuments.length === 0"
        class="mt-6 text-center text-gray-500"
      >
        <p>No documents available to display.</p>
        <p>Use the "New" button to create a document.</p>
      </div>
    </div>

    <!-- Documents for clients -->
    <div v-if="currentUser?.role === 'client'">
      <UseDocument
        v-if="currentSection === 'useDocument'"
        :searchQuery="searchQuery"
      ></UseDocument>
      <DocumentListClient
        v-if="currentSection === 'default'"
        :searchQuery="searchQuery"
      ></DocumentListClient>
    </div>
  </div>

  <!-- Modals -->
  <ModalTransition v-show="showCreateDocumentModal">
    <CreateDocumentByLawyer @close="closeModal" />
  </ModalTransition>
</template>

<script setup>
import { onMounted, computed, ref } from "vue";
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
  await userStore.setCurrentUser();
  await documentStore.init();
  documentStore.selectedDocument = null;
});

/**
 * Handles section updates from the navigation.
 *
 * @param {string} message - The selected section name.
 */
const handleSection = (message) => {
  currentSection.value = message;
};

/**
 * Closes any open modals.
 */
const closeModal = () => {
  showCreateDocumentModal.value = false;
};
</script>
