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
import { useIdleLogout } from "@/composables/useIdleLogout";

// State to control if initial setup was already executed
const setupComplete = ref(false);

// Store initialization - these references will be initialized when Pinia is ready
const authStore = useAuthStore();
const userStore = useUserStore();

// Add controller reference for the idle logout composable
const idleController = ref(null);

// Watch for changes in the authentication token.
// When the user logs in we initialise the idle-logout detector.
// When the user logs out we tear it down to free resources.
watch(
  () => authStore.token,
  (token) => {
    if (token && !idleController.value) {
      // User has just logged in – start idle detection
      try {
        idleController.value = useIdleLogout();
      } catch (error) {
        console.error("Error starting idle logout:", error);
      }
    } else if (!token && idleController.value) {
      // User has logged out – stop idle detection
      try {
        idleController.value.unsubscribe();
        idleController.value = null;
      } catch (error) {
        console.error("Error stopping idle logout:", error);
      }
    }
  },
  { immediate: false } // Changed to false to avoid immediate execution
);

// Perform initialization after component is mounted
onMounted(async () => {
  // Avoid repeated initialization
  if (setupComplete.value) return;
  
  try {
    // Verify if user is authenticated
    if (await authStore.isAuthenticated()) {
      await userStore.init();
      
      // Initialize idle logout if user is authenticated and not already initialized
      if (authStore.token && !idleController.value) {
        try {
          idleController.value = useIdleLogout();
        } catch (error) {
          console.error("Error initializing idle logout on mount:", error);
        }
      }
      
      // The rest of redirection logic will be moved to the router
      setupComplete.value = true;
    }
  } catch (error) {
    console.error("Error during App initialization:", error);
  }
});
</script>