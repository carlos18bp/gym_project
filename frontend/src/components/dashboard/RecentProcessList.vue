<template>
  <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
    <div class="flex flex-col h-full">
      <!-- Header -->
      <div class="border-b border-gray-100 pb-4 mb-4">
        <h2 class="text-lg font-semibold text-gray-900">Procesos Recientes</h2>
      </div>
      
      <!-- Content -->
      <div class="flex-1 min-h-0">
        <!-- Recent processes list -->
        <div v-if="recentProcessStore.recentProcesses.length > 0" 
             class="max-h-[280px] overflow-y-auto space-y-2 pr-1">
          <div v-for="process in recentProcessStore.recentProcesses" :key="process.id" 
            class="group relative bg-gray-50 hover:bg-gray-100 border border-gray-200 hover:border-gray-300 rounded-lg p-3 cursor-pointer transition-all duration-200 hover:shadow-sm"
            @click="navigateToProcess(process.process.id)">
            
            <!-- Content -->
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3 flex-1 min-w-0">
                <!-- Icon -->
                <div class="flex-shrink-0 w-10 h-10 bg-white border border-gray-200 rounded-lg flex items-center justify-center group-hover:border-primary/20 group-hover:bg-primary/5 transition-all duration-200">
                  <img src="@/assets/icons/file-01.svg" class="h-5 w-5" />
                </div>
                
                <!-- Info -->
                <div class="flex-1 min-w-0">
                  <h3 class="text-sm font-semibold text-gray-900 truncate group-hover:text-primary transition-colors duration-200">
                    {{ process.process.clients?.[0]?.first_name }} {{ process.process.clients?.[0]?.last_name }}
                  </h3>
                  <p class="text-xs text-gray-500 truncate mt-0.5">
                    {{ process.process.case.type }}
                  </p>
                </div>
              </div>
              
              <!-- Arrow -->
              <div class="flex-shrink-0 ml-2">
                <ChevronDownIcon
                  class="h-4 w-4 text-gray-400 transform -rotate-90 group-hover:text-primary transition-all duration-200 group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Empty state -->
        <div v-else class="flex flex-col items-center justify-center py-8 text-center">
          <div class="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mb-3">
            <img src="@/assets/icons/file-01.svg" class="h-6 w-6 opacity-50" />
          </div>
          <h3 class="text-sm font-medium text-gray-900 mb-1">No hay procesos recientes</h3>
          <p class="text-xs text-gray-500">Los procesos aparecerán aquí cuando los uses</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onActivated } from 'vue';
import { useRouter } from 'vue-router';
import { ChevronDownIcon } from '@heroicons/vue/20/solid';
import { useRecentProcessStore } from '@/stores/dashboard/recentProcess';

const router = useRouter();
const recentProcessStore = useRecentProcessStore();

/**
 * Navigate to process detail view
 * @param {number} processId - The ID of the process to navigate to
 */
const navigateToProcess = (processId) => {
  router.push({
    name: 'process_detail',
    params: { process_id: processId }
  });
};

// Update when component is mounted
onMounted(async () => {
  await recentProcessStore.fetchRecentProcesses();
});

// Update when component is reactivated (when returning to dashboard)
onActivated(async () => {
  await recentProcessStore.fetchRecentProcesses();
});
</script>

<style scoped>
/* Simplified scrollbar for recent processes */
.overflow-y-auto::-webkit-scrollbar {
  width: 4px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: transparent;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background: #e5e7eb;
  border-radius: 2px;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background: #d1d5db;
}
</style>
