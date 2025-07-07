<template>
  <!-- Buttons panel for client -->
  <div
    v-if="props?.role === 'lawyer'"
    class="pb-8 border-b border-gray-200 flex gap-6 flex-wrap"
  >
    <button
      @click="handleSection('default')"
      class="flex gap-2 items-center py-2 px-4 rounded-xl border-2 border-yellow-300 text-start bg-white"
      :class="{ 'bg-yellow-300/30': currentSection == 'default' }"
    >
      <FolderIcon class="size-6 text-yellow-500 font-semibold"></FolderIcon>
      <div class="grid">
        <span class="font-medium text-base">Minutas y Documentos</span>
        <span class="text-gray-400 font-regular text-sm">Mi unidad</span>
      </div>
    </button>
    <button
      @click="showElectronicSignatureModal = true"
      class="flex gap-2 items-center py-2 px-4 rounded-xl border-2 border-purple-300 bg-white text-start hover:bg-purple-200"
    >
      <FingerPrintIcon class="size-6 text-purple-500 font-semibold"></FingerPrintIcon>
      <div class="grid">
        <span class="font-medium text-base">Firma Electrónica</span>
        <span class="text-gray-400 font-regular text-sm">Documentos</span>
      </div>
    </button>
    <button
      @click="$emit('openNewDocument')"
      class="flex gap-2 items-center py-2 px-4 rounded-md bg-white text-start hover:bg-gray-100"
    >
      <PlusIcon class="size-6 text-secondary font-semibold"></PlusIcon>
      <div class="grid">
        <span class="font-medium text-base">Nueva Minuta</span>
      </div>
    </button>
  </div>
  <!-- Buttons panel for client -->
  <div
    v-if="props?.role === 'client'"
    class="pb-8 border-b border-gray-200 flex gap-6 flex-wrap"
  >
    <!--Default section button-->
    <button
      @click="handleSection('default')"
      class="flex gap-2 items-center py-2 px-4 rounded-md border-2 border-yellow-300 bg-white text-start"
      :class="{ 'bg-yellow-300/30': currentSection == 'default' }"
    >
      <FolderIcon class="size-6 text-yellow-500 font-semibold"></FolderIcon>
      <div class="grid">
        <span class="font-medium text-base">Mis Documentos</span>
      </div>
    </button>
    <!--Electronic signature button for client-->
    <button
      @click="showElectronicSignatureModal = true"
      class="flex gap-2 items-center py-2 px-4 rounded-md border-2 border-purple-300 bg-white text-start hover:bg-purple-200"
    >
      <FingerPrintIcon class="size-6 text-purple-500 font-semibold"></FingerPrintIcon>
      <div class="grid">
        <span class="font-medium text-base">Firma Electrónica</span>
      </div>
    </button>
    <!--Create document button-->
    <button
      @click="handleSection('useDocument')"
      class="flex gap-2 items-center py-2 px-4 rounded-md bg-white text-start hover:bg-gray-100"
      :class="{ 'bg-selected-background': currentSection == 'useDocument' }"
    >
      <PlusIcon class="size-6 text-secondary font-semibold"></PlusIcon>
      <div class="grid">
        <span class="font-medium text-base">Nuevo Documento</span>
      </div>
    </button>
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
</template>

<script setup>
import { ref, onMounted } from "vue";
import { FolderIcon, PlusIcon, FingerPrintIcon, XMarkIcon } from "@heroicons/vue/24/outline";
import ModalTransition from "@/components/layouts/animations/ModalTransition.vue";
import ElectronicSignature from "@/components/electronic_signature/ElectronicSignature.vue";
import { useUserStore } from "@/stores/user";
import { useAuthStore } from "@/stores/auth";
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
const emit = defineEmits(["updateCurrentSection", "openNewDocument"]);

// Reactive reference to keep track of the current section
const currentSection = ref("default");
const showElectronicSignatureModal = ref(false);

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
</script>
