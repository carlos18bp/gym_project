<template>
  <div class="bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl sm:my-8 sm:max-w-lg sm:w-full sm:p-6">
    <div>
      <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-terciary">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6 text-secondary">
          <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
        </svg>
      </div>
      <div class="mt-3 text-center sm:mt-5">
        <h3 class="text-lg leading-6 font-medium text-primary">
          Añadir firma electrónica
        </h3>
        <div class="mt-2">
          <p class="text-sm text-gray-500">
            Selecciona el método para añadir tu firma electrónica. Puedes subir una imagen o dibujarla directamente.
          </p>
        </div>
      </div>
    </div>

    <div class="mt-5 sm:mt-6 space-y-4">
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <button
          type="button"
          class="inline-flex justify-center w-full rounded-md border border-stroke shadow-sm px-4 py-2 bg-white text-base font-medium text-primary hover:bg-terciary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary sm:text-sm"
          @click="selectSignatureType('upload')"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 mr-2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          Subir imagen
        </button>
        <button
          type="button"
          class="inline-flex justify-center w-full rounded-md border border-stroke shadow-sm px-4 py-2 bg-white text-base font-medium text-primary hover:bg-terciary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary sm:text-sm"
          @click="selectSignatureType('draw')"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 mr-2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M7.864 4.243A7.5 7.5 0 0119.5 10.5c0 2.92-.556 5.709-1.568 8.268M5.742 6.364A7.465 7.465 0 004.5 10.5a7.464 7.464 0 01-1.15 3.993m1.989 3.559A11.209 11.209 0 008.25 10.5a3.75 3.75 0 117.5 0c0 .527-.021 1.049-.064 1.565M12 10.5a14.94 14.94 0 01-3.6 9.75m6.633-4.596a18.666 18.666 0 01-2.485 5.33" />
          </svg>
          Dibujar firma
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue';

/**
 * Modal component for selecting electronic signature type
 * Contains only the white box content to be used with ModalTransition component
 * @emits {close} - When modal is closed
 * @emits {selectType} - When a signature type is selected
 */
const emit = defineEmits(['close', 'selectType']);

/**
 * Close the modal and emit close event
 */
const closeModal = () => {
  emit('close');
};

/**
 * Handle selection of signature type
 * @param {String} type - Type of signature ('upload' or 'draw')
 */
const selectSignatureType = (type) => {
  emit('selectType', type);
};
</script> 