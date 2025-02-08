<template>
  <div class="bg-white rounded-lg p-6 shadow-xl max-w-lg w-full">
    <div class="flex justify-end">
      <button @click="$emit('close')">
        <XMarkIcon class="size-6"></XMarkIcon>
      </button>
    </div>
    <form @submit.prevent="handleSubmit">
      <!-- Emial address -->
      <div>
        <label
          for="email"
          class="block text-base font-medium leading-6 text-primary"
        >
          Correo electronico
          <span class="text-red-500">*</span>
        </label>
        <div class="mt-2">
          <input
            v-model="formData.email"
            type="text"
            name="email"
            id="email"
            class="block w-full rounded-md border-0 py-1.5 text-primary shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-secondary sm:text-sm sm:leading-6"
            required
          />
        </div>
      </div>
      <!-- Send Button -->
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
        <span>Enviar</span>
      </button>
    </form>
  </div>
</template>
<script setup>
import { XMarkIcon } from "@heroicons/vue/24/outline";
import { computed, reactive } from "vue";

// Reactive form data
const formData = reactive({
  email: null, // Stores the email input from the user
});

/**
 * Computes whether the save button should be enabled based on form validation.
 * - The button is enabled only if the email input is not empty and contains valid characters.
 */
const isSaveButtonEnabled = computed(() => {
  return formData.email?.trim().length > 0; // Checks if the email field has a non-empty value
});

/**
 * Handles the form submission when the save button is clicked.
 * - Logs a message indicating that the email is being sent with the document.
 */
function handleSubmit() {
  console.log("Send email with the document");
}
</script>
