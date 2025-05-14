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
        <span class="font-medium text-base">Documentos</span>
        <span class="text-gray-400 font-regular text-sm">Mi unidad</span>
      </div>
    </button>
    <button
      @click="handleSection('documentFinished')"
      class="flex gap-2 items-center py-2 px-4 rounded-xl border-2 border-yellow-300 bg-white text-start"
      :class="{ 'bg-yellow-300/30': currentSection == 'documentFinished' }"
    >
      <FolderIcon class="size-6 text-yellow-500 font-semibold"></FolderIcon>
      <div class="grid">
        <span class="font-medium text-base">Documentos Finalizados</span>
        <span class="text-gray-400 font-regular text-sm">Clientes</span>
      </div>
    </button>
    <button
      @click="handleSection('documentInProgress')"
      class="flex gap-2 items-center py-2 px-4 rounded-xl border-2 border-yellow-300 bg-white text-start"
      :class="{ 'bg-yellow-300/30': currentSection == 'documentInProgress' }"
    >
      <FolderIcon class="size-6 text-yellow-500 font-semibold"></FolderIcon>
      <div class="grid">
        <span class="font-medium text-base">Documentos en Progreso</span>
        <span class="text-gray-400 font-regular text-sm">Clientes</span>
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
        <span class="font-medium text-base">Nuevo Documento</span>
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
        @signatureSaved="handleSignatureSaved" 
        @cancel="showElectronicSignatureModal = false"
      />
    </div>
  </ModalTransition>
</template>

<script setup>
import { ref } from "vue";
import { FolderIcon, PlusIcon, FingerPrintIcon, XMarkIcon } from "@heroicons/vue/24/outline";
import ModalTransition from "@/components/layouts/animations/ModalTransition.vue";
import ElectronicSignature from "@/components/electronic_signature/ElectronicSignature.vue";

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
const handleSignatureSaved = (signatureData) => {
  console.log('Signature saved:', signatureData);
  // In a real implementation, this would interact with your API/store
  
  // Close the modal after saving the signature
  showElectronicSignatureModal.value = false;
};
</script>
