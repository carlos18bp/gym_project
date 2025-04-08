<template>
  <div class="bg-white rounded-xl shadow-md border border-gray-200 p-4">
    <div class="flex flex-col h-full">
      <div class="border-b border-gray-200 pb-4">
        <h2 class="text-lg font-semibold text-gray-900">Procesos Recientes</h2>
      </div>
      
      <div class="mt-4 max-h-[250px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 pr-3">
        <div class="space-y-2">
          <div v-for="process in recentProcessStore.recentProcesses" :key="process.id" 
            class="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer border border-stroke border-1"
            @click="navigateToProcess(process.process.id)">
            <div class="flex items-center gap-3">
              <div class="flex-shrink-0">
                <img src="@/assets/icons/file-01.svg" class="h-6 w-6" />
              </div>
              <div>
                <h3 class="text-base font-medium text-primary">
                  {{ process.process.client.first_name }} {{ process.process.client.last_name }}
                </h3>
                <p class="text-sm text-gray-500">
                  {{ process.process.case.type }}
                </p>
              </div>
            </div>
            <ChevronDownIcon
              class="h-5 w-5 text-gray-400 transform -rotate-90"
              aria-hidden="true"
            />
          </div>

          <!-- Empty state -->
          <div v-if="!recentProcessStore.recentProcesses.length" class="text-center py-6">
            <p class="text-sm text-gray-500">No hay procesos recientes</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onActivated } from 'vue';
import { useRouter } from 'vue-router';
import { ChevronDownIcon } from '@heroicons/vue/20/solid';
import { useRecentProcessStore } from '@/stores/recentProcess';

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

<style>
/* Custom scrollbar styles */
.scrollbar-thin::-webkit-scrollbar {
  width: 6px;
}

.scrollbar-thin::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.scrollbar-thin::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 3px;
}

.scrollbar-thin::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
}
</style>
