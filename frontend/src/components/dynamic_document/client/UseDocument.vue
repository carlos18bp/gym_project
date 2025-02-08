<template>
  <div class="mt-8 flex flex-wrap gap-6">
    <button
      v-for="document in availableDocuments"
      :key="document.id"
      @click="openModal(document.id)"
      class="flex items-center gap-3 py-2 px-4 border rounded-xl border-stroke bg-white hover:bg-gray-100"
    >
      <DocumentArrowUpIcon class="size-6 text-secondary" />
      <div class="grid gap-1">
        <span class="text-base font-medium">{{ document.title }}</span>
        <span class="text-sm font-regular text-gray-400">{{ document.description }}</span>
      </div>
      <ChevronRightIcon class="size-6 text-gray-400" />
    </button>

    <!-- Modal -->
    <ModalTransition v-show="showUseDocumentModal">
      <UseDocumentByClient
        :document-id="selectedDocumentId"
        v-if="selectedDocumentId !== null"
        @close="closeModal"
      />
    </ModalTransition>
  </div>
</template>

<script setup>
import { ChevronRightIcon, DocumentArrowUpIcon } from "@heroicons/vue/24/outline";
import ModalTransition from "@/components/layouts/animations/ModalTransition.vue";
import UseDocumentByClient from "@/components/dynamic_document/client/modals/UseDocumentByClient.vue";
import { computed, ref } from "vue";
import { useDynamicDocumentStore } from "@/stores/dynamicDocument";

const documentStore = useDynamicDocumentStore();
const showUseDocumentModal = ref(false);
const selectedDocumentId = ref(null);

const availableDocuments = computed(() => {
  return documentStore.publishedDocumentsUnassigned;
});

function openModal(documentId) {
  if (documentId) {
    selectedDocumentId.value = documentId;
    showUseDocumentModal.value = true;
  }
}

function closeModal() {
  showUseDocumentModal.value = false;
  selectedDocumentId.value = null;
}
</script>
