<template>
  <div class="mt-8 flex flex-wrap gap-6">
    <div
      v-for="document in documents"
      :key="document.id"
      :class="[ 
        'flex items-center gap-2 py-2 px-4 border rounded-md cursor-pointer transition',
        document.state === 'Published' 
          ? 'border-green-400 bg-green-300/30 hover:bg-green-300/50' 
          : 'border-stroke bg-white hover:bg-gray-100'
      ]"
    >
      <component
        :is="document.state === 'Published' ? CheckCircleIcon : PencilIcon"
        :class="document.state === 'Published' ? 'size-6 text-green-500' : 'size-6 text-secondary'"
      />
      <span class="text-base font-medium">{{ document.title }}</span>

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
          <MenuItems class="absolute left-0 z-10 mt-2 w-56 rounded-md bg-white shadow-lg ring-1 ring-black/5">
            <MenuItem
              v-for="option in getDocumentOptions(document)"
              :key="option.label"
            >
              <button
                class="block w-full text-left px-4 py-2 text-sm font-regular transition flex items-center gap-2"
                :disabled="option.disabled"
                @click="!option.disabled && handleOption(option.action, document)"
                :class="{
                  'opacity-50 cursor-not-allowed': option.disabled, 
                  'cursor-pointer': !option.disabled
                }"
              >
                <NoSymbolIcon
                  v-if="option.disabled"
                  class="size-5 text-gray-400"
                  aria-hidden="true"
                />
                {{ option.label }}
              </button>
            </MenuItem>
          </MenuItems>
        </transition>
      </Menu>
    </div>
  </div>

  <!-- Edit Document Modal -->
  <ModalTransition v-show="showEditDocumentModal">
    <CreateDocumentByLawyer @close="closeEditModal" />
  </ModalTransition>

  <!-- Preview Modal -->
  <ModalTransition v-show="showPreviewModal">
    <div class="bg-white rounded-lg shadow-xl p-6 max-w-4xl w-full overflow-auto max-h-[80vh]">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-lg font-bold">Previsualización del Documento: {{ previewDocumentData.title }}</h2>
        <button @click="closePreviewModal">
          <XMarkIcon class="size-6 text-gray-500 hover:text-gray-700" />
        </button>
      </div>
      <div class="prose max-w-none" v-html="previewDocumentData.content"></div>
    </div>
  </ModalTransition>
</template>

<script setup>
import { ref } from "vue";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/vue";
import { EllipsisVerticalIcon, PencilIcon, CheckCircleIcon, XMarkIcon, NoSymbolIcon } from "@heroicons/vue/24/outline";
import { useDynamicDocumentStore } from "@/stores/dynamicDocument";
import ModalTransition from "@/components/layouts/animations/ModalTransition.vue";
import CreateDocumentByLawyer from "@/components/dynamic_document/lawyer/modals/CreateDocumentByLawyer.vue";

// Props
defineProps({
  documents: {
    type: Array,
    required: true,
  },
});

// State and dependencies
const store = useDynamicDocumentStore();
const showEditDocumentModal = ref(false);
const showPreviewModal = ref(false);
const previewDocumentData = ref({ title: "", content: "" });

/**
 * Get the available options for a document based on its state.
 * If the document has undefined variables, the "Publicar" option is disabled.
 * @param {object} document - The document to evaluate.
 * @returns {Array} - List of options.
 */
const getDocumentOptions = (document) => {
  const baseOptions = [
    { label: "Editar", action: "edit" },
    { label: "Eliminar", action: "delete" },
    { label: "Previsualización", action: "preview" },
  ];

  // Add state-based options with validations
  if (document.state === "Draft") {
    baseOptions.push({
      label: "Publicar",
      action: "publish",
      disabled: !canPublishDocument(document),
    });
  } else if (document.state === "Published") {
    baseOptions.push({ label: "Mover a Borrador", action: "draft", disabled: false });
  }

  return baseOptions;
};

/**
 * Check if a document can be published by verifying all variable values are filled.
 * @param {object} document - The document to check.
 * @returns {boolean} - True if the document can be published, false otherwise.
 */
const canPublishDocument = (document) => {
  return document.variables.every((variable) => variable.value && variable.value.trim().length > 0);
};

/**
 * Handle document option actions.
 * @param {string} action - The action to perform.
 * @param {object} document - The document to apply the action on.
 */
const handleOption = async (action, document) => {
  switch (action) {
    case "edit":
      store.selectedDocument = document;
      showEditDocumentModal.value = true;
      break;
    case "delete":
      if (confirm(`¿Deseas eliminar el documento '${document.title}'?`)) {
        await store.deleteDocument(document.id);
        alert("Documento eliminado correctamente");
      }
      break;
    case "publish":
      await publishDocument(document);
      alert("Documento publicado correctamente");
      break;
    case "draft":
      await moveToDraft(document);
      alert("Documento movido a borrador");
      break;
    case "preview":
      openPreviewModal(document);
      break;
    default:
      console.warn(`Acción desconocida: ${action}`);
  }
};

/**
 * Open the preview modal with the document data.
 * @param {object} document - The document to preview.
 */
const openPreviewModal = (document) => {
  previewDocumentData.value = {
    title: document.title,
    content: document.content, // Mostrar el contenido sin reemplazar variables
  };
  showPreviewModal.value = true;
};

/**
 * Close the preview modal.
 */
const closePreviewModal = () => {
  showPreviewModal.value = false;
  previewDocumentData.value = { title: "", content: "" };
};

/**
 * Publish the document by updating its state.
 * @param {object} document - The document to publish.
 */
const publishDocument = async (document) => {
  const updatedData = {
    ...document,
    state: "Published",
  };
  await store.updateDocument(document.id, updatedData);
};

/**
 * Move the document to draft state.
 * @param {object} document - The document to update.
 */
const moveToDraft = async (document) => {
  const updatedData = {
    ...document,
    state: "Draft",
  };
  await store.updateDocument(document.id, updatedData);
};

/**
 * Close the edit modal and clear the document reference.
 */
const closeEditModal = () => {
  showEditDocumentModal.value = false;
  store.selectedDocument = null;
};
</script>
