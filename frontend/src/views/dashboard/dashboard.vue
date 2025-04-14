<template>
    <!-- Menu button - mobile hamburger menu -->
    <div
      class="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8 lg:hidden"
    >
      <slot></slot>
    </div>
    
    <section class="pb-6 pt-4 px-4 sm:px-6 lg:px-8 lg:pt-10 lg:pb-10">
        <!-- Grid layout with improved responsive behavior -->
        <div class="grid grid-cols-1 gap-4 sm:gap-6">
            <!-- User welcome and activity feed: stacked on all screens up to xl, side by side only on 2xl -->
            <div class="grid grid-cols-1 2xl:grid-cols-2 gap-4 sm:gap-6">
                <UserWelcomeCard :user="currentUser" :activeProcesses="activeProcesses" class="h-full"></UserWelcomeCard>
                <ActivityFeed :user="currentUser" class="h-full"></ActivityFeed>
            </div>
            
            <!-- Quick action buttons always full width -->
            <QuickActionButtons :user="currentUser" class="w-full"></QuickActionButtons>
            
            <!-- Legal updates card always full width -->
            <LegalUpdatesCard class="w-full"></LegalUpdatesCard>
            
            <!-- Recent lists: stacked on mobile, side by side on medium screens and up -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                <keep-alive>
                    <RecentProcessList class="h-full"></RecentProcessList>
                </keep-alive>
                <keep-alive>
                    <RecentDocumentsList class="h-full"></RecentDocumentsList>
                </keep-alive>
            </div>
        </div>
    </section>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import UserWelcomeCard from '@/components/dashboard/UserWelcomeCard.vue';
import ActivityFeed from '@/components/dashboard/ActivityFeed.vue';
import LegalUpdatesCard from '@/components/dashboard/LegalUpdatesCard.vue';
import QuickActionButtons from '@/components/dashboard/QuickActionButtons.vue';
import RecentProcessList from '@/components/dashboard/RecentProcessList.vue';
import RecentDocumentsList from '@/components/dashboard/RecentDocumentsList.vue';
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