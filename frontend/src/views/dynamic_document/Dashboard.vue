<template>
  <!-- Search bar and filter component -->
  <SearchBarAndFilterBy @update:searchQuery="searchQuery = $event">
    <template #auxiliary_button>
      <button
        v-if="currentUser?.role === 'lawyer'"
        class="p-2.5 text-sm font-medium rounded-md flex gap-2 bg-secondary text-white"
        @click="showCreateDocumentModal = true"
      >
        <div class="flex gap-1 items-center">
          <PlusIcon class="text-white font-bold size-6"></PlusIcon>
          <span>Nuevo</span>
        </div>
      </button>
    </template>
  </SearchBarAndFilterBy>

  <!-- Main content -->
  <div class="pb-10 px-4 sm:px-6 lg:px-8 lg:pt-10">
    <DocumentsNavigation
      @openNewDocument="showCreateDocumentModal = true"
      @updateCurrentSection="handleSection"
      :role="currentUser.role"
    />

    <!-- Documents sections for lawyers -->
    <div v-if="currentUser?.role === 'lawyer'">
      <DocumentFinishedByClientList v-if="currentSection === 'documentFinished'" />
      <DocumentInProgressByClientList v-if="currentSection === 'documentInProgress'" />
      <DocumentListLawyer v-if="currentSection === 'default'" :documents="documents" />

      <!-- No documents message -->
      <div v-if="currentSection === 'default' && documents.length === 0" class="mt-6 text-center text-gray-500">
        <p>No hay documentos disponibles para mostrar.</p>
        <p>Utiliza el botón "Nuevo" para crear un documento.</p>
      </div>
    </div>

    <!-- Documents section for clients -->
    <div v-if="currentUser?.role === 'client'">
        <UseDocument v-if="currentSection === 'useDocument'"></UseDocument>
        <DocumentListClient v-if="currentSection === 'default'"></DocumentListClient>
    </div>
  </div>

  <!-- Modals -->
  <ModalTransition v-show="showCreateDocumentModal">
    <CreateDocumentByLawyer @close="closeModal" />
  </ModalTransition>

  <ModalTransition v-show="showSendDocumentViaEmailModal">
    <SendDocument @close="closeModal" />
  </ModalTransition>
</template>

<script setup>
// Icons
import { PlusIcon } from "@heroicons/vue/24/outline";

// Shared components
import SearchBarAndFilterBy from "@/components/layouts/SearchBarAndFilterBy.vue";
import DocumentsNavigation from "@/components/dynamic_document/layouts/DocumentsNavigation.vue";
import SendDocument from "@/components/dynamic_document/layouts/modals/SendDocument.vue";
import ModalTransition from "@/components/layouts/animations/ModalTransition.vue";

// Client components
import DocumentListClient from "@/components/dynamic_document/client/DocumentListClient.vue";
import UseDocument from "@/components/dynamic_document/client/UseDocument.vue"

// Lawyer components
import DocumentListLawyer from "@/components/dynamic_document/lawyer/DocumentListLawyer.vue";
import DocumentFinishedByClientList from "@/components/dynamic_document/lawyer/DocumentFinishedByClientList.vue";
import DocumentInProgressByClientList from "@/components/dynamic_document/lawyer/DocumentInProgressByClientList.vue";
import CreateDocumentByLawyer from "@/components/dynamic_document/lawyer/modals/CreateDocumentByLawyer.vue";

// Instances
import { useUserStore } from "@/stores/user";
import { useDynamicDocumentStore } from "@/stores/dynamicDocument";
import { onMounted, computed, ref } from "vue";

// Store references
const userStore = useUserStore();
const documentStore = useDynamicDocumentStore();

// Computed property to get the current authenticated user
const currentUser = computed(() => userStore.getCurrentUser);

// Reactive state for documents and UI
const currentSection = ref("default");
const documents = computed(() => documentStore.draftAndPublishedDocumentsUnassigned);
const showCreateDocumentModal = ref(false);
const showSendDocumentViaEmailModal = ref(false);

// Load documents on mount
onMounted(async () => {
  await userStore.setCurrentUser();
  await documentStore.fetchDocuments();
  documentStore.selectedDocument = null;
});

// Handle section updates from the navigation
const handleSection = (message) => {
  currentSection.value = message;
};

// Close any open modals
const closeModal = () => {
  showCreateDocumentModal.value = false;
  showSendDocumentViaEmailModal.value = false;
};
</script>
