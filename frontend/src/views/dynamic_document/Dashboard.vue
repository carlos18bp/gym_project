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
      <!-- Lawyer Navigation Tabs - Responsive -->
      <div class="mb-6 border-b border-gray-200">
        <!-- Desktop Tabs -->
        <nav class="-mb-px hidden md:flex flex-wrap gap-x-4 gap-y-2 md:gap-x-8" aria-label="Tabs">
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

        <!-- Mobile Dropdown -->
        <div class="md:hidden relative">
          <button
            @click="showLawyerDropdown = !showLawyerDropdown"
            class="w-full flex items-center justify-between py-4 px-3 bg-white border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
          >
            <span>{{ lawyerNavigationTabs.find(tab => tab.name === activeLawyerTab)?.label || 'Seleccionar sección' }}</span>
            <svg 
              :class="['ml-2 h-5 w-5 transition-transform duration-200', showLawyerDropdown ? 'transform rotate-180' : '']"
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
            </svg>
          </button>
          
          <!-- Dropdown Menu -->
          <div 
            v-show="showLawyerDropdown"
            class="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg overflow-hidden"
          >
            <button
              v-for="tab in lawyerNavigationTabs"
              :key="tab.name"
              @click="selectLawyerTab(tab.name)"
              :class="[
                'w-full text-left px-4 py-3 text-sm transition-colors duration-150',
                activeLawyerTab === tab.name
                  ? 'bg-primary text-white'
                  : 'text-gray-700 hover:bg-gray-50'
              ]"
            >
              {{ tab.label }}
            </button>
          </div>
        </div>
      </div>

      <!-- Tag Filter -->
      <div class="mb-6">
        <TagFilter v-model="selectedTags" />
      </div>

      <!-- Lawyer Tab Content -->
      <div v-if="activeLawyerTab === 'legal-documents'">
        <DocumentListLawyer :searchQuery="searchQuery" :selectedTags="selectedTags" />
      </div>

      <!-- Pending Signatures Tab -->
      <div 
        v-if="activeLawyerTab === 'pending-signatures'"
        class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-3 sm:gap-4"
        >
        <SignaturesList state="PendingSignatures" :searchQuery="searchQuery" :selectedTags="selectedTags" />
      </div>

      <!-- Signed Documents Tab -->
      <div 
        v-if="activeLawyerTab === 'signed-documents'"
        class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-3 sm:gap-4"
        >
        <SignaturesList state="FullySigned" :searchQuery="searchQuery" :selectedTags="selectedTags" />
      </div>

      <!-- Finished Documents Tab -->
      <div v-if="activeLawyerTab === 'finished-documents'">
        <DocumentFinishedByClientList :searchQuery="searchQuery" :selectedTags="selectedTags" />
      </div>

      <!-- In Progress Documents Tab -->
      <div v-if="activeLawyerTab === 'in-progress-documents'">
        <DocumentInProgressByClientList :searchQuery="searchQuery" :selectedTags="selectedTags" />
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
        
        <!-- Desktop Tabs -->
        <nav class="-mb-px hidden md:flex flex-wrap gap-x-4 gap-y-2 md:gap-x-8" aria-label="Tabs">
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

        <!-- Mobile Dropdown -->
        <div class="md:hidden relative">
          <button
            @click="showClientDropdown = !showClientDropdown"
            class="w-full flex items-center justify-between py-4 px-3 bg-white border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
          >
            <span>{{ navigationTabs.find(tab => tab.name === activeTab)?.label || 'Seleccionar sección' }}</span>
            <svg 
              :class="['ml-2 h-5 w-5 transition-transform duration-200', showClientDropdown ? 'transform rotate-180' : '']"
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
            </svg>
          </button>
          
          <!-- Dropdown Menu -->
          <div 
            v-show="showClientDropdown"
            class="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg overflow-hidden"
          >
            <button
              v-for="tab in navigationTabs"
              :key="tab.name"
              @click="selectClientTab(tab.name)"
              :class="[
                'w-full text-left px-4 py-3 text-sm transition-colors duration-150',
                activeTab === tab.name
                  ? 'bg-primary text-white'
                  : 'text-gray-700 hover:bg-gray-50'
              ]"
            >
              {{ tab.label }}
            </button>
          </div>
        </div>
      </div>

      <!-- Tag Filter -->
      <div v-if="activeTab !== 'folders'" class="mb-6">
        <TagFilter v-model="selectedTags" />
      </div>

      <!-- Tab content -->
      <UseDocument
        v-if="currentSection === 'useDocument'"
        :searchQuery="searchQuery"
        :selectedTags="selectedTags"
      ></UseDocument>
      <div v-else class="grid gap-3 sm:gap-4" :class="{'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3': activeTab != 'my-documents' && activeTab != 'folders'}">
        <SignaturesList 
          v-if="activeTab === 'pending-signatures'"
          state="PendingSignatures"
          :searchQuery="searchQuery"
          :selectedTags="selectedTags"
          @refresh="handleRefresh"
        />
        <DocumentListClient
          v-if="activeTab === 'my-documents'"
          :searchQuery="searchQuery"
          :selectedTags="selectedTags"
        ></DocumentListClient>
        <FolderManagement
          v-if="activeTab === 'folders'"
          :searchQuery="searchQuery"
          :selectedTags="selectedTags"
          @refresh="handleRefresh"
          @navigate-to-main="handleNavigateToMain"
        />
        <SignaturesList
          v-if="activeTab === 'signed-documents'"
          state="FullySigned"
          :searchQuery="searchQuery"
          :selectedTags="selectedTags"
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

  <!-- Modal de previsualización global -->
  <DocumentPreviewModal
    :isVisible="showPreviewModal"
    :documentData="previewDocumentData"
    @close="showPreviewModal = false"
  />
</template>

<script setup>
import { onMounted, computed, ref, watch, onUnmounted } from "vue";
import { useUserStore } from "@/stores/user";
import { useDynamicDocumentStore } from "@/stores/dynamicDocument";
import { useDocumentFolderStore } from "@/stores/documentFolder";
import { useRouter } from "vue-router";
import { FingerPrintIcon, XMarkIcon } from "@heroicons/vue/24/outline";

// Shared components
import SearchBarAndFilterBy from "@/components/layouts/SearchBarAndFilterBy.vue";
import DocumentsNavigation from "@/components/dynamic_document/layouts/DocumentsNavigation.vue";
import ModalTransition from "@/components/layouts/animations/ModalTransition.vue";
import TagFilter from "@/components/dynamic_document/common/TagFilter.vue";
import FolderManagement from "@/components/dynamic_document/common/folders/FolderManagement.vue";

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

// Modal components  
import DocumentPreviewModal from "@/components/dynamic_document/common/DocumentPreviewModal.vue";
import { showPreviewModal, previewDocumentData } from "@/shared/document_utils";

// Store instances
const userStore = useUserStore();
const documentStore = useDynamicDocumentStore();
const folderStore = useDocumentFolderStore();
const router = useRouter();

// Reactive state
const searchQuery = ref("");
const currentSection = ref("default");
const showCreateDocumentModal = ref(false);
const activeTab = ref('folders');
const activeLawyerTab = ref('legal-documents');
const showSignatureModal = ref(false);
const selectedTags = ref([]);

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

  // Get selected tag IDs
  const selectedTagIds = selectedTags.value.map(tag => tag.id);

  return documentStore
    .filteredDocumentsBySearchAndTags(searchQuery.value, userStore, selectedTagIds)
    .filter((doc) =>
      allDocuments.some((filteredDoc) => filteredDoc.id === doc.id)
    );
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
 * Handles navigation to main view (folders tab without modals).
 */
const handleNavigateToMain = async () => {
  // Keep the folders tab active but ensure all modals are closed
  activeTab.value = 'folders';
  
  // Refresh folder data to ensure UI is up-to-date after adding documents
  try {
    // Small delay to ensure backend has processed document additions
    await new Promise(resolve => setTimeout(resolve, 100));
    await folderStore.fetchFolders(true); // Force refresh from backend
    console.log('📂 Dashboard: Refreshed folders after navigate-to-main');
  } catch (error) {
    console.warn('Error refreshing folders on navigate-to-main:', error);
  }
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
  { name: 'folders', label: 'Carpetas' },
  { name: 'my-documents', label: 'Mis Documentos' },
  { name: 'pending-signatures', label: 'Firmas Pendientes' },
  { name: 'signed-documents', label: 'Dcs. Firmados' }
];

// Navigation tabs for lawyer users
const lawyerNavigationTabs = [
  { name: 'legal-documents', label: 'Minutas' },
  { name: 'pending-signatures', label: 'Dcs. Por Firmar' },
  { name: 'signed-documents', label: 'Dcs. Firmados' },
  { name: 'finished-documents', label: 'Dcs. Clientes' },
  { name: 'in-progress-documents', label: 'Dcs. Clientes en Progreso' },
];

// Reactive state for mobile dropdowns
const showLawyerDropdown = ref(false);
const showClientDropdown = ref(false);

/**
 * Closes all dropdowns when clicking outside
 */
const closeDropdowns = () => {
  showLawyerDropdown.value = false;
  showClientDropdown.value = false;
};

/**
 * Handles click outside dropdown to close them
 */
const handleClickOutside = (event) => {
  const dropdownElements = document.querySelectorAll('.relative');
  let clickedInside = false;
  
  dropdownElements.forEach(element => {
    if (element.contains(event.target)) {
      clickedInside = true;
    }
  });
  
  if (!clickedInside) {
    closeDropdowns();
  }
};

/**
 * Selects a tab from the lawyer dropdown.
 *
 * @param {string} tabName - The name of the tab to select.
 */
const selectLawyerTab = (tabName) => {
  activeLawyerTab.value = tabName;
  showLawyerDropdown.value = false;
};

/**
 * Selects a tab from the client dropdown.
 *
 * @param {string} tabName - The name of the tab to select.
 */
const selectClientTab = (tabName) => {
  activeTab.value = tabName;
  showClientDropdown.value = false;
};

// Load data when the component is mounted
onMounted(async () => {
  // Initialize store data
  await userStore.init();
  await documentStore.init();
  await folderStore.init();
  
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
  
  // Add event listener for clicks outside dropdowns
  document.addEventListener('click', handleClickOutside);
});

// Cleanup event listener when component is unmounted
onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});

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
