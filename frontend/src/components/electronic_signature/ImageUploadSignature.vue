<template>
  <div class="p-4 bg-white rounded-lg border border-stroke">
    <div class="flex flex-col items-center justify-center space-y-4">
      <!-- Back button -->
      <div class="self-start mb-2">
        <button 
          @click="cancel" 
          class="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 mr-1">
            <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Volver
        </button>
      </div>
      
      <div v-if="!previewUrl" class="w-full flex items-center justify-center flex-col border-2 border-dashed border-stroke rounded-lg p-6 cursor-pointer hover:bg-terciary" @click="triggerFileInput">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-10 h-10 text-secondary mb-2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
        </svg>
        <div class="text-sm text-gray-500">
          Haz clic para subir una imagen o arrástrala aquí
        </div>
        <div class="text-xs text-gray-400 mt-1">
          PNG o JPG (Máx. 2MB)
        </div>
      </div>
      
      <div v-else class="relative w-full">
        <img :src="previewUrl" alt="Firma" class="mx-auto max-h-64 bg-white p-2 border border-gray-200 rounded-lg">
        <button 
          @click="clearImage" 
          class="absolute -top-2 -right-2 bg-red-100 rounded-full p-1 text-red-500 shadow-sm hover:bg-red-200"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      <input 
        type="file" 
        ref="fileInput" 
        accept="image/png,image/jpeg" 
        class="hidden" 
        @change="handleFileChange"
      />
      
      <div v-if="previewUrl" class="w-full flex justify-center">
        <button 
          type="button" 
          class="inline-flex justify-center rounded-md border border-transparent px-4 py-2 bg-secondary text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary"
          @click="saveSignature"
          :disabled="isSubmitting"
        >
          <svg v-if="isSubmitting" class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          {{ isSubmitting ? 'Guardando...' : 'Guardar' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useUserStore } from '@/stores/auth/user';

/**
 * Component for uploading signature image
 * @emits {save} - When signature is saved
 * @emits {cancel} - When operation is cancelled
 */
const emit = defineEmits(['save', 'cancel']);

const props = defineProps({
  isSubmitting: {
    type: Boolean,
    default: false
  }
});

const fileInput = ref(null);
const previewUrl = ref(null);
const selectedFile = ref(null);
const userStore = useUserStore();

/**
 * Trigger file input click to open file dialog
 */
const triggerFileInput = () => {
  fileInput.value.click();
};

/**
 * Handle file selection
 * Validates file type and size, then creates a preview
 * @param {Event} event - Change event from file input
 */
const handleFileChange = (event) => {
  const file = event.target.files[0];
  if (!file) return;
  
  // Size validation (max 2MB)
  if (file.size > 2 * 1024 * 1024) {
    alert('La imagen es demasiado grande. El tamaño máximo es 2MB.');
    return;
  }
  
  // Type validation
  if (!['image/png', 'image/jpeg'].includes(file.type)) {
    alert('Solo se permiten archivos PNG o JPG.');
    return;
  }
  
  // Store the file reference
  selectedFile.value = file;
  
  // Create preview URL
  const reader = new FileReader();
  reader.onload = (e) => {
    previewUrl.value = e.target.result;
  };
  reader.readAsDataURL(file);
};

/**
 * Clear selected image and reset file input
 */
const clearImage = () => {
  previewUrl.value = null;
  selectedFile.value = null;
  fileInput.value.value = '';
};

/**
 * Save signature and emit save event with signature data
 */
const saveSignature = () => {
  if (!previewUrl.value) {
    console.error("No preview URL available");
    return;
  }
  
  // Record traceability data
  const traceabilityData = {
    date: new Date().toISOString(),
    method: 'upload'
  };
  
  // Save signature in the user store
  userStore.userSignature = {
    has_signature: true,
    signature: {
      signature_image: previewUrl.value,
      method: traceabilityData.method,
      created_at: traceabilityData.date
    }
  };
  
  emit('save', {
    signatureImage: previewUrl.value,
    originalFile: selectedFile.value,
    traceabilityData
  });
};

/**
 * Cancel operation and emit cancel event
 */
const cancel = () => {
  emit('cancel');
};
</script> 