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
                
                <!-- Activity Feed with Suspense for async loading -->
                <Suspense>
                    <template #default>
                        <ActivityFeed :user="currentUser" class="h-full" />
                    </template>
                    <template #fallback>
                        <div class="h-full bg-gray-50 animate-pulse rounded-lg p-4">
                            <div class="h-8 bg-gray-200 rounded w-1/2 mb-4"></div>
                            <div class="space-y-3">
                                <div class="h-4 bg-gray-200 rounded w-3/4"></div>
                                <div class="h-4 bg-gray-200 rounded w-full"></div>
                                <div class="h-4 bg-gray-200 rounded w-5/6"></div>
                            </div>
                        </div>
                    </template>
                </Suspense>
            </div>
            
            <!-- Quick action buttons always full width -->
            <QuickActionButtons :user="currentUser" class="w-full"></QuickActionButtons>
            
            <!-- Legal updates card with Suspense -->
            <Suspense>
                <template #default>
                    <LegalUpdatesCard class="w-full" />
                </template>
                <template #fallback>
                    <div class="w-full bg-gray-50 animate-pulse rounded-lg p-4 h-64">
                        <div class="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
                        <div class="space-y-3">
                            <div class="h-4 bg-gray-200 rounded w-full"></div>
                            <div class="h-4 bg-gray-200 rounded w-full"></div>
                            <div class="h-4 bg-gray-200 rounded w-3/4"></div>
                        </div>
                    </div>
                </template>
            </Suspense>
            
            <!-- Recent lists with skeleton loading while data loads -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                <Suspense>
                    <template #default>
                        <RecentProcessList class="h-full" v-if="showRecentProcesses" />
                    </template>
                    <template #fallback>
                        <div class="h-full bg-gray-50 animate-pulse rounded-lg p-4">
                            <div class="h-8 bg-gray-200 rounded w-1/2 mb-4"></div>
                            <div class="space-y-3">
                                <div class="h-4 bg-gray-200 rounded w-3/4"></div>
                                <div class="h-4 bg-gray-200 rounded w-full"></div>
                                <div class="h-4 bg-gray-200 rounded w-5/6"></div>
                            </div>
                        </div>
                    </template>
                </Suspense>
                
                <Suspense>
                    <template #default>
                        <RecentDocumentsList class="h-full" v-if="showRecentDocuments" />
                    </template>
                    <template #fallback>
                        <div class="h-full bg-gray-50 animate-pulse rounded-lg p-4">
                            <div class="h-8 bg-gray-200 rounded w-1/2 mb-4"></div>
                            <div class="space-y-3">
                                <div class="h-4 bg-gray-200 rounded w-3/4"></div>
                                <div class="h-4 bg-gray-200 rounded w-full"></div>
                                <div class="h-4 bg-gray-200 rounded w-5/6"></div>
                            </div>
                        </div>
                    </template>
                </Suspense>
            </div>
        </div>
    </section>
</template>

<script setup>
import { ref, onMounted, watch, nextTick } from 'vue';
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
const showRecentProcesses = ref(false);
const showRecentDocuments = ref(false);

// Delayed loading of non-critical components to improve initial render time
function loadSecondaryComponents() {
  // Use nextTick to ensure they load after the first render
  nextTick(() => {
    setTimeout(() => {
      showRecentProcesses.value = true;
    }, 100);
    
    setTimeout(() => {
      showRecentDocuments.value = true;
    }, 200);
  });
}

// Load current user data
onMounted(async () => {
  // Get minimum data needed for initial render
  try {
    await userStore.init();
    if (authStore.userAuth?.id) {
      Object.assign(currentUser.value, userStore.userById(authStore.userAuth.id));
      
      // Load secondary components after
      loadSecondaryComponents();
      
      // Get number of active processes (example)
      // Ideally this should come from a specific endpoint, not by loading all processes
      const processStore = await import('@/stores/process').then(m => m.useProcessStore());
      processStore.fetchProcessesData()
        .then(() => {
          activeProcesses.value = processStore.activeProcessesForCurrentUser.length;
        })
        .catch(error => {
          console.error("Error loading active processes:", error);
          activeProcesses.value = 0;
        });
    }
  } catch (error) {
    console.error("Error loading user data:", error);
  }
});
</script>