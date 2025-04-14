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

// Estado para controlar si el setup inicial ya se ejecutó
const setupComplete = ref(false);

// Inicialización de stores - estas referencias se inicializarán cuando Pinia esté lista
const authStore = useAuthStore();
const userStore = useUserStore();

// Realizar la inicialización después de que el componente esté montado
onMounted(async () => {
  // Evitar inicialización repetida
  if (setupComplete.value) return;
  
  try {
    // Verificar si el usuario está autenticado
    if (await authStore.isAuthenticated()) {
      await userStore.init();
      
      // El resto de la lógica de redirección se moverá al router
      setupComplete.value = true;
    }
  } catch (error) {
    console.error("Error during App initialization:", error);
  }
});
</script>