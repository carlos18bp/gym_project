<template>
  <div class="mt-8 flex flex-wrap gap-6">
    <!-- Contract Published -->
    <div
      class="flex items-center gap-3 py-2 px-4 border rounded-xl border-green-400 bg-green-300/30"
    >
      <CheckCircleIcon class="size-6 text-green-500"></CheckCircleIcon>
      <div class="grid gap-1">
        <span class="text-base font-medium">Prestación de Servicios</span>
        <span class="text-sm font-regular text-gray-400">Carlos Velez</span>
      </div>
      <Menu as="div" class="relative inline-block text-left">
        <div>
          <MenuButton class="flex items-center text-gray-400">
            <span class="sr-only">Open options</span>
            <EllipsisVerticalIcon class="size-6" aria-hidden="true" />
          </MenuButton>
        </div>

        <transition
          enter-active-class="transition ease-out duration-100"
          enter-from-class="transform opacity-0 scale-95"
          enter-to-class="transform opacity-100 scale-100"
          leave-active-class="transition ease-in duration-75"
          leave-from-class="transform opacity-100 scale-100"
          leave-to-class="transform opacity-0 scale-95"
        >
          <MenuItems
            class="absolute left-0 z-10 mt-2 w-56 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black/5 focus:outline-none"
          >
            <div class="py-1">
              <MenuItem v-for="option in contractFinishedOptions">
                <a
                  @click="handleOptionClick(option)"
                  class="bg-gray-100 block px-4 py-2 text-sm font-regular"
                  >{{ option.label }}</a
                >
              </MenuItem>
            </div>
          </MenuItems>
        </transition>
      </Menu>
    </div>
  </div>
</template>

<script setup>
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/vue";
import {
  CheckCircleIcon,
  EllipsisVerticalIcon,
} from "@heroicons/vue/24/outline";

// Define the emits for communication with the parent component
const emit = defineEmits(["show-send-contract-modal"]);

// Array of options displayed in the menu, each option has a label and an action
const contractFinishedOptions = [
  { label: "Enviar", action: "showModal" }, // This option triggers the modal
  { label: "Datos", action: "" }, // Placeholder for another action
  { label: "Previsualización", action: "" }, // Placeholder for preview action
  { label: "Descargar", action: "" }, // Placeholder for download action
];

// Function to emit the 'show-send-contract-modal' event to the parent component
const emitShowModal = () => {
  emit("show-send-contract-modal");
};

// Function to handle the click event on a menu option
// If the option's action is 'showModal', it calls emitShowModal to notify the parent
const handleOptionClick = (option) => {
  if (option.action === "showModal") {
    emitShowModal();
  }
};
</script>
