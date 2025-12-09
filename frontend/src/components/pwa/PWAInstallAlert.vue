<template>
  <div
    v-if="showAlert && !isAppInstalled"
    ref="alert"
    class="fixed w-full top-4 xl:bottom-4 xl:top-auto left-1/2 transform -translate-x-1/2 z-50 bg-blue-50 p-4 rounded-md shadow-lg opacity-0 md:w-auto"
  >
    <div class="flex items-center">
      <InformationCircleIcon
        class="h-5 w-5 text-blue-400 flex-shrink-0"
        aria-hidden="true"
      />
      <div class="ml-3 flex-1 md:flex md:justify-between">
        <p class="text-sm text-blue-700">
          Estás usando la versión web. Instala nuestra aplicación para una mejor
          experiencia.
        </p>
        <button
          @click="promptInstall"
          class="mt-3 text-sm font-medium text-blue-700 hover:text-blue-600 md:ml-6 md:mt-0"
        >
          Instalar aplicación
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { usePWAInstall } from "@/composables/usePWAInstall";
import { InformationCircleIcon } from "@heroicons/vue/20/solid";
import gsap from "gsap";

// Destructure values from the usePWAInstall composable
const { isAppInstalled, promptInstall } = usePWAInstall();
const alert = ref(null); // Reference to the alert element for animation
const showAlert = ref(true); // Local state to control alert visibility

onMounted(() => {
  // Only animate if the alert element exists (not installed and should show)
  if (!alert.value || isAppInstalled.value) return;
  
  // Opacity animation for the alert using GSAP
  gsap.to(alert.value, {
    opacity: 1, // Sets opacity to fully visible
    duration: 1, // Duration of fade-in animation
  });

  // Fade-out animation after 3.5 seconds
  gsap.to(alert.value, {
    opacity: 0, // Fades out opacity
    delay: 3.5, // Starts fade-out after 3.5 seconds
    duration: 1, // Duration of fade-out animation
    onComplete: () => {
      showAlert.value = false; // Hides the alert locally without affecting global state
    },
  });
});
</script>
