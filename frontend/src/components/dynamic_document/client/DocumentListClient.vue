<template>
  <div class="mt-8 flex flex-wrap gap-6">
    <!-- Document Item -->
    <div
      v-for="document in filteredDocuments"
      :key="document.id"
      class="flex items-center gap-3 py-2 px-4 border rounded-xl cursor-pointer"
      :class="{
        'border-green-400 bg-green-300/30': document.state === 'Completed',
        'border-stroke bg-white': document.state === 'Progress',
      }"
    >
      <component
        :is="document.state === 'Completed' ? CheckCircleIcon : PencilIcon"
        class="size-6"
        :class="{
          'text-green-500': document.state === 'Completed',
          'text-secondary': document.state === 'Progress',
        }"
      />
      <div class="grid gap-1">
        <span class="text-base font-medium">{{ document.title }}</span>
        <span class="text-sm font-regular text-gray-400">{{
          document.description
        }}</span>
      </div>
      <Menu as="div" class="relative inline-block text-left">
        <MenuButton class="flex items-center text-gray-400">
          <EllipsisVerticalIcon class="size-6" aria-hidden="true" />
        </MenuButton>
        <transition
          enter-active-class="transition ease-out duration-100"
          enter-from-class="transform opacity-0 scale-95"
          enter-to-class="transform opacity-100 scale-100"
          leave-active-class="transition ease-in duration-75"
          leave-from-class="transform opacity-100 scale-100"
          leave-to-class="transform opacity-0 scale-95"
        >
          <MenuItems
            class="absolute left-0 z-10 mt-2 w-56 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black/5 focus:outline-none"
          >
            <div class="py-1">
              <!-- Edit/Complete option -->
              <MenuItem>
                <button
                  class="block w-full text-left px-4 py-2 text-sm font-regular hover:bg-gray-100 transition"
                  @click="openEditModal(document)"
                >
                  {{ document.state === "Completed" ? "Editar" : "Completar" }}
                </button>
              </MenuItem>

              <!-- Preview option -->
              <MenuItem v-if="document.state === 'Completed'">
                <button
                  class="block w-full text-left px-4 py-2 text-sm font-regular hover:bg-gray-100 transition"
                  @click="openPreviewModal(document)"
                >
                  Previsualizar
                </button>
              </MenuItem>

              <!-- Delete option -->
              <MenuItem>
                <button
                  class="block w-full text-left px-4 py-2 text-sm font-regular hover:bg-gray-100 transition"
                  @click="deleteDocument(document)"
                >
                  Eliminar
                </button>
              </MenuItem>

              <!-- Options only for Completed state -->
              <template v-if="document.state === 'Completed'">
                <MenuItem>
                  <button
                    class="block w-full text-left px-4 py-2 text-sm font-regular hover:bg-gray-100 transition"
                    @click="downloadPDFDocument(document)"
                  >
                    Descargar PDF
                  </button>
                </MenuItem>
                <MenuItem>
                  <button
                    class="block w-full text-left px-4 py-2 text-sm font-regular hover:bg-gray-100 transition"
                    @click="downloadWordDocument(document)"
                  >
                    Descargar Word
                  </button>
                </MenuItem>
                <MenuItem>
                  <button
                    class="block w-full text-left px-4 py-2 text-sm font-regular hover:bg-gray-100 transition"
                    @click="openEmailModal(document)"
                  >
                    Enviar
                  </button>
                </MenuItem>
              </template>
            </div>
          </MenuItems>
        </transition>
      </Menu>
    </div>

    <!-- No documents message -->
    <div
      v-if="filteredDocuments.length === 0"
      class="mt-6 flex flex-col items-center justify-center text-center text-gray-500 w-full"
    >
      <p class="text-lg font-semibold">
        No hay documentos disponibles para mostrar.
      </p>
      <p class="text-sm">
        Contacta a tu abogado para gestionar tus documentos.
      </p>
    </div>

    <!-- Edit Document Modal -->
    <ModalTransition v-show="showEditDocumentModal">
      <UseDocumentByClient
        :document-id="selectedDocumentId"
        @close="closeEditModal"
      />
    </ModalTransition>
  </div>

  <!-- Preview Modal -->
  <DocumentPreviewModal
    :isVisible="showPreviewModal"
    :documentData="previewDocumentData"
    @close="showPreviewModal = false"
  />

  <!-- Modal Email -->
  <ModalTransition v-show="showSendDocumentViaEmailModal">
    <SendDocument
      @closeEmailModal="closeEmailModal()"
      :emailDocument="emailDocument"
    />
  </ModalTransition>
</template>

<script setup>
import {
  CheckCircleIcon,
  EllipsisVerticalIcon,
  PencilIcon,
} from "@heroicons/vue/24/outline";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/vue";
import ModalTransition from "@/components/layouts/animations/ModalTransition.vue";
import SendDocument from "@/components/dynamic_document/layouts/modals/SendDocument.vue";
import UseDocumentByClient from "@/components/dynamic_document/client/modals/UseDocumentByClient.vue";
import { computed, ref } from "vue";
import { useDynamicDocumentStore } from "@/stores/dynamicDocument";
import { useUserStore } from "@/stores/user";
import { showNotification } from "@/shared/notification_message";
import { showConfirmationAlert } from "@/shared/confirmation_alert";

import {
  showPreviewModal,
  previewDocumentData,
  openPreviewModal,
} from "@/shared/document_utils";
import DocumentPreviewModal from "@/components/dynamic_document/common/DocumentPreviewModal.vue";

// Store instances
const documentStore = useDynamicDocumentStore();
const userStore = useUserStore();

// Reactive state
const currentUser = computed(() => userStore.getCurrentUser);
const showEditDocumentModal = ref(false);
const selectedDocumentId = ref(null);
const showSendDocumentViaEmailModal = ref(false);
const emailDocument = ref({});

const props = defineProps({
  searchQuery: String,
});

// Retrieve documents in progress and completed from the store, applying the search filter.
const filteredDocuments = computed(() => {
  const allProgressAndCompletedDocs =
    documentStore.progressAndCompletedDocumentsByClient(currentUser.value.id);
  return documentStore
    .filteredDocuments(props.searchQuery, userStore)
    .filter((doc) =>
      allProgressAndCompletedDocs.some(
        (progressOrCompletedDoc) => progressOrCompletedDoc.id === doc.id
      )
    );
});

/**
 * Download the document as PDF.
 * @param {Object} doc - The document to download.
 */
const downloadPDFDocument = (doc) => {
  documentStore.downloadPDF(doc.id, doc.title);
};

/**
 * Download the document as Word.
 * @param {Object} doc - The document to download.
 */
const downloadWordDocument = (doc) => {
  documentStore.downloadWord(doc.id, doc.title);
};

/**
 * Delete the document.
 * @param {object} document - The document to delete.
 */
const deleteDocument = async (document) => {
  // Show modal confirmation
  const confirmed = await showConfirmationAlert(
    `¿Deseas eliminar el documento "${document.title}"?`
  );

  // Delete in confirmed case
  if (confirmed) {
    await documentStore.deleteDocument(document.id);
    await showNotification("Documento eliminado exitosamente.", "success");
  }
};

/**
 * Open the edit modal for the selected document.
 * @param {object} document - The document to edit or complete.
 */
const openEditModal = (document) => {
  documentStore.selectedDocument = document; // Set selected document in the store
  selectedDocumentId.value = document.id;
  showEditDocumentModal.value = true;
};

/**
 * Close the edit modal and clear the selected document.
 */
const closeEditModal = () => {
  showEditDocumentModal.value = false;
  documentStore.clearSelectedDocument();
};

/**
 * Opens the email modal and sets the selected document.
 *
 * @param {Object} doc - The document to be sent via email.
 */
const openEmailModal = (doc) => {
  emailDocument.value = doc;
  showSendDocumentViaEmailModal.value = true;
};

/**
 * Closes the email modal and resets the selected document.
 */
const closeEmailModal = () => {
  emailDocument.value = {};
  showSendDocumentViaEmailModal.value = false;
};
</script>
