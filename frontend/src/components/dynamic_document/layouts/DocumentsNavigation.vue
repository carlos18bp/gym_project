<template>
  <!-- Buttons panel for lawyer -->
  <div
    v-if="props?.role === 'lawyer'"
    class="pb-4 border-b border-gray-200"
  >
    <!-- Desktop Layout - Minimalist buttons aligned to the right -->
    <div class="hidden sm:flex gap-3 justify-end">
      <button
        @click="showElectronicSignatureModal = true"
        class="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-purple-200 bg-white text-sm font-medium text-gray-700 hover:bg-purple-50 hover:border-purple-300 transition-all duration-200"
      >
        <FingerPrintIcon class="size-5 text-purple-500"></FingerPrintIcon>
        <span>Firma Electrónica</span>
      </button>
      <button
        @click="showGlobalLetterheadModal = true"
        class="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-green-200 bg-white text-sm font-medium text-gray-700 hover:bg-green-50 hover:border-green-300 transition-all duration-200"
      >
        <DocumentTextIcon class="size-5 text-green-500"></DocumentTextIcon>
        <span>Membrete Global</span>
      </button>
      <button
        @click="$emit('openNewDocument')"
        class="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-secondary bg-secondary text-sm font-medium text-white hover:bg-blue-700 transition-all duration-200"
      >
        <PlusIcon class="size-5"></PlusIcon>
        <span>Nueva Minuta</span>
      </button>
    </div>

    <!-- Mobile Layout -->
    <div class="sm:hidden grid grid-cols-3 gap-2">
      <button
        @click="showElectronicSignatureModal = true"
        class="flex flex-col items-center justify-center py-3 px-2 rounded-lg border border-purple-200 bg-white text-center transition-all duration-200 hover:bg-purple-50"
      >
        <FingerPrintIcon class="size-6 text-purple-500 mb-1"></FingerPrintIcon>
        <span class="font-medium text-xs leading-tight">Firma</span>
      </button>
      <button
        @click="showGlobalLetterheadModal = true"
        class="flex flex-col items-center justify-center py-3 px-2 rounded-lg border border-green-200 bg-white text-center transition-all duration-200 hover:bg-green-50"
      >
        <DocumentTextIcon class="size-6 text-green-500 mb-1"></DocumentTextIcon>
        <span class="font-medium text-xs leading-tight">Membrete</span>
      </button>
      <button
        @click="$emit('openNewDocument')"
        class="flex flex-col items-center justify-center py-3 px-2 rounded-lg border border-secondary bg-secondary text-white text-center transition-all duration-200 hover:bg-blue-700"
      >
        <PlusIcon class="size-6 mb-1"></PlusIcon>
        <span class="font-medium text-xs leading-tight">Nueva</span>
      </button>
    </div>
  </div>

  <!-- Buttons panel for client, basic, and corporate_client -->
  <div
    v-if="props?.role === 'client' || props?.role === 'basic' || props?.role === 'corporate_client'"
    class="pb-6 border-b border-gray-200"
  >
    <!-- Desktop Layout -->
    <div class="hidden sm:flex gap-4 lg:gap-6">
      <button
        @click="handleSection('default')"
        class="flex gap-3 items-center py-3 px-4 rounded-xl border-2 border-yellow-300 bg-white text-start transition-all duration-200 hover:shadow-md flex-1 min-w-0"
        :class="{ 'bg-yellow-300/30 shadow-md': currentSection == 'default' }"
      >
        <FolderIcon class="size-6 text-yellow-500 font-semibold flex-shrink-0"></FolderIcon>
        <div class="grid">
          <span class="font-medium text-base truncate">Mis Documentos</span>
        </div>
      </button>
      <button
        @click="showElectronicSignatureModal = true"
        class="flex gap-3 items-center py-3 px-4 rounded-xl border-2 border-purple-300 bg-white text-start transition-all duration-200 hover:bg-purple-50 hover:shadow-md flex-1 min-w-0"
      >
        <FingerPrintIcon class="size-6 text-purple-500 font-semibold flex-shrink-0"></FingerPrintIcon>
        <div class="grid">
          <span class="font-medium text-base truncate">Firma Electrónica</span>
        </div>
      </button>
      <button
        @click="showGlobalLetterheadModal = true"
        class="flex gap-3 items-center py-3 px-4 rounded-xl border-2 border-green-300 bg-white text-start transition-all duration-200 hover:bg-green-50 hover:shadow-md flex-1 min-w-0"
      >
        <DocumentTextIcon class="size-6 text-green-500 font-semibold flex-shrink-0"></DocumentTextIcon>
        <div class="grid min-w-0">
          <span class="font-medium text-base truncate">Membrete Global</span>
          <span class="text-gray-400 font-regular text-sm truncate">Para todos los documentos</span>
        </div>
      </button>
      <button
        @click="handleSection('useDocument')"
        class="flex gap-3 items-center py-3 px-4 rounded-xl border-2 border-gray-200 bg-white text-start transition-all duration-200 hover:bg-gray-50 hover:shadow-md hover:border-secondary"
        :class="{ 'bg-selected-background border-secondary': currentSection == 'useDocument' }"
      >
        <PlusIcon class="size-6 text-secondary font-semibold flex-shrink-0"></PlusIcon>
        <div class="grid">
          <span class="font-medium text-base">Nuevo Documento</span>
        </div>
      </button>
    </div>

    <!-- Mobile Layout -->
    <div class="sm:hidden space-y-3">
      <!-- Primary Action - Most Used -->
      <button
        @click="handleSection('default')"
        class="w-full flex gap-3 items-center py-4 px-4 rounded-xl border-2 border-yellow-300 text-start bg-white transition-all duration-200"
        :class="{ 'bg-yellow-300/30 shadow-md': currentSection == 'default' }"
      >
        <FolderIcon class="size-7 text-yellow-500 font-semibold flex-shrink-0"></FolderIcon>
        <div class="grid">
          <span class="font-semibold text-lg">Mis Documentos</span>
        </div>
      </button>
      
      <!-- Secondary Actions - Grid Layout -->
      <div class="grid grid-cols-3 gap-3">
        <button
          @click="showElectronicSignatureModal = true"
          class="flex flex-col items-center justify-center py-4 px-3 rounded-xl border-2 border-purple-300 bg-white text-center transition-all duration-200 hover:bg-purple-50 min-h-[90px]"
        >
          <FingerPrintIcon class="size-8 text-purple-500 font-semibold mb-2"></FingerPrintIcon>
          <span class="font-medium text-sm leading-tight">Firma Electrónica</span>
        </button>
        <button
          @click="showGlobalLetterheadModal = true"
          class="flex flex-col items-center justify-center py-4 px-3 rounded-xl border-2 border-green-300 bg-white text-center transition-all duration-200 hover:bg-green-50 min-h-[90px]"
        >
          <DocumentTextIcon class="size-8 text-green-500 font-semibold mb-2"></DocumentTextIcon>
          <span class="font-medium text-sm leading-tight">Membrete Global</span>
        </button>
        <button
          @click="handleSection('useDocument')"
          class="flex flex-col items-center justify-center py-4 px-3 rounded-xl border-2 border-gray-200 bg-white text-center transition-all duration-200 hover:bg-gray-50 hover:border-secondary min-h-[90px]"
          :class="{ 'bg-selected-background border-secondary': currentSection == 'useDocument' }"
        >
          <PlusIcon class="size-8 text-secondary font-semibold mb-2"></PlusIcon>
          <span class="font-medium text-sm leading-tight">Nuevo Documento</span>
        </button>
      </div>
    </div>
  </div>

  <!-- Electronic Signature Modal -->
  <ModalTransition v-if="showElectronicSignatureModal">
    <div class="bg-white rounded-lg p-6 max-w-2xl w-full mx-auto">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-lg font-medium text-primary">Firma Electrónica</h2>
        <button 
          @click="showElectronicSignatureModal = false" 
          class="text-gray-400 hover:text-gray-500"
        >
          <XMarkIcon class="h-6 w-6" />
        </button>
      </div>
      <ElectronicSignature 
        :initialShowOptions="true"
        :user-id="authStore.userAuth.id"
        @signatureSaved="handleSignatureSaved" 
        @cancel="showElectronicSignatureModal = false"
      />
    </div>
  </ModalTransition>

  <!-- Global Letterhead Modal -->
  <GlobalLetterheadModal
    :is-visible="showGlobalLetterheadModal"
    @close="showGlobalLetterheadModal = false"
    @uploaded="handleGlobalLetterheadUploaded"
    @deleted="handleGlobalLetterheadDeleted"
  />
</template>

<script setup>
import { ref, onMounted } from "vue";
import { FolderIcon, PlusIcon, FingerPrintIcon, XMarkIcon, DocumentTextIcon } from "@heroicons/vue/24/outline";
import ModalTransition from "@/components/layouts/animations/ModalTransition.vue";
import ElectronicSignature from "@/components/electronic_signature/ElectronicSignature.vue";
import GlobalLetterheadModal from "@/components/dynamic_document/common/GlobalLetterheadModal.vue";
import { useUserStore } from "@/stores/auth/user";
import { useAuthStore } from "@/stores/auth/auth";
import { showNotification } from "@/shared/notification_message";

// Get user store to access the current user's ID
const userStore = useUserStore();
// Get auth store to access the authenticated user information
const authStore = useAuthStore();

// Ensure user data is loaded
onMounted(async () => {
  // No need to make additional API calls since the user data is already in the auth store
});

// Define events that the component can emit
const emit = defineEmits(["updateCurrentSection", "openNewDocument", "globalLetterheadUploaded", "globalLetterheadDeleted"]);

// Reactive reference to keep track of the current section
const currentSection = ref("default");
const showElectronicSignatureModal = ref(false);
const showGlobalLetterheadModal = ref(false);

// Define properties received from the parent component
const props = defineProps({
  /**
   * The role of the user (e.g., 'lawyer', 'client').
   * @type {String}
   */
  role: String,
});

/**
 * Handles section changes.
 *
 * @param {String} sectionName - The name of the section to switch to.
 */
const handleSection = (sectionName) => {
  currentSection.value = sectionName; // Update the current section
  emit("updateCurrentSection", sectionName); // Emit an event to notify the parent component
};

/**
 * Handles when a signature is saved.
 *
 * @param {Object} signatureData - The signature data.
 */
const handleSignatureSaved = async (signatureData) => {
  try {
    // Update auth store user data with has_signature = true
    if (authStore.userAuth) {
      authStore.userAuth.has_signature = true;
      // Save updated user auth data to localStorage
      authStore.saveToLocalStorageAuth();
    }
    
    // Show success notification
    showNotification('Firma electrónica guardada correctamente', 'success');
    
    // Close the modal
    showElectronicSignatureModal.value = false;
  } catch (error) {
    console.error('Error updating signature information:', error);
    showNotification('Hubo un problema al guardar la firma', 'error');
  }
};

/**
 * Handles when global letterhead is uploaded.
 *
 * @param {Object} uploadData - The upload response data.
 */
const handleGlobalLetterheadUploaded = (uploadData) => {
  showNotification('Membrete global subido correctamente', 'success');
  emit('globalLetterheadUploaded', uploadData);
};

/**
 * Handles when global letterhead is deleted.
 */
const handleGlobalLetterheadDeleted = () => {
  showNotification('Membrete global eliminado correctamente', 'success');
  emit('globalLetterheadDeleted');
};
</script>
