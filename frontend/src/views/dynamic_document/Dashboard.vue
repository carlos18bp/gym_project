<template>
  <!-- Replacing the old search bar with the new component -->
  <SearchBarAndFilterBy @update:searchQuery="searchQuery = $event">
    <template #auxiliary_button>
        <!-- Create Button for admin -->
        <button
            v-if="currentUser?.role === 'lawyer'"
            class="p-2.5 text-sm font-medium rounded-md flex gap-2 bg-secondary text-white"
            @click="showCreateDocumentModal = true">
          <div class="flex gap-1 items-center"> 
            <PlusIcon class="text-white font-bold size-6"></PlusIcon>
            <span>Nuevo</span>
        </div>
        </button>
    </template>
  </SearchBarAndFilterBy>
  <!-- Main content -->
  <div class="pb-10 px-4 sm:px-6 lg:px-8 lg:pt-10">
    <!-- Documents Navigation -->
    <DocumentsNavigation 
      @openNewDocument="showCreateDocumentModal = true"
      @updateCurrentSection="handleSection"
      :role="currentUser.role"></DocumentsNavigation
    >

    <!--Documents sections depending on the user's role-->
    <div v-if="currentUser?.role === 'lawyer'">
        <DocumentFinishedByClientList @show-send-document-modal="showSendDocumentViaEmailModal = true" v-if="currentSection === 'documentFinished'"></DocumentFinishedByClientList>
        <DocumentInProgressByClientList v-if="currentSection === 'documentInProgress'"></DocumentInProgressByClientList>
        <DocumentListLawyer v-if="currentSection === 'default'"></DocumentListLawyer>
    </div>
    <div v-if="currentUser?.role === 'client'">
        <DocumentListClient></DocumentListClient>
    </div>
  </div>

  <!-- Show create document model for lawyer -->
  <ModalTransition v-show="showCreateDocumentModal">
    <CreateDocumentByLawyer @close="closeModal" />
  </ModalTransition>

  <!-- Show send document via email model -->
  <ModalTransition v-show="showSendDocumentViaEmailModal">
    <SendDocument @close="closeModal"></SendDocument>
  </ModalTransition>
</template>

<script setup>
import { PlusIcon } from "@heroicons/vue/24/outline";
import SearchBarAndFilterBy from "@/components/layouts/SearchBarAndFilterBy.vue";
import DocumentsNavigation from "@/components/dynamic_document/layouts/DocumentsNavigation.vue";
import DocumentListClient from "@/components/dynamic_document/client/DocumentListClient.vue";
import DocumentListLawyer from "@/components/dynamic_document/lawyer/DocumentListLawyer.vue";
import DocumentFinishedByClientList from "@/components/dynamic_document/lawyer/DocumentFinishedByClientList.vue";
import DocumentInProgressByClientList from "@/components/dynamic_document/lawyer/DocumentInProgressByClientList.vue";
import CreateDocumentByLawyer from "@/components/dynamic_document/lawyer/modals/CreateDocumentByLawyer.vue";
import SendDocument from "@/components/dynamic_document/layouts/modals/SendDocument.vue";
import ModalTransition from "@/components/layouts/animations/ModalTransition.vue";
import { useUserStore } from "@/stores/user";
import { onMounted, computed, ref } from "vue";

// Store reference to user information
const userStore = useUserStore();

// Computed property to get the current authenticated user
const currentUser = computed(() => userStore.getCurrentUser);

// Reactive reference to track the current section in the navigation
const currentSection = ref("default");

// Reactive references to manage modal visibility
const showCreateDocumentModal = ref(false);
const showSendDocumentViaEmailModal = ref(false);

// Lifecycle hook: executed when the component is mounted
// Fetches and sets the current user data from the store
onMounted(async () => {
  await userStore.setCurrentUser();
});

// Function to handle section changes in the document navigation
// Updates the value of 'currentSection' based on the message received
const handleSection = (message) => {
  currentSection.value = message;
};

// Function to close all open modals
// Resets the visibility of both 'Create Document' and 'Send Document' modals
function closeModal() {
  showCreateDocumentModal.value = false;
  showSendDocumentViaEmailModal.value = false;
}
</script>
