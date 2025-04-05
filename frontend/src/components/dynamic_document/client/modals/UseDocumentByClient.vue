<template>
  <div class="bg-white rounded-lg p-6 shadow-xl max-w-lg w-full">
    <div class="flex justify-end">
      <button @click="closeModal">
        <XMarkIcon class="size-6" />
      </button>
    </div>
    <form @submit.prevent="handleSubmit">
      <div>
        <label
          for="document-name"
          class="block text-base font-medium leading-6 text-primary"
        >
          Nombre <span class="text-red-500">*</span>
        </label>
        <div class="mt-2">
          <input
            v-model="documentTitle"
            type="text"
            id="document-name"
            class="block w-full rounded-md border-0 py-1.5 text-primary shadow-sm ring-1 ring-inset ring-gray-300"
            required
          />
        </div>
      </div>
      <!-- Buttons Container -->
      <div class="flex gap-2 mt-2.5">
        <!-- Update Name Button - Only visible in edit mode -->
        <button
          v-if="isEditMode"
          type="button"
          @click="updateDocumentName"
          :disabled="!isTitleChanged"
          class="p-2.5 text-sm font-medium rounded-md flex gap-2"
          :class="isTitleChanged 
            ? 'bg-primary text-white cursor-pointer' 
            : 'bg-gray-200 text-gray-400 cursor-not-allowed opacity-70'"
        >
          <span>Actualizar nombre</span>
        </button>
        <!-- Continue Button -->
        <button
          type="submit"
          class="p-2.5 text-sm font-medium rounded-md flex gap-2"
          :class="
            !isSaveButtonEnabled
              ? 'bg-gray-200 text-secondary border-2 border-dashed border-secondary cursor-not-allowed bg-opacity-50'
              : 'bg-secondary text-white'
          "
          :disabled="!isSaveButtonEnabled"
        >
          <span>{{ isEditMode ? "Editar Documento" : "Continuar" }}</span>
        </button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { XMarkIcon } from "@heroicons/vue/24/outline";
import { computed, ref, watchEffect, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { useDynamicDocumentStore } from "@/stores/dynamicDocument";
import { showNotification } from "@/shared/notification_message";

const props = defineProps({
  documentId: {
    type: [Number, null],
    required: false,
    default: null,
  },
});

const router = useRouter();
const store = useDynamicDocumentStore();
const emit = defineEmits(['close']);

// Reactive state for document title
const documentTitle = ref("");
// Store the original title to detect changes
const originalTitle = ref("");

// Simple function to close the modal and optionally pass data
const closeModal = () => {
  emit('close');
};

// Sync the title field with the selected document
watchEffect(() => {
  if (store.selectedDocument) {
    documentTitle.value = store.selectedDocument?.title || "";
    originalTitle.value = store.selectedDocument?.title || "";
  } else {
    documentTitle.value = ""; // In case of creation, the title must be empty.
    originalTitle.value = "";
  }
});

/**
 * Event handler for Escape key to close the modal.
 * @param {KeyboardEvent} event - The keyboard event.
 */
const handleEscKey = (event) => {
  if (event.key === 'Escape') {
    closeModal();
  }
};

// Add and remove event listeners for the Escape key
onMounted(() => {
  document.addEventListener('keydown', handleEscKey);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleEscKey);
});

// Computed properties for form validation
const isSaveButtonEnabled = computed(
  () => documentTitle.value.trim().length > 0
);

/**
 * Determine if the modal is in edit mode.
 */
const isEditMode = computed(() => !!store.selectedDocument?.id);

/**
 * Check if the title has been changed from original.
 */
const isTitleChanged = computed(() => 
  isEditMode.value && 
  documentTitle.value.trim() !== originalTitle.value.trim() && 
  documentTitle.value.trim().length > 0
);

/**
 * Updates only the document title without redirecting to editor.
 * If the document is already opened in edit mode and title has changed,
 * updates the title and notifies the parent component.
 */
async function updateDocumentName() {
  if (isEditMode.value && isTitleChanged.value) {
    try {
      // Create an object with just the title field
      const documentData = {
        title: documentTitle.value.trim()
      };
      
      // Update the document
      await store.updateDocument(store.selectedDocument.id, documentData);
      
      // Update the original title reference
      originalTitle.value = documentTitle.value.trim();
      
      // Update the selected document title in the store
      store.selectedDocument.title = documentTitle.value.trim();
      
      // Prepare update data for parent component
      const updatedDocId = store.selectedDocument.id;
      
      // Show success notification
      showNotification("Document name successfully updated.", "success");
      
      // Close the modal and pass the updated document ID
      const updatedData = { updatedDocId };
      emit('close', updatedData);
      
      // Check if we're already on the dashboard page
      const currentPath = window.location.pathname;
      const isDashboard = currentPath === '/dynamic_document_dashboard' || 
                          currentPath === '/dynamic_document_dashboard/';
      
      if (!isDashboard) {
        // Only redirect if we're not already on the dashboard
        setTimeout(() => {
          window.location.href = '/dynamic_document_dashboard';
        }, 1000);
      } else {
        // No need to set lastUpdatedDocumentId here, as it will be handled by the parent component
      }
    } catch (error) {
      console.error("Error updating document name:", error);
      showNotification("Error updating document name.", "error");
    }
  }
}

/**
 * Handle form submission.
 */
function handleSubmit() {
  const encodedName = encodeURIComponent(documentTitle.value.trim());

  if (props.documentId && !store.selectedDocument) {
    // Create a new document
    router.push(
      `/dynamic_document_dashboard/document/use/creator/${props.documentId}/${encodedName}`
    );
  } else if (store.selectedDocument) {
    // Edit a document - update the title in the store
    store.selectedDocument.title = documentTitle.value.trim();
    router.push(
      `/dynamic_document_dashboard/document/use/editor/${store.selectedDocument.id}/${encodedName}`
    );
  } else {
    showNotification(
      "Error: No se pudo continuar. Documento no seleccionado.",
      "error"
    );
  }
}
</script>
