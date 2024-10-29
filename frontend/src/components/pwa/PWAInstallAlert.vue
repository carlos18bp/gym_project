<template>
  <div
    v-if="!isAppInstalled"
    ref="alert"
    class="fixed top-4 right-4 z-50 bg-blue-50 p-4 rounded-md shadow-lg opacity-0"
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
import { InformationCircleIcon } from '@heroicons/vue/20/solid';
import gsap from "gsap";

// Destructure values from the usePWAInstall composable
const { isAppInstalled, promptInstall } = usePWAInstall();
const alert = ref(null); // Reference to the alert element for animation

onMounted(() => {
  // Opacity animation for the alert using GSAP
  gsap.to(alert.value, {
    opacity: 1,          // Sets opacity to fully visible
    duration: 1,         // Duration of fade-in animation
  });

  // Fade-out animation after 15 seconds
  gsap.to(alert.value, {
    opacity: 0,          // Fades out opacity
    delay: 15,           // Starts fade-out after 15 seconds
    duration: 1,         // Duration of fade-out animation
    onComplete: () => {
      isAppInstalled.value = true; // Hides the alert once the animation completes
    },
  });
});
</script>

