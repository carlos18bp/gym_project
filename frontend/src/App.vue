<template>
  <RouterView />
  <PWAInstallAlert />
</template>

<script setup>
import { onMounted, ref, watch } from "vue";
import { RouterView } from "vue-router";
import PWAInstallAlert from "@/components/pwa/PWAInstallAlert.vue";
import { useAuthStore } from "@/stores/auth";
import { useUserStore } from "@/stores/user";

// State to control if initial setup was already executed
const setupComplete = ref(false);

// Store initialization - these references will be initialized when Pinia is ready
const authStore = useAuthStore();
const userStore = useUserStore();

// Perform initialization after component is mounted
onMounted(async () => {
  // Avoid repeated initialization
  if (setupComplete.value) return;
  
  try {
    // Verify if user is authenticated
    if (await authStore.isAuthenticated()) {
      await userStore.init();
      
      // The rest of redirection logic will be moved to the router
      setupComplete.value = true;
    }
  } catch (error) {
    console.error("Error during App initialization:", error);
  }
});
</script>