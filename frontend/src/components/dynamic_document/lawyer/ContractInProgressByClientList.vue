<template>
  <div class="mt-8 flex flex-wrap gap-6">
    <div
      class="flex items-center gap-3 py-2 px-4 border rounded-xl border-stroke bg-white"
    >
      <PencilIcon class="size-6 text-secondary"></PencilIcon>
      <div class="grid gap-1">
        <span class="text-base font-medium">Arriendo 2025</span>
        <span class="text-sm font-regular text-gray-400">Manuela Olivares</span>
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
              <MenuItem v-for="option in contractEditingOptions">
                <a class="bg-gray-100 block px-4 py-2 text-sm font-regular">{{
                  option.label
                }}</a>
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
import { PencilIcon, EllipsisVerticalIcon } from "@heroicons/vue/24/outline";

const contractEditingOptions = [
  { label: "Enviar", action: "" },
  { label: "Datos", action: "" },
  { label: "Completar", action: "" },
  { label: "Previsualización", action: "" },
  { label: "Descargar", action: "" },
];
</script>
