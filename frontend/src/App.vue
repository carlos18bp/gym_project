<template>
  <RouterView />
  <PWAInstallAlert />
</template>

<script setup>
import { onMounted, onBeforeUnmount, ref, watch } from "vue";
import { RouterView } from "vue-router";
import PWAInstallAlert from "@/components/pwa/PWAInstallAlert.vue";
import { useAuthStore } from "@/stores/auth/auth";
import { useUserStore } from "@/stores/auth/user";
import { useIdleLogout } from "@/composables/useIdleLogout";

// State to control if initial setup was already executed
const setupComplete = ref(false);

// Store initialization - these references will be initialized when Pinia is ready
const authStore = useAuthStore();
const userStore = useUserStore();

// Idle logout controller reference
const idleController = ref(null);

/**
 * Initializes the idle logout system when user has a valid token.
 * Sets up activity listeners and starts the 15-minute inactivity timer.
 */
const initializeIdleLogout = () => {
  if (authStore.token && !idleController.value) {
    try {
      const controller = useIdleLogout(); // Default 15 minutes
      controller.subscribe();
      idleController.value = controller;
    } catch (error) {
      console.error("Error starting idle logout:", error);
    }
  }
};

/**
 * Cleans up the idle logout system by removing event listeners and timers.
 * Called when user logs out or component unmounts.
 */
const cleanupIdleLogout = () => {
  if (idleController.value) {
    try {
      idleController.value.unsubscribe();
      idleController.value = null;
    } catch (error) {
      console.error("Error stopping idle logout:", error);
    }
  }
};

// Watch authentication token changes to manage idle logout lifecycle
watch(
  () => authStore.token,
  (token) => {
    if (token && !idleController.value) {
      // User logged in - start idle detection
      initializeIdleLogout();
    } else if (!token && idleController.value) {
      // User logged out - stop idle detection
      cleanupIdleLogout();
    }
  },
  { immediate: false }
);

// Perform initialization after component is mounted
onMounted(async () => {
  // Avoid repeated initialization
  if (setupComplete.value) return;
  
  try {
    // Check if there's a token in storage first (without validating it)
    if (authStore.token) {
      // Initialize idle logout immediately if token exists
      initializeIdleLogout();
      
      // Try to validate token and initialize user store
      try {
        if (await authStore.isAuthenticated()) {
          await userStore.init();
          setupComplete.value = true;
        }
      } catch (error) {
        console.warn("Token validation failed during initialization:", error);
        // Token will be cleared by the auth store, idle logout will be cleaned by watcher
      }
    }
  } catch (error) {
    console.error("Error during App initialization:", error);
  }
});

// Cleanup when component unmounts
onBeforeUnmount(() => {
  cleanupIdleLogout();
});
</script>