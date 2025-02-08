<template>
    <div class="mt-8 flex flex-wrap gap-6">
      <!-- Use a document -->
      <button
        @click="showUseDocumentModal = true"
        class="flex items-center gap-3 py-2 px-4 border rounded-xl border-stroke bg-white"
      >
        <DocumentArrowUpIcon class="size-6 text-secondary"></DocumentArrowUpIcon>
        <div class="grid gap-1">
          <span class="text-base font-medium">Cobro de honorarios</span>
        </div>
        <ChevronRightIcon class="size-6 text-gray-400" aria-hidden="true" />
      </button>
    </div>
    <ModalTransition v-show="showUseDocumentModal">
        <UseDocumentByClient @close="showUseDocumentModal = false"></UseDocumentByClient>
    </ModalTransition>
  </template>
  
  <script setup>
  import {
    ChevronRightIcon,
    DocumentArrowUpIcon,
  } from "@heroicons/vue/24/outline";
  import ModalTransition from "@/components/layouts/animations/ModalTransition.vue"
  import UseDocumentByClient from "@/components/dynamic_document/client/modals/UseDocumentByClient.vue";
  import { ref } from "vue";

  const showUseDocumentModal = ref(false)
  </script>