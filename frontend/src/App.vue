<template>
  <RouterView />
  <PWAInstallAlert />
</template>

<script setup>
import router from "@/router";
import { onBeforeMount } from "vue";
import { RouterView, useRoute } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useUserStore } from "@/stores/user";
import PWAInstallAlert from "@/components/pwa/PWAInstallAlert.vue";

const route = useRoute();
const authStore = useAuthStore(); // Get the authentication store instance
const userStore = useUserStore();

onBeforeMount(async () => {
  if (authStore.isAuthenticated) {
    await userStore.init();

    // If the user role is "client" and is on restricted routes, redirect to "process_list"
    if (userStore.currentUser?.role === "client" && 
        (route.name === "process_form" || route.name === "directory_list")) {
      router.push({
        name: "process_list",
        params: {
          user_id: "",
          display: "",
        },
      });
    }
  } else {
    // Redirect to "sign_in" only if the route requires authentication
    if (route.meta.requiresAuth) {
      router.push({ name: "sign_in" });
    }
  }
});
</script>