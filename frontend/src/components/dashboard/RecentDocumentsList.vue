<template>
  <div class="bg-white rounded-xl shadow-md border border-gray-200 p-4" v-bind="$attrs">
    <div class="flex flex-col h-full">
      <div class="border-b border-gray-200 pb-4">
        <h2 class="text-lg font-semibold text-gray-900">Documentos Recientes</h2>
      </div>
      
      <div class="mt-4">
        <!-- List components based on user role -->
        <template v-if="userStore.currentUser">
          <template v-if="recentDocumentStore.recentDocuments.length === 0">
            <div class="flex justify-center items-center py-4">
              <p class="text-sm text-gray-500">No hay documentos recientes</p>
            </div>
          </template>
          <template v-else>
            <div 
              v-if="userStore.currentUser.role === 'lawyer'"
              class="grid gap-2 max-h-[250px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 pr-4">
              <DocumentListLawyer 
                :search-query="''"
                :prompt-documents="recentDocumentStore.recentDocuments.map(doc => doc.document)"
              />
            </div>
            <div 
              class="grid gap-2 max-h-[250px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 pr-4" 
              v-else-if="userStore.currentUser.role === 'client'" >
              <DocumentListClient 
                :search-query="''"
                :prompt-documents="recentDocumentStore.recentDocuments.map(doc => doc.document)"
              />
            </div>
          </template>
        </template>
        <div v-else class="flex justify-center items-center py-4">
          <p class="text-gray-500">Loading...</p>
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
import { showNotification } from '@/shared/notification_message';
import { showConfirmationAlert } from '@/shared/confirmation_alert';
import { showPreviewModal, previewDocumentData, openPreviewModal } from '@/shared/document_utils';
import { useRecentViews } from '@/composables/useRecentViews';
import DocumentListLawyer from '@/components/dynamic_document/lawyer/DocumentListLawyer.vue';
import DocumentListClient from '@/components/dynamic_document/client/DocumentListClient.vue';

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

<style>
/* Custom scrollbar styles */
.scrollbar-thin::-webkit-scrollbar {
  width: 6px;
}

.scrollbar-thin::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.scrollbar-thin::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 3px;
}

.scrollbar-thin::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
}
</style>
