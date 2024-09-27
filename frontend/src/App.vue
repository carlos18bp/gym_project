<template>
  <RouterView />
</template>

<script setup>
import router from "@/router";
import { onBeforeMount } from "vue";
import { RouterView, useRoute } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useUserStore } from "@/stores/user";

const route = useRoute();
const authStore = useAuthStore(); // Get the authentication store instance
const userStore = useUserStore();

onBeforeMount(async () => {
  if (!authStore.isAuthenticated) {
    router.push({ name: "home" });
  } else {
    await userStore.init();

    if (userStore.currentUser.role == "client") {
      if (route.name == "process_form" || route.name == "directory_list") {
        router.push({
          name: "process_list",
          params: {
            user_id: userId,
            display: "",
          },
        });
      }
    }
  }
});
</script>
