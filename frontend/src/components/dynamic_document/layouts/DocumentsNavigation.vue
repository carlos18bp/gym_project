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
</template>

<script setup>
import { defineProps, ref } from "vue";
import { FolderIcon, PlusIcon } from "@heroicons/vue/24/outline";

// Define events that the component can emit
const emit = defineEmits(["updateCurrentSection", "openNewDocument"]);

// Reactive reference to keep track of the current section
const currentSection = ref("default");

// Define properties received from the parent component
const props = defineProps({
  role: String, // The role of the user (e.g., 'lawyer', 'client')
});

// Function to handle section changes
// - `sectionName`: The name of the section to switch to
const handleSection = (sectionName) => {
  currentSection.value = sectionName; // Update the current section
  emit("updateCurrentSection", sectionName); // Emit an event to notify the parent component
};
</script>
