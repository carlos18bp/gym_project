<template>
  <div class="mt-8 flex flex-wrap gap-6">
    <!-- Document In Progress -->
    <div
      v-for="document in filteredProgressDocuments"
      :key="document.id"
      class="flex items-center gap-3 py-2 px-4 border rounded-xl border-stroke bg-white"
    >
      <PencilIcon class="size-6 text-secondary"></PencilIcon>
      <div class="grid gap-1">
        <span class="text-base font-medium">{{ document.title }}</span>
        <span class="text-sm font-regular text-gray-400">
          {{ getClientName(document.assigned_to) }}
        </span>
      </div>
      <Menu as="div" class="relative inline-block text-left">
        <div>
          <MenuButton class="flex items-center text-gray-400">
            <span class="sr-only">Open options</span>
            <EllipsisVerticalIcon class="size-6" aria-hidden="true" />
          </MenuButton>
        </div>

        <transition
          enter-active-class="transition ease-out duration-100"
          enter-from-class="transform opacity-0 scale-95"
          enter-to-class="transform opacity-100 scale-100"
          leave-active-class="transition ease-in duration-75"
          leave-from-class="transform opacity-100 scale-100"
          leave-to-class="transform opacity-0 scale-95"
        >
          <MenuItems
            class="absolute left-0 z-10 mt-2 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black/5"
          >
            <div class="py-1">
              <MenuItem v-for="option in documentEditingOptions" :key="option.label">
                <button
                  @click="handleOptionClick(option, document)"
                  class="block w-full text-left px-4 py-2 text-sm font-regular cursor-pointer hover:bg-gray-100 transition"
                >
                  {{ option.label }}
                </button>
              </MenuItem>
            </div>
          </MenuItems>
        </transition>
      </Menu>
    </div>
  </div>

  <!-- Document Preview Modal -->
  <DocumentPreviewModal :isVisible="showPreviewModal" :documentData="previewDocumentData" @close="showPreviewModal = false" />
</template>

<script setup>
import { computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/vue";
import { PencilIcon, EllipsisVerticalIcon } from "@heroicons/vue/24/outline";
import { useDynamicDocumentStore } from "@/stores/dynamicDocument";
import { useUserStore } from "@/stores/user";

import { showPreviewModal, previewDocumentData, openPreviewModal, downloadPDFDocument, downloadWordDocument } from "@/shared/document_utils";
import DocumentPreviewModal from "@/components/dynamic_document/common/DocumentPreviewModal.vue";

const documentStore = useDynamicDocumentStore();
const userStore = useUserStore();
const router = useRouter();

onMounted(() => {
  documentStore.init();
  userStore.init();
});

const props = defineProps({
  searchQuery: String,
});

const filteredProgressDocuments = computed(() => {
  const allProgressDocuments = documentStore.progressDocumentsByClient(userStore.getCurrentUser?.id);
  return documentStore.filteredDocuments(props.searchQuery, userStore).filter(doc => 
    allProgressDocuments.some(progressDoc => progressDoc.id === doc.id)
  );
});

const documentEditingOptions = [
  { label: "Editar", action: "edit" },
  { label: "Previsualización", action: "preview" },
  { label: "Descargar PDF", action: "downloadPDF" },
  { label: "Descargar Word", action: "downloadWord" },
];

const handleOptionClick = (option, document) => {
  switch (option.action) {
    case "edit":
      openEditModal(document);
      break;
    case "preview":
      openPreviewModal(document);
      break;
    case "downloadPDF":
      downloadPDFDocument(document);
      break;
    case "downloadWord":
      downloadWordDocument(document);
      break;
    default:
      console.warn("Unknown action:", option.action);
  }
};

const openEditModal = (document) => {
  const encodedTitle = encodeURIComponent(document.title.trim());
  router.push(`/dynamic_document_dashboard/document/use/editor/${document.id}/${encodedTitle}`);
};

const getClientName = (clientId) => {
  const client = userStore.userById(clientId);
  return client ? `${client.first_name} ${client.last_name}` : "Desconocido";
};
</script>
