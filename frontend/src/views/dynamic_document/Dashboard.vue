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
      :role="userRole"
    />

    <!-- Documents for lawyers -->
    <div v-if="userRole === 'lawyer'" class="mt-6">
      <!-- Lawyer Navigation Tabs -->
      <div class="mb-6 border-b border-gray-200">
        <nav class="-mb-px flex flex-wrap gap-x-4 gap-y-2 md:gap-x-8" aria-label="Tabs">
          <button
            v-for="tab in lawyerNavigationTabs"
            :key="tab.name"
            @click="activeLawyerTab = tab.name"
            :class="[
              activeLawyerTab === tab.name
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
              'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm'
            ]"
          >
            {{ tab.label }}
          </button>
        </nav>
      </div>

      <!-- Lawyer Tab Content -->
      <div v-if="activeLawyerTab === 'legal-documents'">
        <DocumentListLawyer :searchQuery="searchQuery" />
      </div>

      <!-- Pending Signatures Tab -->
      <div 
        v-if="activeLawyerTab === 'pending-signatures'"
        class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-3 sm:gap-4"
        >
        <SignaturesList state="PendingSignatures" :searchQuery="searchQuery" />
      </div>

      <!-- Signed Documents Tab -->
      <div 
        v-if="activeLawyerTab === 'signed-documents'"
        class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-3 sm:gap-4"
        >
        <SignaturesList state="FullySigned" :searchQuery="searchQuery" />
      </div>

      <!-- Finished Documents Tab -->
      <div v-if="activeLawyerTab === 'finished-documents'">
        <DocumentFinishedByClientList :searchQuery="searchQuery" />
      </div>

      <!-- In Progress Documents Tab -->
      <div v-if="activeLawyerTab === 'in-progress-documents'">
        <DocumentInProgressByClientList :searchQuery="searchQuery" />
      </div>

      <!-- No documents message -->
      <div
        v-if="filteredDocuments.length === 0"
        class="mt-6 text-center text-gray-400 font-regular"
      >
        <p>No hay documentos disponibles para mostrar.</p>
      </div>
    </div>

    <!-- Documents for clients -->
    <div v-if="userRole === 'client'" class="mt-6">
      <!-- Navigation tabs -->
      <div 
        v-if="currentSection !== 'useDocument'"
        class="mb-6 border-b border-gray-200">
        <nav class="-mb-px flex flex-wrap gap-x-4 gap-y-2 md:gap-x-8" aria-label="Tabs">
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
      <div v-else class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-3 sm:gap-4">
        <SignaturesList 
          v-if="activeTab === 'pending-signatures'"
          state="PendingSignatures"
          :searchQuery="searchQuery"
          @refresh="handleRefresh"
        />
        <DocumentListClient
          v-if="activeTab === 'my-documents'"
          :searchQuery="searchQuery"
        ></DocumentListClient>
        <SignaturesList
          v-if="activeTab === 'signed-documents'"
          state="FullySigned"
          :searchQuery="searchQuery"
        />
      </div>
    </div>
  </div>

  <!-- Modals -->
  <ModalTransition v-show="showCreateDocumentModal">
    <CreateDocumentByLawyer @close="closeModal" />
  </ModalTransition>

  <!-- Electronic Signature Modal -->
  <ModalTransition v-if="showSignatureModal">
    <div class="p-4 sm:p-6">
      <div class="bg-white rounded-xl shadow-xl max-w-3xl w-full mx-auto">
        <div class="flex justify-between items-center p-4 border-b">
          <h2 class="text-lg font-medium text-primary">Firma Electrónica</h2>
          <button @click="showSignatureModal = false" class="text-gray-400 hover:text-gray-500 p-1 rounded-full hover:bg-gray-100">
            <XMarkIcon class="h-6 w-6" />
          </button>
        </div>
        <div class="p-4 sm:p-6">
          <ElectronicSignature 
            :user-id="currentUser.id"
            :initial-show-options="!currentUser.has_signature"
            @signatureSaved="handleSignatureSaved"
            @cancel="showSignatureModal = false"
          />
        </div>
      </div>
    </div>
  </ModalTransition>
</template>

<script setup>
import { onMounted, computed, ref, watch } from "vue";
import { useUserStore } from "@/stores/user";
import { useDynamicDocumentStore } from "@/stores/dynamicDocument";
import { useRouter } from "vue-router";
import { FingerPrintIcon, XMarkIcon } from "@heroicons/vue/24/outline";

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
import SignaturesList from "@/components/dynamic_document/common/SignaturesList.vue";
import CreateDocumentByLawyer from "@/components/dynamic_document/lawyer/modals/CreateDocumentByLawyer.vue";
import ElectronicSignature from "@/components/electronic_signature/ElectronicSignature.vue";

// Store instances
const userStore = useUserStore();
const documentStore = useDynamicDocumentStore();
const router = useRouter();

// Reactive state
const searchQuery = ref("");
const currentSection = ref("default");
const showCreateDocumentModal = ref(false);
const activeTab = ref('my-documents');
const activeLawyerTab = ref('legal-documents');
const showSignatureModal = ref(false);

// Get the current user
const currentUser = computed(() => userStore.currentUser);

// Add this computed property
const userRole = computed(() => {
  if (!currentUser.value) {
    console.log('Current user is null, redirecting to login...');
    router.push('/login');
    return null;
  }
  return currentUser.value.role;
});

// Get filtered documents using the store getter, ensuring role-specific documents
const filteredDocuments = computed(() => {
  let allDocuments = [];

  if (userRole.value === "lawyer") {
    allDocuments = documentStore.draftAndPublishedDocumentsUnassigned;
  } else if (userRole.value === "client") {
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

// Navigation tabs for lawyer users
const lawyerNavigationTabs = [
  { name: 'legal-documents', label: 'Documentos Jurídicos' },
  { name: 'pending-signatures', label: 'Documentos para Firmar' },
  { name: 'signed-documents', label: 'Documentos Firmados' },
  { name: 'finished-documents', label: 'Documentos Finalizados' },
  { name: 'in-progress-documents', label: 'Documentos en Progreso' }
];

// Add handler for signature creation completion
const handleSignatureSaved = async (signatureData) => {
  // Get updated user information from backend
  const updatedUser = await userStore.getUserInfo();
  
  // Update has_signature property immediately in the current user object
  if (userStore.currentUser) {
    userStore.currentUser.has_signature = true;
  }
  
  showNotification("Firma electrónica guardada correctamente", "success");
  
  // Close the modal after a small delay to allow the notification to be visible
  setTimeout(() => {
    showSignatureModal.value = false;
  }, 500);
};
</script>
