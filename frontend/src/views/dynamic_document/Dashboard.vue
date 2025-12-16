<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Mobile menu button -->
    <div class="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
      <slot></slot>
    </div>

    <!-- Main content -->
    <div class="p-4 sm:p-6 lg:p-8">
    <!-- Documents for lawyers -->
    <div v-if="userRole === 'lawyer'">
      <!-- Lawyer use-document section: select published minuta and create document -->
      <div v-if="currentSection === 'useDocument'">
        <UseDocumentTable
          :searchQuery="searchQuery"
          :selectedTags="selectedTags"
          @go-back="handleNavigateToMain"
        />
      </div>

      <!-- Default lawyer view: navigation tabs + tables -->
      <div v-else>
        <!-- Lawyer Navigation Tabs with Action Buttons - Responsive -->
        <div class="mb-6 border-b border-gray-200 pb-4">
          <!-- Desktop Tabs -->
          <div class="hidden md:block">
            <nav class="flex flex-wrap gap-x-4 gap-y-2 md:gap-x-8 mb-4" aria-label="Tabs">
              <button
                v-for="tab in lawyerNavigationTabs"
                :key="tab.name"
                @click.stop="selectLawyerTab(tab.name)"
                :class="[
                  activeLawyerTab === tab.name
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
                  'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm cursor-pointer'
                ]"
              >
                {{ tab.label }}
              </button>
            </nav>

            <!-- Action Buttons -->
            <div class="flex gap-3">
              <button
                @click.stop="handleLawyerSignatureClick"
                :disabled="!currentUser"
                :class="[
                  'inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-purple-200 text-sm font-medium transition-all duration-200',
                  currentUser
                    ? 'bg-white text-gray-700 hover:bg-purple-50 hover:border-purple-300'
                    : 'bg-gray-50 text-gray-400 cursor-not-allowed opacity-60'
                ]"
              >
                <FingerPrintIcon class="size-5 text-purple-500"></FingerPrintIcon>
                <span>Firma Electrónica</span>
              </button>
              <button
                @click.stop="showGlobalLetterheadModal = true"
                class="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-green-200 bg-white text-sm font-medium text-gray-700 hover:bg-green-50 hover:border-green-300 transition-all duration-200"
              >
                <DocumentTextIcon class="size-5 text-green-500"></DocumentTextIcon>
                <span>Membrete Global</span>
              </button>
              <!-- Nueva Minuta button - only in legal-documents tab -->
              <button
                v-if="activeLawyerTab === 'legal-documents'"
                @click.stop="handleCreateMinuta"
                class="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-secondary bg-secondary text-sm font-medium text-white hover:bg-blue-700 transition-all duration-200"
              >
                <PlusIcon class="size-5"></PlusIcon>
                <span>Nueva Minuta</span>
              </button>
              <!-- Nuevo Documento button - only in my-documents tab -->
              <button
                v-if="activeLawyerTab === 'my-documents'"
                @click.stop="handleCreateDocument"
                class="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-secondary bg-secondary text-sm font-medium text-white hover:bg-blue-700 transition-all duration-200"
              >
                <PlusIcon class="size-5"></PlusIcon>
                <span>Nuevo Documento</span>
              </button>
            </div>
          </div>

          <!-- Mobile Dropdown -->
          <div class="md:hidden space-y-3 relative">
            <button
              @click.stop="showLawyerDropdown = !showLawyerDropdown"
              class="dropdown-button w-full flex items-center justify-between py-4 px-3 bg-white border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
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
              v-if="showLawyerDropdown"
              class="absolute z-20 mt-2 bg-white border border-gray-300 rounded-lg shadow-lg overflow-hidden w-full"
            >
              <button
                v-for="tab in lawyerNavigationTabs"
                :key="tab.name"
                @click.stop="selectLawyerTab(tab.name)"
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
            
            <!-- Action Buttons for Mobile -->
            <div class="grid gap-2" :class="activeLawyerTab === 'legal-documents' || activeLawyerTab === 'my-documents' ? 'grid-cols-3' : 'grid-cols-2'">
              <button
                @click.stop="handleLawyerSignatureClick"
                :disabled="!currentUser"
                :class="[
                  'flex flex-col items-center justify-center py-3 px-2 rounded-lg border border-purple-200 text-center transition-all duration-200',
                  currentUser
                    ? 'bg-white hover:bg-purple-50'
                    : 'bg-gray-50 cursor-not-allowed opacity-60'
                ]"
              >
                <FingerPrintIcon class="size-6 text-purple-500 mb-1"></FingerPrintIcon>
                <span class="font-medium text-xs leading-tight">Firma</span>
              </button>
              <button
                @click.stop="showGlobalLetterheadModal = true"
                class="flex flex-col items-center justify-center py-3 px-2 rounded-lg border border-green-200 bg-white text-center transition-all duration-200 hover:bg-green-50"
              >
                <DocumentTextIcon class="size-6 text-green-500 mb-1"></DocumentTextIcon>
                <span class="font-medium text-xs leading-tight">Membrete</span>
              </button>
              <!-- Nueva Minuta button - only in legal-documents tab -->
              <button
                v-if="activeLawyerTab === 'legal-documents'"
                @click.stop="handleCreateMinuta"
                class="flex flex-col items-center justify-center py-3 px-2 rounded-lg border border-secondary bg-secondary text-white text-center transition-all duration-200 hover:bg-blue-700"
              >
                <PlusIcon class="size-6 mb-1"></PlusIcon>
                <span class="font-medium text-xs leading-tight">Nueva Minuta</span>
              </button>
              <!-- Nuevo Documento button - only in my-documents tab -->
              <button
                v-if="activeLawyerTab === 'my-documents'"
                @click.stop="handleCreateDocument"
                class="flex flex-col items-center justify-center py-3 px-2 rounded-lg border border-secondary bg-secondary text-white text-center transition-all duration-200 hover:bg-blue-700"
              >
                <PlusIcon class="size-6 mb-1"></PlusIcon>
                <span class="font-medium text-xs leading-tight">Nuevo Doc.</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Lawyer Tab Content -->
        <div v-if="activeLawyerTab === 'legal-documents'">
          <DocumentListTable 
            v-model:searchQuery="searchQuery" 
            :selectedTags="selectedTags"
            :is-loading="documentStore.isLoading"
            card-type="lawyer"
            :show-state-filter="true"
            :show-client-filter="true"
            :show-associations-column="true"
            context="legal-documents"
            @refresh="handleRefresh"
          />
        </div>

        <!-- My Documents Tab (Lawyer) -->
        <div v-if="activeLawyerTab === 'my-documents'">
          <DocumentListTable 
            v-model:searchQuery="searchQuery" 
            :selectedTags="selectedTags"
            :is-loading="documentStore.isLoading"
            card-type="client"
            :show-state-filter="true"
            :show-client-filter="false"
            :show-associations-column="true"
            context="my-documents"
            @refresh="handleRefresh"
          />
        </div>

        <!-- Folders Tab (Lawyer) -->
        <div v-if="activeLawyerTab === 'folders'">
          <FolderManagement
            :searchQuery="searchQuery"
            :selectedTags="selectedTags"
            @refresh="handleRefresh"
            @navigate-to-main="handleNavigateToMain"
            @navigate-to-document="handleNavigateToDocument"
          />
        </div>

        <!-- Pending Signatures Tab -->
        <div v-if="activeLawyerTab === 'pending-signatures'">
          <SignaturesListTable 
            state="PendingSignatures" 
            :searchQuery="searchQuery" 
            :selectedTags="selectedTags"
            @refresh="handleRefresh"
            @open-electronic-signature="handleLawyerSignatureClick"
            @document-fully-signed="handleDocumentFullySigned"
            @document-rejected="handleDocumentRejected"
          />
        </div>

        <!-- Signed Documents Tab -->
        <div v-if="activeLawyerTab === 'signed-documents'">
          <SignaturesListTable 
            state="FullySigned" 
            :searchQuery="searchQuery" 
            :selectedTags="selectedTags"
            @refresh="handleRefresh"
            @open-electronic-signature="handleLawyerSignatureClick"
          />
        </div>

        <!-- Archived Documents Tab -->
        <div v-if="activeLawyerTab === 'archived-documents'">
          <SignaturesListTable 
            state="Archived" 
            :searchQuery="searchQuery" 
            :selectedTags="selectedTags"
            @refresh="handleRefresh"
            @open-electronic-signature="handleLawyerSignatureClick"
          />
        </div>

        <!-- Finished Documents Tab -->
        <div v-if="activeLawyerTab === 'finished-documents'">
          <DocumentFinishedByClientListTable :searchQuery="searchQuery" :selectedTags="selectedTags" />
        </div>

        <!-- In Progress Documents Tab -->
        <div v-if="activeLawyerTab === 'in-progress-documents'">
          <DocumentInProgressByClientListTable :searchQuery="searchQuery" :selectedTags="selectedTags" />
        </div>

        <!-- No documents message -->
        <div
          v-if="filteredDocuments.length === 0"
          class="mt-6 text-center text-gray-400 font-regular"
        >
          <p>No hay documentos disponibles para mostrar.</p>
        </div>
      </div>
    </div>

    <!-- Documents for clients, basic users, and corporate clients -->
    <div v-if="userRole === 'client' || userRole === 'basic' || userRole === 'corporate_client'">
      <!-- Navigation tabs with action buttons -->
      <div class="mb-6 border-b border-gray-200">
        
        <!-- Desktop Layout: Tabs + Action Buttons -->
        <div class="hidden md:flex md:flex-col">
          <nav class="-mb-px flex flex-wrap gap-x-4 gap-y-2 md:gap-x-8" aria-label="Tabs">
          <button
            v-for="tab in navigationTabs"
            :key="tab.name"
            @click.stop="selectClientTab(tab.name)"
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
          
          <!-- Action Buttons (Desktop) -->
          <div class="flex flex-wrap items-center gap-2 mt-3 mb-4 md:justify-end">
            <div class="relative">
              <button
                @click.stop="handleElectronicSignatureClick"
                class="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors border text-purple-600 hover:bg-purple-50 border-purple-200"
              >
                <FingerPrintIcon class="h-4 w-4" />
                Firma Electrónica
              </button>
            </div>
            <div class="relative group">
              <button
                @click.stop="handleGlobalLetterheadClick"
                :disabled="isBasicUser"
                :class="[
                  'inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors border',
                  isBasicUser 
                    ? 'text-green-400 bg-gray-50 border-gray-200 cursor-not-allowed opacity-60' 
                    : 'text-green-600 hover:bg-green-50 border-green-200'
                ]"
              >
                <DocumentTextIcon class="h-4 w-4" />
                Membrete Global
              </button>
              <div
                v-if="isBasicUser"
                class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50"
              >
                Actualiza tu suscripción para usar esta funcionalidad
                <div class="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900"></div>
              </div>
            </div>
            <button
              @click.stop="handleSection('useDocument')"
              class="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-secondary hover:bg-blue-700 rounded-lg transition-colors"
              type="button"
            >
              <PlusIcon class="h-4 w-4" />
              Nuevo Documento
            </button>
          </div>
        </div>

        <!-- Mobile Dropdown -->
        <div class="md:hidden relative">
          <button
            @click.stop="showClientDropdown = !showClientDropdown"
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
            v-if="showClientDropdown"
            class="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg overflow-hidden"
          >
            <button
              v-for="tab in navigationTabs"
              :key="tab.name"
              @click.stop="selectClientTab(tab.name)"
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
        
        <!-- Mobile Action Buttons -->
        <div class="md:hidden mt-4 mb-4 flex flex-col gap-2">
          <div class="relative">
            <button
              @click.stop="handleElectronicSignatureClick"
              class="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium rounded-lg transition-colors text-purple-600 bg-purple-50 hover:bg-purple-100"
            >
              <FingerPrintIcon class="h-5 w-5" />
              Firma Electrónica
            </button>
          </div>
          <div class="relative group">
            <button
              @click.stop="handleGlobalLetterheadClick"
              :disabled="isBasicUser"
              :class="[
                'w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium rounded-lg transition-colors',
                isBasicUser 
                  ? 'text-green-400 bg-gray-50 cursor-not-allowed opacity-60' 
                  : 'text-green-600 bg-green-50 hover:bg-green-100'
              ]"
            >
              <DocumentTextIcon class="h-5 w-5" />
              Membrete Global
            </button>
            <div
              v-if="isBasicUser"
              class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50"
            >
              Actualiza tu suscripción para usar esta funcionalidad
              <div class="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900"></div>
            </div>
          </div>
          <button
            @click.stop="handleSection('useDocument')"
            class="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-white bg-secondary hover:bg-blue-700 rounded-lg transition-colors"
            type="button"
          >
            <PlusIcon class="h-5 w-5" />
            Nuevo Documento
          </button>
        </div>
      </div>

      <!-- Tab content -->
      <div v-if="currentSection === 'useDocument'">
        <UseDocumentTable
          :searchQuery="searchQuery"
          :selectedTags="selectedTags"
          @go-back="handleNavigateToMain"
        ></UseDocumentTable>
      </div>
      <div v-else>
        <FolderManagement
          v-if="activeTab === 'folders'"
          :searchQuery="searchQuery"
          :selectedTags="selectedTags"
          @refresh="handleRefresh"
          @navigate-to-main="handleNavigateToMain"
        />
        <DocumentListTable
          v-else-if="activeTab === 'my-documents'"
          v-model:searchQuery="searchQuery"
          :selectedTags="selectedTags"
          :is-loading="documentStore.isLoading"
          card-type="client"
          :show-state-filter="true"
          :show-client-filter="false"
          :show-associations-column="true"
          context="my-documents"
          @refresh="handleRefresh"
        />
        <SignaturesListTable
          v-else-if="activeTab === 'pending-signatures'"
          state="PendingSignatures"
          :searchQuery="searchQuery"
          :selectedTags="selectedTags"
          @refresh="handleRefresh"
          @open-electronic-signature="handleElectronicSignatureFromSigningFlow"
          @document-fully-signed="handleClientDocumentFullySigned"
          @document-rejected="handleClientDocumentRejected"
        />
        <SignaturesListTable
          v-else-if="activeTab === 'signed-documents'"
          state="FullySigned"
          :searchQuery="searchQuery"
          :selectedTags="selectedTags"
          @refresh="handleRefresh"
          @open-electronic-signature="handleElectronicSignatureFromSigningFlow"
        />
        <SignaturesListTable
          v-else-if="activeTab === 'archived-documents'"
          state="Archived"
          :searchQuery="searchQuery"
          :selectedTags="selectedTags"
          @refresh="handleRefresh"
          @open-electronic-signature="handleElectronicSignatureFromSigningFlow"
        />
      </div>
    </div>
  </div>
  </div>

  <!-- Modals -->
  <ModalTransition v-if="showCreateDocumentModal">
    <CreateDocumentByLawyer @close="closeModal" />
  </ModalTransition>

  <!-- Electronic Signature Modal for Lawyers -->
  <ModalTransition v-if="showSignatureModal && currentUser">
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

  <!-- Electronic Signature Modal for Clients -->
  <ModalTransition v-if="showElectronicSignatureModal && currentUser">
    <div class="p-4 sm:p-6">
      <div class="bg-white rounded-xl shadow-xl max-w-3xl w-full mx-auto">
        <div class="flex justify-between items-center p-4 border-b">
          <h2 class="text-lg font-medium text-primary">Firma Electrónica</h2>
          <button @click="showElectronicSignatureModal = false" class="text-gray-400 hover:text-gray-500 p-1 rounded-full hover:bg-gray-100">
            <XMarkIcon class="h-6 w-6" />
          </button>
        </div>
        <div class="p-4 sm:p-6">
          <ElectronicSignature
            :user-id="currentUser.id"
            :initial-show-options="!currentUser.has_signature"
            @signatureSaved="handleSignatureSaved"
            @cancel="showElectronicSignatureModal = false"
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

  <!-- Global Letterhead Modal -->
  <GlobalLetterheadModal
    :isVisible="showGlobalLetterheadModal"
    @close="showGlobalLetterheadModal = false"
    @uploaded="handleGlobalLetterheadUploaded"
    @deleted="handleGlobalLetterheadDeleted"
  />
</template>

<script setup>
import { onMounted, computed, ref, watch, onUnmounted } from "vue";
import { useUserStore } from "@/stores/auth/user";
import { useDynamicDocumentStore } from "@/stores/dynamic_document";
import { useDocumentFolderStore } from "@/stores/dynamic_document/folders";
import { useRouter, useRoute } from "vue-router";
import { FingerPrintIcon, XMarkIcon, DocumentTextIcon, PlusIcon, MagnifyingGlassIcon, ChevronDownIcon } from "@heroicons/vue/24/outline";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/vue";
import { showNotification } from "@/shared/notification_message";

// Shared components
import ModalTransition from "@/components/layouts/animations/ModalTransition.vue";
import FolderManagement from "@/components/dynamic_document/common/folders/FolderManagement.vue";

// Unified table component
import DocumentListTable from "@/components/dynamic_document/common/DocumentListTable.vue";

// Client components
import UseDocumentTable from "@/components/dynamic_document/client/UseDocumentTable.vue";

// Lawyer components
import DocumentFinishedByClientListTable from "@/components/dynamic_document/lawyer/DocumentFinishedByClientListTable.vue";
import DocumentInProgressByClientListTable from "@/components/dynamic_document/lawyer/DocumentInProgressByClientListTable.vue";
import SignaturesListTable from "@/components/dynamic_document/common/SignaturesListTable.vue";
import CreateDocumentByLawyer from "@/components/dynamic_document/lawyer/modals/CreateDocumentByLawyer.vue";
import ElectronicSignature from "@/components/electronic_signature/ElectronicSignature.vue";

// Modal components  
import DocumentPreviewModal from "@/components/dynamic_document/common/DocumentPreviewModal.vue";
import GlobalLetterheadModal from "@/components/dynamic_document/common/GlobalLetterheadModal.vue";
import LetterheadModal from "@/components/dynamic_document/common/LetterheadModal.vue";
import DocumentRelationshipsModal from "@/components/dynamic_document/modals/DocumentRelationshipsModal.vue";
import { showPreviewModal, previewDocumentData } from "@/shared/document_utils";
import { useBasicUserRestrictions } from "@/composables/useBasicUserRestrictions";

// Store instances
const userStore = useUserStore();
const documentStore = useDynamicDocumentStore();
const folderStore = useDocumentFolderStore();
const router = useRouter();
const route = useRoute();

// Basic user restrictions
const { isBasicUser, handleFeatureAccess } = useBasicUserRestrictions();

// Reactive state
const searchQuery = ref("");
const currentSection = ref("default");
const showCreateDocumentModal = ref(false);
const activeTab = ref('folders');
const activeLawyerTab = ref('legal-documents');
const showElectronicSignatureModal = ref(false);
const showSignatureModal = ref(false);
const showGlobalLetterheadModal = ref(false);
const showLetterheadModal = ref(false);
const showRelationshipsModal = ref(false);
const selectedDocument = ref(null);
const selectedTags = ref([]);
const sortBy = ref('recent');

// Watch activeLawyerTab changes
watch(activeLawyerTab, (newVal, oldVal) => {
  // Handle tab changes
}, { immediate: true });

// Available tags computed property
const availableTags = computed(() => {
  return [];
});

// Sort label computed property
const sortLabel = computed(() => {
  return sortBy.value === 'recent' ? 'Más recientes' : 'Nombre (A-Z)';
});

// Get the current user
const currentUser = computed(() => userStore.currentUser);

// Add this computed property
const userRole = computed(() => {
  if (!currentUser.value) {
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
  } else if (userRole.value === "client" || userRole.value === "basic" || userRole.value === "corporate_client") {
    allDocuments = documentStore.progressAndCompletedDocumentsByClient(
      currentUser.value.id
    );
  }

  // Get selected tag IDs
  const selectedTagIds = selectedTags.value && Array.isArray(selectedTags.value)
    ? selectedTags.value.map(tag => tag.id)
    : [];

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
const handleSection = async (message) => {
  currentSection.value = message;
  // Clear any selected document when changing sections
  documentStore.selectedDocument = null;
  
  // If switching to useDocument section, ensure documents are loaded
  if (message === 'useDocument') {
    try {
      await documentStore.init(true); // Force refresh to get latest published documents
    } catch (error) {
      console.error('Error loading documents for useDocument section:', error);
    }
  }
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
 * Handle lawyer signature button click
 */
const handleLawyerSignatureClick = () => {
  if (!currentUser.value) {
    console.error('Cannot open signature modal: currentUser is not loaded');
    return;
  }
  showSignatureModal.value = true;
};

/**
 * Handle electronic signature button click with basic user restriction
 * (used by the generic header button)
 */
const handleElectronicSignatureClick = () => {
  if (!currentUser.value) {
    console.error('Cannot open signature modal: currentUser is not loaded');
    return;
  }
  showElectronicSignatureModal.value = true;
};

/**
 * Handle electronic signature when user comes from the signing flow
 * This should allow basic users to create/use their signature in order to sign
 */
const handleElectronicSignatureFromSigningFlow = () => {
  if (!currentUser.value) {
    console.error('Cannot open signature modal: currentUser is not loaded');
    return;
  }
  showElectronicSignatureModal.value = true;
};

/**
 * Handle document fully signed event for Lawyer
 */
const handleDocumentFullySigned = async (document) => {
  // Switch to signed documents tab immediately
  activeLawyerTab.value = 'signed-documents';
};

/**
 * Handle document fully signed event for Client/Corporate
 */
const handleClientDocumentFullySigned = async (document) => {
  // Switch to signed documents tab immediately
  activeTab.value = 'signed-documents';
};

/**
 * Handle document rejected event for Lawyer (from signatures list)
 */
const handleDocumentRejected = async (document) => {
  try {
    if (document && document.id) {
      await documentStore.fetchDocumentById(document.id, true);
    } else {
      await documentStore.init(true);
    }
  } catch (error) {
    console.error('Error refreshing rejected document for lawyer:', error);
  }
  activeLawyerTab.value = 'archived-documents';
};

/**
 * Handle document rejected event for Client/Corporate (from signatures list)
 */
const handleClientDocumentRejected = async (document) => {
  try {
    if (document && document.id) {
      await documentStore.fetchDocumentById(document.id, true);
    } else {
      await documentStore.init(true);
    }
  } catch (error) {
    console.error('Error refreshing rejected document for client:', error);
  }
  activeTab.value = 'archived-documents';
};

/**
 * Handle creating a new minuta (formato/template)
 * Opens the CreateDocumentByLawyer modal
 */
const handleCreateMinuta = () => {
  // Clear any selected document to ensure we're in create mode
  documentStore.selectedDocument = null;
  showCreateDocumentModal.value = true;
};

/**
 * Handle creating a new document
 * For lawyers, uses the same useDocument flow as clients:
 * select a published minuta, name the document, then complete variables.
 */
const handleCreateDocument = () => {
  // Reutilizar el flujo useDocument: mostrar tabla de minutas publicadas
  handleSection('useDocument');
};

/**
 * Handle navigation from folder to document's tab with search filter
 * @param {Object} payload - Contains tab name and search query
 */
const handleNavigateToDocument = (payload) => {
  const { tab, searchQuery: docTitle } = payload;
  
  // Switch to the appropriate tab
  activeLawyerTab.value = tab;
  
  // Apply the search filter with the document title
  searchQuery.value = docTitle;
  
  // Small delay to ensure the tab content is rendered before the filter is applied
  setTimeout(() => {
    // The searchQuery reactive variable will automatically filter the documents in the table
  }, 100);
};

/**
 * Handle global letterhead button click with basic user restriction
 */
const handleGlobalLetterheadClick = () => {
  if (!currentUser.value) {
    console.error('Cannot open letterhead modal: currentUser is not loaded');
    return;
  }
  handleFeatureAccess('Membrete Global', () => {
    showGlobalLetterheadModal.value = true;
  });
};

// selectLawyerTab function removed - dropdown functionality simplified



/**
 * Handles global letterhead upload events.
 */
const handleGlobalLetterheadUploaded = (uploadData) => {
  // Show success notification
  showNotification('Membrete global subido correctamente', 'success');
  // Refresh any related data if needed
  // You could emit an event to parent components or update local state
};

/**
 * Handles global letterhead delete events.
 */
const handleGlobalLetterheadDeleted = () => {
  // Show success notification
  showNotification('Membrete global eliminado correctamente', 'success');
  // Refresh any related data if needed
};

/**
 * Handle opening letterhead modal
 */
const handleOpenLetterhead = (document) => {
  selectedDocument.value = document;
  showLetterheadModal.value = true;
};

/**
 * Handle opening relationships modal
 */
const handleOpenRelationships = (document) => {
  selectedDocument.value = document;
  showRelationshipsModal.value = true;
};

/**
 * Close letterhead modal
 */
const closeLetterheadModal = () => {
  showLetterheadModal.value = false;
  selectedDocument.value = null;
};

/**
 * Close relationships modal
 */
const closeRelationshipsModal = () => {
  showRelationshipsModal.value = false;
  selectedDocument.value = null;
};

/**
 * Handles navigation to main view (folders tab without modals).
 */
const handleNavigateToMain = async () => {
  // If coming from useDocument section, go back to my-documents
  if (currentSection.value === 'useDocument') {
    currentSection.value = 'default';
    // Para abogados, volver al tab "Mis Documentos" de abogado
    if (userRole.value === 'lawyer') {
      activeLawyerTab.value = 'my-documents';
    } else {
      // Para clientes/básicos/corporativos, volver al tab "Mis Documentos" del cliente
      activeTab.value = 'my-documents';
    }
    return;
  }
  
  // Keep the folders tab active but ensure all modals are closed
  if (userRole.value === 'lawyer') {
    activeLawyerTab.value = 'folders';
  } else {
    activeTab.value = 'folders';
  }
  
  // Refresh folder data to ensure UI is up-to-date after adding documents
  try {
    // Small delay to ensure backend has processed document additions
    await new Promise(resolve => setTimeout(resolve, 100));
    await folderStore.fetchFolders(true); // Force refresh from backend
  } catch (error) {
    // Silently handle error - folders will refresh on next navigation
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

// Watch modal states
watch(showLetterheadModal, (newVal) => {
  // Handle modal state changes
});

watch(showRelationshipsModal, (newVal) => {
  // Handle modal state changes
});

watch(selectedDocument, (newVal) => {
  // Handle selected document changes
});

// Watch for route changes to refresh documents when returning from formalization
watch(() => route.path, (newPath, oldPath) => {
  // Refresh documents when returning to dashboard from document form
  if (newPath === '/dynamic_document_dashboard' && oldPath && oldPath.includes('/document/use/')) {
    documentStore.init();
  }
});

// Watch for query params to set active tab
watch(() => route.query, (query) => {
  if (query.lawyerTab) {
    activeLawyerTab.value = query.lawyerTab;
  }
  if (query.tab) {
    activeTab.value = query.tab;
  }
}, { immediate: true });

// Navigation tabs for client users
const navigationTabs = [
  { name: 'folders', label: 'Carpetas' },
  { name: 'my-documents', label: 'Mis Documentos' },
  { name: 'pending-signatures', label: 'Dcs. Por Firmar' },
  { name: 'signed-documents', label: 'Dcs. Firmados' },
  { name: 'archived-documents', label: 'Dcs. Archivados' }
];

// Navigation tabs for lawyer users
const lawyerNavigationTabs = [
  { name: 'legal-documents', label: 'Minutas' },
  { name: 'folders', label: 'Carpetas' },
  { name: 'my-documents', label: 'Mis Documentos' },
  { name: 'pending-signatures', label: 'Dcs. Por Firmar' },
  { name: 'signed-documents', label: 'Dcs. Firmados' },
  { name: 'archived-documents', label: 'Dcs. Archivados' },
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

// Dropdowns will close when clicking on tabs or action buttons via their handlers
// No need for global event listeners that interfere with clicks

/**
 * Selects a tab from the lawyer dropdown.
 *
 * @param {string} tabName - The name of the tab to select.
 */
const selectLawyerTab = (tabName) => {
  // Clear global search when manually changing lawyer tab
  searchQuery.value = "";
  activeLawyerTab.value = tabName;
  showLawyerDropdown.value = false;
  // Ensure dropdowns are closed
  closeDropdowns();
};

/**
 * Selects a tab from the client dropdown.
 *
 * @param {string} tabName - The name of the tab to select.
 */
const selectClientTab = (tabName) => {
  // Ensure we are in the main documents view when switching tabs
  currentSection.value = 'default';
  // Clear global search when manually changing client tab
  searchQuery.value = "";
  activeTab.value = tabName;
  showClientDropdown.value = false;
  // Ensure dropdowns are closed
  closeDropdowns();
};


// Load data when the component is mounted
onMounted(async () => {
  // Initialize core data in parallel to reduce initial load time
  try {
    await Promise.all([
      userStore.init(),
      documentStore.init(),
      folderStore.init(),
    ]);
  } catch (error) {
    console.error('Error initializing dynamic document dashboard:', error);
  }

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

// Event listeners are handled by component directives

// Add handler for signature creation completion
const handleSignatureSaved = async (signatureData) => {
  // Update has_signature property immediately in the current user object
  if (userStore.currentUser) {
    userStore.currentUser.has_signature = true;
  }
  
  showNotification("Firma electrónica guardada correctamente", "success");
  
  // Close the modal after a small delay to allow the notification to be visible
  setTimeout(() => {
    showSignatureModal.value = false;
    showElectronicSignatureModal.value = false;
  }, 500);
};
</script>
