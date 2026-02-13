<template>
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" @click.self="closeModal">
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
            v-if="showEditorActionButton"
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
  </div>
</template>

<script setup>
import { XMarkIcon } from "@heroicons/vue/24/outline";
import { computed, ref, watchEffect, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { useDynamicDocumentStore } from "@/stores/dynamic_document";
import { showNotification } from "@/shared/notification_message";

const props = defineProps({
  document: {
    type: Object,
    required: true
  },
  userRole: {
    type: String,
    default: 'client' // 'client' or 'lawyer'
  },
  showEditorButton: {
    type: Boolean,
    default: true
  }
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

// Sync the title field with the document
watchEffect(() => {
  if (props.document) {
    documentTitle.value = props.document?.title || "";
    originalTitle.value = props.document?.title || "";
  } else {
    documentTitle.value = ""; 
    originalTitle.value = "";
  }
});

/**
 * Event handler for Escape key to close the modal.
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
const isEditMode = computed(() => !!props.document?.id);

/**
 * Check if the title has been changed from original.
 */
const isTitleChanged = computed(() => 
  isEditMode.value && 
  documentTitle.value.trim() !== originalTitle.value.trim() && 
  documentTitle.value.trim().length > 0
);

// Determine if the main action button (Editar Documento / Continuar) should be shown
const showEditorActionButton = computed(() => {
  // When creating a new document, always show the button
  if (!isEditMode.value) {
    return true;
  }
  // When editing an existing document, respect the prop
  return props.showEditorButton;
});

/**
 * Updates only the document title without redirecting to editor.
 */
async function updateDocumentName() {
  if (isEditMode.value && isTitleChanged.value) {
    try {
      // Create an object with just the title field
      const documentData = {
        title: documentTitle.value.trim()
      };
      
      // Update the document
      await store.updateDocument(props.document.id, documentData);
      
      // Update the original title reference
      originalTitle.value = documentTitle.value.trim();
      
      // Show success notification
      showNotification("Nombre del documento actualizado exitosamente.", "success");
      
      // Close the modal
      closeModal();
      
    } catch (error) {
      console.error("Error updating document name:", error);
      showNotification("Error al actualizar el nombre del documento.", "error");
    }
  }
}

/**
 * Handle form submission.
 */
function handleSubmit() {
  const encodedName = encodeURIComponent(documentTitle.value.trim());

  if (props.document?.id && !isEditMode.value) {
    // Create a new document from template
    if (props.userRole === 'lawyer') {
      router.push(
        `/dynamic_document_dashboard/lawyer/editor/create/${encodedName}`
      );
    } else {
      router.push(
        `/dynamic_document_dashboard/document/use/creator/${props.document.id}/${encodedName}`
      );
    }
  } else if (isEditMode.value) {
    // Edit an existing document
    if (props.userRole === 'lawyer') {
      router.push(
        `/dynamic_document_dashboard/lawyer/editor/edit/${props.document.id}`
      );
    } else {
      router.push(
        `/dynamic_document_dashboard/document/use/editor/${props.document.id}/${encodedName}`
      );
    }
  } else {
    showNotification(
      "Error: No se pudo continuar. Documento no seleccionado.",
      "error"
    );
  }
}
</script> 