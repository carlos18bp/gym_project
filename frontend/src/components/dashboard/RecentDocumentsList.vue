<template>
  <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6" v-bind="$attrs">
    <div class="flex flex-col h-full">
      <!-- Header -->
      <div class="border-b border-gray-100 pb-4 mb-4">
        <h2 class="text-lg font-semibold text-gray-900">Documentos Recientes</h2>
      </div>
      
      <!-- Content -->
      <div class="flex-1 min-h-0">
        <template v-if="userStore.currentUser">
          <!-- Documents List -->
          <template v-if="recentDocumentStore.recentDocuments.length > 0">
            <div class="max-h-[320px] overflow-y-auto pr-1">
              <!-- Simple Grid: 1 column by default, 2 columns only on very large screens (1536px+) -->
              <div class="grid grid-cols-1 2xl:grid-cols-2 gap-3">
                                 <div 
                   v-for="recentDoc in recentDocumentStore.recentDocuments"
                   :key="recentDoc.document.id"
                   class="relative dashboard-card-container"
                 >
                   <DocumentCard
                     :document="recentDoc.document"
                     :card-type="getCardType(recentDoc.document)"
                     :card-context="'dashboard'"
                     :highlighted-doc-id="null"
                     :status-icon="getStatusIcon(recentDoc.document)"
                     :status-text="getStatusText(recentDoc.document)"
                     :status-badge-classes="getStatusBadgeClasses(recentDoc.document)"
                     :show-tags="true"
                     :show-client-name="userStore.currentUser?.role === 'lawyer'"
                     :additional-classes="'hover:scale-[1.02] transition-transform duration-200 dashboard-document-card'"
                     :document-store="documentStore"
                     :user-store="userStore"
                     :prompt-documents="true"
                     @click="handleDocumentClick"
                     @refresh="handleRefresh"
                   />
                 </div>
              </div>
            </div>
          </template>
          
          <!-- Empty State -->
          <template v-else>
            <div class="flex flex-col items-center justify-center py-8 text-center">
              <div class="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mb-3">
                <svg class="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 class="text-sm font-medium text-gray-900 mb-1">No hay documentos recientes</h3>
              <p class="text-xs text-gray-500">Los documentos aparecerán aquí cuando los uses</p>
            </div>
          </template>
        </template>
        
        <!-- Loading State -->
        <div v-else class="flex flex-col items-center justify-center py-8 text-center">
          <div class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3"></div>
          <p class="text-sm text-gray-500">Cargando documentos...</p>
        </div>
      </div>
    </div>
  </div>

  <!-- Modals -->
  <ModalTransition v-show="showEditDocumentModal">
    <component
      :is="userStore.currentUser?.role === 'lawyer' ? 'CreateDocumentByLawyer' : 'UseDocumentByClient'"
      :document-id="selectedDocumentId"
      @close="closeEditModal"
    />
  </ModalTransition>

  <DocumentPreviewModal
    :isVisible="showPreviewModal"
    :documentData="previewDocumentData"
    @close="showPreviewModal = false"
  />

  <ModalTransition v-show="showSendDocumentViaEmailModal">
    <SendDocument
      @closeEmailModal="closeEmailModal"
      :emailDocument="emailDocument"
    />
  </ModalTransition>
</template>

<script setup>
import { onMounted, onActivated, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useRecentDocumentStore } from '@/stores/recentDocument';
import { useUserStore } from '@/stores/user';
import { useDynamicDocumentStore } from '@/stores/dynamicDocument';
import ModalTransition from '@/components/layouts/animations/ModalTransition.vue';
import SendDocument from '@/components/dynamic_document/layouts/modals/SendDocument.vue';
import DocumentPreviewModal from '@/components/dynamic_document/common/DocumentPreviewModal.vue';
import { DocumentCard } from '@/components/dynamic_document/cards';
import { showNotification } from '@/shared/notification_message';
import { showConfirmationAlert } from '@/shared/confirmation_alert';
import { showPreviewModal, previewDocumentData, openPreviewModal } from '@/shared/document_utils';
import { useRecentViews } from '@/composables/useRecentViews';
import { 
  CheckCircleIcon, 
  PencilIcon, 
  ClockIcon,
  DocumentCheckIcon,
  ExclamationTriangleIcon 
} from '@heroicons/vue/24/outline';

const router = useRouter();
const recentDocumentStore = useRecentDocumentStore();
const userStore = useUserStore();
const documentStore = useDynamicDocumentStore();
const { registerView } = useRecentViews();

// Reactive states
const showEditDocumentModal = ref(false);
const selectedDocumentId = ref(null);
const showSendDocumentViaEmailModal = ref(false);
const emailDocument = ref({});

/**
 * Get card type based on document and user role
 */
const getCardType = (document) => {
  return userStore.currentUser?.role === 'lawyer' ? 'lawyer' : 'client';
};

/**
 * Get status icon for document
 */
const getStatusIcon = (document) => {
  switch (document.state) {
    case 'Completed':
    case 'FullySigned':
      return CheckCircleIcon;
    case 'Published':
      return DocumentCheckIcon;
    case 'PendingSignatures':
      return ClockIcon;
    case 'Progress':
    case 'Draft':
      return PencilIcon;
    default:
      return ExclamationTriangleIcon;
  }
};

/**
 * Get status text for document
 */
const getStatusText = (document) => {
  switch (document.state) {
    case 'Completed':
      return 'Completado';
    case 'FullySigned':
      return 'Firmado';
    case 'Published':
      return 'Publicado';
    case 'PendingSignatures':
      return 'Pendiente';
    case 'Progress':
      return 'En Progreso';
    case 'Draft':
      return 'Borrador';
    default:
      return document.state;
  }
};

/**
 * Get status badge classes for document
 */
const getStatusBadgeClasses = (document) => {
  switch (document.state) {
    case 'Completed':
    case 'FullySigned':
      return 'bg-green-100 text-green-700 border border-green-200';
    case 'Published':
      return 'bg-blue-100 text-blue-700 border border-blue-200';
    case 'PendingSignatures':
      return 'bg-yellow-100 text-yellow-700 border border-yellow-200';
    case 'Progress':
    case 'Draft':
      return 'bg-gray-100 text-gray-700 border border-gray-200';
    default:
      return 'bg-gray-100 text-gray-600 border border-gray-200';
  }
};

/**
 * Handle document click
 */
const handleDocumentClick = (document) => {
  registerView('document', document.id);
  // Additional click handling if needed
};

/**
 * Handle refresh from document cards
 */
const handleRefresh = async () => {
  await recentDocumentStore.fetchRecentDocuments();
};

/**
 * Close edit modal
 * @param {Object} data - Data from the modal
 */
const closeEditModal = (data) => {
  showEditDocumentModal.value = false;
  selectedDocumentId.value = null;
  if (data && data.updatedDocId) {
    recentDocumentStore.fetchRecentDocuments();
  }
};

/**
 * Close email modal
 */
const closeEmailModal = () => {
  showSendDocumentViaEmailModal.value = false;
  emailDocument.value = {};
};

// Update when component is mounted
onMounted(async () => {
  await userStore.setCurrentUser();
  await recentDocumentStore.fetchRecentDocuments();
});

// Update when component is reactivated (when returning to dashboard)
onActivated(async () => {
  await userStore.setCurrentUser();
  await recentDocumentStore.fetchRecentDocuments();
});
</script>

<style scoped>
/* Simplified scrollbar for recent documents */
.overflow-y-auto::-webkit-scrollbar {
  width: 4px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: transparent;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background: #e5e7eb;
  border-radius: 2px;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background: #d1d5db;
}

/* Dashboard card container z-index fix */
.dashboard-card-container {
  z-index: 1;
  position: relative;
}

/* Elevate card container on hover to ensure menus appear above other cards */
.dashboard-card-container:hover {
  z-index: 999 !important;
}

/* Target all dropdown menus within dashboard cards */
.dashboard-card-container :deep(.absolute) {
  z-index: 9999 !important;
}

/* Specific targeting for Headless UI MenuItems */
.dashboard-card-container :deep([role="menu"]) {
  z-index: 9999 !important;
}

/* Additional safety for any menu containers */
.dashboard-card-container :deep(.menu-container) {
  z-index: 999 !important;
}

/* Target the dashboard document cards specifically */
:deep(.dashboard-document-card:hover) {
  z-index: 999 !important;
}
</style>
