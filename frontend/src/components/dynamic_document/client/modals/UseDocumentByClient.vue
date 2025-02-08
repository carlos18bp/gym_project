<template>
  <div class="bg-white rounded-lg p-6 shadow-xl max-w-lg w-full">
    <div class="flex justify-end">
      <button @click="$emit('close')">
        <XMarkIcon class="size-6" />
      </button>
    </div>
    <form @submit.prevent="handleSubmit">
      <div>
        <label for="document-name" class="block text-base font-medium leading-6 text-primary">
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
      <button
        type="submit"
        class="mt-2.5 p-2.5 text-sm font-medium rounded-md flex gap-2"
        :class="{
          'bg-gray-200 cursor-not-allowed opacity-50': !isSaveButtonEnabled,
          'bg-secondary text-white': isSaveButtonEnabled
        }"
        :disabled="!isSaveButtonEnabled"
      >
        Continuar
      </button>
    </form>
  </div>
</template>

<script setup>
import { XMarkIcon } from "@heroicons/vue/24/outline";
import { computed, ref, watchEffect } from "vue";
import { useRouter } from "vue-router";
import { useDynamicDocumentStore } from "@/stores/dynamicDocument";

const props = defineProps({
  documentId: {
    type: [Number, null],
    required: false,
    default: null,
  },
});

const router = useRouter();
const store = useDynamicDocumentStore();

// Reactive state for document title
const documentTitle = ref('');

// Sync the title field with the selected document
watchEffect(() => {
  if (store.selectedDocument) {
    documentTitle.value = store.selectedDocument?.title || '';
  } else {
    documentTitle.value = '';  // En caso de creación, el título debe estar vacío
  }
});

// Computed properties for form validation
const isSaveButtonEnabled = computed(() => documentTitle.value.trim().length > 0);

/**
 * Handle form submission.
 */
 function handleSubmit() {
  const encodedName = encodeURIComponent(documentTitle.value.trim());
  
  if (props.documentId && !store.selectedDocument) {
    // Create a new document
    router.push(`/dynamic_document_dashboard/document/use/creator/${props.documentId}/${encodedName}`);
  } else if (store.selectedDocument) {
    const encodedName = encodeURIComponent(documentTitle.value.trim());
    // Edit a document
    router.push(`/dynamic_document_dashboard/document/use/editor/${store.selectedDocument.id}/${encodedName}`);
  } else {
    alert("Error: No se pudo continuar. Documento no seleccionado.");
  }
}
</script>
