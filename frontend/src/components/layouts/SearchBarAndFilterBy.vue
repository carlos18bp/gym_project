<template>
  <div
    class="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8"
  >
    <!-- Menu Button -->
    <slot></slot>
    <!-- Separator -->
    <div class="h-6 w-px bg-gray-200 lg:hidden" aria-hidden="true" />

    <div class="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
      <form class="relative flex flex-1" @submit.prevent>
        <label for="search-field" class="sr-only">Buscar</label>
        <MagnifyingGlassIcon
          class="pointer-events-none absolute inset-y-0 left-0 h-full w-5 text-gray-400"
          aria-hidden="true"
        />
        <input
          id="search-field"
          class="block h-full w-full border-0 py-0 pl-8 pr-0 text-gray-900 placeholder:text-gray-400 focus:ring-0 sm:text-sm"
          placeholder="Buscar"
          type="search"
          name="search"
          v-model="searchQuery"
          @input="updateSearchQuery"
        />
      </form>
      <div class="flex items-center gap-x-6 font-medium">
        <!-- Separator -->
        <div
          class="hidden lg:block lg:h-6 lg:w-px lg:bg-gray-200"
          aria-hidden="true"
        />
      </div>
    </div>
    <slot name="auxiliary_button"></slot>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { MagnifyingGlassIcon } from "@heroicons/vue/20/solid";

// Emits definition
const emit = defineEmits(["update:searchQuery"]);

// Reactive search query
const searchQuery = ref("");

// Emit the updated search query
const updateSearchQuery = () => {
  emit("update:searchQuery", searchQuery.value);
};
</script>
