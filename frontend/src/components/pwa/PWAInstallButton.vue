<template>
  <li v-if="!isAppInstalled">
    <a
      @click="promptInstall"
      class="group flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6 text-primary cursor-pointer hover:bg-gray-50 hover:text-secondary"
    >
      <ArrowDownTrayIcon
        class="h-6 w-6 shrink-0 text-primary group-hover:text-secondary"
        aria-hidden="true"
      ></ArrowDownTrayIcon>
      <span>Instalar Aplicación</span>
      <div
        class="flex justify-center items-center bg-purple-100 text-purple-600 text-xs px-1.5 py-0.5 rounded-full"
      >
        <SparklesIcon class="h-4 w-4 shrink-0"></SparklesIcon>
      </div>
    </a>
  </li>

  <!-- Instructions Modal -->
  <PWAInstallInstructionsModal
    :is-open="showInstructionsModal"
    :browser="currentBrowser"
    @close="closeInstructionsModal"
  />
</template>

<script setup>
import { ArrowDownTrayIcon, SparklesIcon } from "@heroicons/vue/20/solid";
import { usePWAInstall } from "@/composables/usePWAInstall";
import PWAInstallInstructionsModal from "./PWAInstallInstructionsModal.vue";

const { isAppInstalled, showInstructionsModal, currentBrowser, promptInstall, closeInstructionsModal } = usePWAInstall();
</script>
