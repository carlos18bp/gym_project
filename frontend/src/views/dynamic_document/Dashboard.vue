<template>
  <!-- Search bar and filter -->
  <SearchBarAndFilterBy @update:searchQuery="searchQuery = $event">
    <slot></slot>
  </SearchBarAndFilterBy>

  <!-- Main content -->
  <div class="p-4 sm:p-6 lg:p-10 lg:px-8">
    <DocumentsNavigation
      @openNewDocument="showCreateDocumentModal = true"
      @updateCurrentSection="handleSection"
      :role="currentUser.role"
    />

    <!-- Documents for lawyers -->
    <div v-if="currentUser?.role === 'lawyer'" class="mt-6">
      <div v-if="currentSection === 'documentFinished'" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        <DocumentFinishedByClientList
          :searchQuery="searchQuery"
        />
      </div>
      <div v-if="currentSection === 'documentInProgress'" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        <DocumentInProgressByClientList
          :searchQuery="searchQuery"
        />
      </div>
      <div v-if="currentSection === 'default'" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
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
    <div v-if="currentUser?.role === 'client'" class="mt-6">
      <!-- Navigation tabs -->
      <div class="mb-6 border-b border-gray-200">
        <nav class="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            v-for="tab in navigationTabs"
            :key="tab.name"
            @click="activeTab = tab.name"
            :class="[
              activeTab === tab.name
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
              'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm'
            ]"
          >
            {{ tab.label }}
          </button>
        </nav>
      </div>

      <!-- Tab content -->
      <UseDocument
        v-if="currentSection === 'useDocument'"
        :searchQuery="searchQuery"
      ></UseDocument>
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        <PendingSignaturesList 
          v-if="activeTab === 'pending-signatures'"
          @refresh="handleRefresh"
        />
        <DocumentListClient
          v-if="activeTab === 'my-documents'"
          :searchQuery="searchQuery"
        ></DocumentListClient>
        <SignedDocumentsList
          v-if="activeTab === 'signed-documents'"
          :searchQuery="searchQuery"
        />
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
import PendingSignaturesList from "@/components/dynamic_document/client/PendingSignaturesList.vue";
import SignedDocumentsList from '@/components/dynamic_document/client/SignedDocumentsList.vue';

// Store instances
const userStore = useUserStore();
const documentStore = useDynamicDocumentStore();

// Reactive state
const searchQuery = ref("");
const currentSection = ref("default");
const showCreateDocumentModal = ref(false);
const activeTab = ref('my-documents');

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
 * Handles refresh events from child components.
 */
const handleRefresh = async () => {
  console.log('Refrescando datos en Dashboard');
  await documentStore.init(true);
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

// Navigation tabs for client users
const navigationTabs = [
  { name: 'my-documents', label: 'Mis Documentos' },
  { name: 'pending-signatures', label: 'Firmas Pendientes' },
  { name: 'signed-documents', label: 'Documentos Firmados' }
];
</script>
