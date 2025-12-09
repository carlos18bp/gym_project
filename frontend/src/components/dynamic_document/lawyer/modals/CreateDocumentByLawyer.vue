<template>
  <div class="bg-white rounded-lg p-6 shadow-xl max-w-lg w-full">
    <div class="flex justify-end">
      <button @click="emit('close')">
        <XMarkIcon class="size-6"></XMarkIcon>
      </button>
    </div>
    <form @submit.prevent="handleSubmit">
      <!-- Document Name -->
      <div>
        <label
          for="document-name"
          class="block text-base font-medium leading-6 text-primary"
        >
          Nombre
          <span class="text-red-500">*</span>
        </label>
        <div class="mt-2">
          <input
            v-model="documentTitle"
            type="text"
            name="document-name"
            id="document-name"
            class="block w-full rounded-md border-0 py-1.5 text-primary shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-secondary sm:text-sm sm:leading-6"
            required
          />
        </div>
      </div>
      <!-- Buttons Container -->
      <div class="flex flex-col sm:flex-row gap-3 mt-6 pt-4 border-t border-gray-200">
        <!-- Update Name Button - Always visible in edit mode, but conditionally enabled -->
        <button
          v-if="isEditMode"
          type="button"
          @click="updateDocumentName"
          :disabled="!isTitleChanged"
          class="inline-flex items-center justify-center px-6 py-3 text-sm font-semibold rounded-lg shadow-sm transition-all duration-200"
          :class="isTitleChanged 
            ? 'bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500' 
            : 'bg-gray-100 text-gray-400 border-2 border-dashed border-gray-300 cursor-not-allowed'"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <span>Actualizar nombre</span>
        </button>
        <!-- Continue/Edit Button -->
        <button
          type="submit"
          class="inline-flex items-center justify-center px-6 py-3 text-sm font-semibold rounded-lg shadow-sm transition-all duration-200"
          :class="
            !isSaveButtonEnabled
              ? 'bg-gray-100 text-gray-400 border-2 border-dashed border-gray-300 cursor-not-allowed'
              : 'bg-green-600 text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500'
          "
          :disabled="!isSaveButtonEnabled"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
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
import { useDynamicDocumentStore } from "@/stores/dynamic_document";

const router = useRouter();
const store = useDynamicDocumentStore();

// Define emits
const emit = defineEmits(['close']);

// Reactive title field to safely bind to the input
const documentTitle = ref("");
// Store the original title to detect changes
const originalTitle = ref("");

// Synchronize the title field with the selected document
watchEffect(() => {
  if (store.selectedDocument?.title) {
    documentTitle.value = store.selectedDocument.title;
    originalTitle.value = store.selectedDocument.title;
  } else {
    documentTitle.value = "";
    originalTitle.value = "";
  }
});

/**
 * Event handler for Escape key to close the modal.
 * @param {KeyboardEvent} event - The keyboard event.
 */
const handleEscKey = (event) => {
  if (event.key === 'Escape') {
    emit('close');
  }
};

// Add and remove event listeners for the Escape key
onMounted(() => {
  document.addEventListener('keydown', handleEscKey);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleEscKey);
});

/**
 * Computes whether the save button should be enabled.
 */
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
      
      // Set the lastUpdatedDocumentId to highlight it in the list
      store.lastUpdatedDocumentId = store.selectedDocument.id;
      localStorage.setItem('lastUpdatedDocumentId', store.selectedDocument.id);
      
      // Emit an event with the updated document ID to highlight it in the list
      const updatedDocId = store.selectedDocument.id;
      
      // Close the modal
      emit('close', { updatedDocId });
      
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
        // No need to redirect, just force a highlight
        setTimeout(() => {
          // Trigger a highlight effect using parent's forceHighlight function
          if (window.forceDocumentHighlight) {
            window.forceDocumentHighlight(updatedDocId);
          }
        }, 100);
      }
    } catch (error) {
      console.error("Error updating document name:", error);
    }
  }
}

/**
 * Handles the form submission.
 */
const handleSubmit = async () => {
  if (!isSaveButtonEnabled.value) return;
  
  const encodedName = encodeURIComponent(documentTitle.value.trim());

  // Update the store's selected document title
  if (isEditMode.value) {
    // Edit mode - update existing document title
    store.selectedDocument.title = documentTitle.value;
    
    // Set the lastUpdatedDocumentId to highlight it later
    if (store.selectedDocument.id) {
      store.lastUpdatedDocumentId = store.selectedDocument.id;
      localStorage.setItem('lastUpdatedDocumentId', store.selectedDocument.id.toString());
    }
    
    router.push(
      `/dynamic_document_dashboard/lawyer/editor/edit/${store.selectedDocument.id}`
    );
  } else {
    // Create mode - store the title for future use
    store.selectedDocument = {
      title: documentTitle.value.trim()
    };
    
    router.push(
      `/dynamic_document_dashboard/lawyer/editor/create/${encodedName}`
    );
    
    // Note: New documents will get their ID after creation, so lastUpdatedDocumentId 
    // will be set in the editor component after successful creation
  }
};
</script>
