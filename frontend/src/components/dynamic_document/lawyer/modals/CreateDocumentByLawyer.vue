<template>
  <div class="bg-white rounded-lg p-6 shadow-xl max-w-lg w-full">
    <div class="flex justify-end">
      <button @click="$emit('close')">
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
      <!-- Continue Button -->
      <button
        type="submit"
        class="mt-2.5 p-2.5 text-sm font-medium rounded-md flex gap-2"
        :class="
          !isSaveButtonEnabled
            ? 'bg-gray-200 text-secondary border-2 border-dashed border-secondary cursor-not-allowed bg-opacity-50'
            : 'bg-secondary text-white'
        "
        :disabled="!isSaveButtonEnabled"
      >
        <span>{{ isEditMode ? 'Editar' : 'Continuar' }}</span>
      </button>
    </form>
  </div>
</template>

<script setup>
import { XMarkIcon } from "@heroicons/vue/24/outline";
import { computed, ref, watchEffect } from "vue";
import { useRouter } from "vue-router";
import { useDynamicDocumentStore } from "@/stores/dynamicDocument";

const router = useRouter();
const store = useDynamicDocumentStore();

// Reactive title field to safely bind to the input
const documentTitle = ref('');

// Synchronize the title field with the selected document
watchEffect(() => {
  documentTitle.value = store.selectedDocument?.title || '';
});

/**
 * Computes whether the save button should be enabled.
 */
const isSaveButtonEnabled = computed(() => documentTitle.value.trim().length > 0);

/**
 * Determine if the modal is in edit mode.
 */
const isEditMode = computed(() => !!store.selectedDocument?.id);

/**
 * Handles the form submission.
 */
function handleSubmit() {
  if (isSaveButtonEnabled.value) {
    const encodedName = encodeURIComponent(documentTitle.value.trim());

    // Update the store's selected document title
    if (isEditMode.value) store.selectedDocument.title = documentTitle.value;

    if (isEditMode.value) {
      router.push(`/dynamic_document_dashboard/lawyer/editor/edit/${store.selectedDocument.id}`);
    } else {
      router.push(`/dynamic_document_dashboard/lawyer/editor/create/${encodedName}`);
    }
  }
}
</script>
