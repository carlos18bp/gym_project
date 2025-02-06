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
              v-model="formData.documentName"
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
          <span>Continuar</span>
        </button>
      </form>
    </div>
  </template>
  <script setup>
  import { XMarkIcon } from "@heroicons/vue/24/outline";
  import { computed, reactive } from "vue";
  import { useRouter } from "vue-router";
  
  // Initialize the Vue Router for navigation
  const router = useRouter();
  
  // Reactive object to store form data
  const formData = reactive({
    documentName: null, // Holds the input value for the document name
  });
  
  /**
   * Computes whether the save button should be enabled based on form validation.
   * - The button is enabled if the document name is not empty after trimming whitespace.
   */
  const isSaveButtonEnabled = computed(() => {
    return formData.documentName?.trim().length > 0; // Checks if the document name is valid
  });
  
  /**
   * Handles the form submission when the save button is clicked.
   * - Validates the form to ensure the document name is provided.
   * - URL-encodes the document name to make it safe for inclusion in a URL.
   * - Redirects the user to the new document creation route.
   */
  function handleSubmit() {
    if (isSaveButtonEnabled.value) {
      const encodedName = encodeURIComponent(formData.documentName.trim()); // Encode the document name for URL safety
      router.push(`/dynamic_document_dashboard/document/use/${encodedName}`); // Navigate to the new document creation route
    }
  }
  </script>