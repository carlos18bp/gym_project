<template>
    <section class="pb-10 px-4 sm:px-6 lg:px-8 lg:pt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
        <UserWelcomeCard :user="currentUser" :activeProcesses="activeProcesses"></UserWelcomeCard>
        <ActivityFeed :user="currentUser"></ActivityFeed>
        <QuickActionButtons :user="currentUser" class="col-span-2"></QuickActionButtons>
        <LegalUpdatesCard class="col-span-2"></LegalUpdatesCard>
    </section>
</template>
<script setup>
import { ref, onMounted } from 'vue';
import UserWelcomeCard from '@/components/dashboard/UserWelcomeCard.vue';
import ActivityFeed from '@/components/dashboard/ActivityFeed.vue';
import LegalUpdatesCard from '@/components/dashboard/LegalUpdatesCard.vue';
import QuickActionButtons from '@/components/dashboard/QuickActionButtons.vue';
import { useUserStore } from '@/stores/user';
import { useAuthStore } from '@/stores/auth';

// Stores
const userStore = useUserStore();
const authStore = useAuthStore();

// Component state
const currentUser = ref({});
const activeProcesses = ref(0);

// Load current user data
onMounted(async () => {
  await userStore.init();
  if (authStore.userAuth?.id) {
    Object.assign(currentUser.value, userStore.userById(authStore.userAuth.id));
    // Here we could load the number of active processes from an API or store
    activeProcesses.value = 5; // Example value
  }
});
</script>