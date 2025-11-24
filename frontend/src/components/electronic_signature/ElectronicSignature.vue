<template>
  <div>
    <!-- If no signature exists or we're in modal mode, show signature options directly -->
    <div v-if="!savedSignature || forceShowOptions">
      <!-- Signature type selection modal without ModalTransition -->
      <SignatureModal 
        v-if="isModalOpen"
        @close="closeModal" 
        @selectType="selectSignatureType" 
      />
      
      <!-- Image upload signature component -->
      <div v-if="currentSignatureType === 'upload'" class="my-4">
        <ImageUploadSignature
          :is-submitting="isSubmitting"
          @save="saveSignature"
          @cancel="closeSignatureMode"
        />
      </div>
      
      <!-- Draw signature component -->
      <div v-if="currentSignatureType === 'draw'" class="my-4">
        <DrawSignature
          :is-submitting="isSubmitting"
          @save="saveSignature"
          @cancel="closeSignatureMode"
        />
      </div>
      
      <!-- Direct signature options if no type selected yet -->
      <div v-if="!currentSignatureType && !isModalOpen" class="my-4">
        <div class="p-6 bg-white rounded-lg border border-stroke">
          <div class="text-center mb-8">
            <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-terciary mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6 text-secondary">
                <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
              </svg>
            </div>
            <h3 class="text-lg font-medium text-primary">
              Añadir firma electrónica
            </h3>
            <p class="text-sm text-gray-500 mt-2">
              Selecciona el método para añadir tu firma electrónica. Puedes subir una imagen o dibujarla directamente.
            </p>
          </div>
          
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
    </div>
    
    <!-- Saved signature preview (only show if not forcing options) -->
    <div v-if="savedSignature && !forceShowOptions && !currentSignatureType" class="mt-4">
      <div class="bg-white p-4 border border-stroke rounded-lg">
        <div class="flex justify-between items-center mb-2">
          <h3 class="text-sm font-medium text-primary">Tu firma guardada</h3>
          <div class="flex space-x-2">
            <button 
              @click="forceShowOptions = true"
              class="inline-flex items-center text-xs text-secondary hover:text-blue-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 mr-1">
                <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
              </svg>
              Cambiar
            </button>
          </div>
        </div>
        
        <div class="relative">
          <img 
            :src="getSignatureImage(savedSignature)" 
            alt="Firma guardada" 
            class="max-h-24 mx-auto bg-white p-1 border border-gray-200 rounded"
          />
          <div class="mt-2 text-xs text-gray-500 flex justify-between" v-if="getSignatureDate(savedSignature)">
            <span>Creada: {{ formatDate(getSignatureDate(savedSignature)) }}</span>
            <span>Método: {{ getSignatureMethod(savedSignature) === 'upload' ? 'Subida' : 'Dibujada' }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import SignatureModal from './SignatureModal.vue';
import ImageUploadSignature from './ImageUploadSignature.vue';
import DrawSignature from './DrawSignature.vue';
import { useUserStore } from '@/stores/auth/user';
import { useAuthStore } from '@/stores/auth/auth';

/**
 * Main electronic signature component
 * Manages signature creation, storage and display
 * @emits {signatureSaved} - When a signature is saved
 * @emits {cancel} - When the operation is cancelled
 */
const emit = defineEmits(['signatureSaved', 'cancel']);

const props = defineProps({
  /** 
   * Whether to force showing options even if signature exists
   * @type {Boolean}
   */
  initialShowOptions: {
    type: Boolean,
    default: false
  },
  /**
   * User ID for signature update
   * @type {String|Number}
   */
  userId: {
    type: [String, Number],
    required: false
  }
});

const userStore = useUserStore();
const authStore = useAuthStore();
const isModalOpen = ref(false);
const currentSignatureType = ref(null);
const savedSignature = ref(null);
const forceShowOptions = ref(props.initialShowOptions);
const isSubmitting = ref(false);

// Load saved signature from user store if exists
const storedSignature = userStore.userSignature;
if (storedSignature) {
  savedSignature.value = storedSignature;
}

// Auto-open modal if no signature exists
onMounted(() => {
  if (!savedSignature.value || forceShowOptions.value) {
    // Skip the modal and directly show options
    isModalOpen.value = false;
  }
});

/**
 * Open signature selection modal
 */
const openModal = () => {
  isModalOpen.value = true;
};

/**
 * Close signature selection modal
 */
const closeModal = () => {
  isModalOpen.value = false;
};

/**
 * Handle signature type selection
 * @param {String} type - Selected signature type ('upload' or 'draw')
 */
const selectSignatureType = (type) => {
  currentSignatureType.value = type;
  closeModal();
};

/**
 * Close signature creation mode
 */
const closeSignatureMode = () => {
  currentSignatureType.value = null;
  forceShowOptions.value = false;
  emit('cancel');
};

/**
 * Save signature data and store in user store
 * @param {Object} data - Signature data including image and traceability info
 */
const saveSignature = async (data) => {
  isSubmitting.value = true;
  
  try {
    // Get the user ID
    const userId = props.userId || authStore.userAuth.id;
    if (!userId) {
      throw new Error("No user ID available");
    }
    
    // Create FormData object for the API request
    const formData = new FormData();
    
    // Add method to FormData
    formData.append('method', data.traceabilityData.method);
    
    // Handle file upload - check if we have an original file from the upload component
    if (data.originalFile && data.originalFile instanceof File) {
      formData.append('signature_image', data.originalFile);
    } 
    // Otherwise, if we have a base64 image (e.g., from drawing)
    else if (data.signatureImage && typeof data.signatureImage === 'string') {
      // Check if the image is a data URL (starts with "data:")
      const isDataUrl = data.signatureImage.startsWith('data:');
      
      if (isDataUrl) {
        // Extract the base64 part from data URL
        const parts = data.signatureImage.split(';base64,');
        if (parts.length !== 2) {
          throw new Error("Invalid data URL format");
        }
        
        const contentType = parts[0].replace('data:', '');
        const base64Data = parts[1];
        
        // Convert base64 to binary
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        // Create blob and file
        const blob = new Blob([bytes], { type: contentType });
        const filename = `signature_${userId}_${Date.now()}.png`;
        const file = new File([blob], filename, { type: contentType });
        
        formData.append('signature_image', file);
      } else {
        throw new Error("Image data is not in expected format (should be data URL)");
      }
    } else {
      throw new Error("No valid signature image data available");
    }
    
    // Send to the backend
    const success = await userStore.updateUserSignature({
      formData: formData,
      userId: userId
    });
    
    if (success) {
      // Save locally for component use
      savedSignature.value = data;
      
      // Emit event to notify parent component
      emit('signatureSaved', data);
      
      // Reset UI state
      currentSignatureType.value = null;
      forceShowOptions.value = false;
    }
  } catch (error) {
    console.error('ElectronicSignature: Error processing signature:', error);
  } finally {
    isSubmitting.value = false;
  }
};

/**
 * Get signature image URL from either backend or local format
 * @param {Object} signature - Signature object
 * @returns {String} Image URL
 */
const getSignatureImage = (signature) => {
  if (!signature) return '';
  
  // Check if it's from backend (has 'signature' property)
  if (signature.signature && signature.signature.signature_image) {
    return signature.signature.signature_image;
  }
  
  // Check if it's local format (has 'signatureImage' property)
  if (signature.signatureImage) {
    return signature.signatureImage;
  }
  
  return '';
};

/**
 * Get signature creation date from either backend or local format
 * @param {Object} signature - Signature object
 * @returns {String|null} Date string or null
 */
const getSignatureDate = (signature) => {
  if (!signature) return null;
  
  // Check if it's from backend
  if (signature.signature && signature.signature.created_at) {
    return signature.signature.created_at;
  }
  
  // Check if it's local format
  if (signature.traceabilityData && signature.traceabilityData.date) {
    return signature.traceabilityData.date;
  }
  
  return null;
};

/**
 * Get signature method from either backend or local format
 * @param {Object} signature - Signature object
 * @returns {String} Method ('upload' or 'draw')
 */
const getSignatureMethod = (signature) => {
  if (!signature) return '';
  
  // Check if it's from backend
  if (signature.signature && signature.signature.method) {
    return signature.signature.method;
  }
  
  // Check if it's local format
  if (signature.traceabilityData && signature.traceabilityData.method) {
    return signature.traceabilityData.method;
  }
  
  return '';
};

/**
 * Format date for display
 * @param {String} dateString - ISO date string
 * @returns {String} Formatted date string
 */
const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleString();
};
</script> 