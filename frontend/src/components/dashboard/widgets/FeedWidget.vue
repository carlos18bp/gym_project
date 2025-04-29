<!-- FeedWidget.vue -->
<template>
  <div class="overflow-y-auto max-h-[170px] scrollbar-thin">
    <div v-if="activityFeedStore.loading" class="text-center py-4">
      <div class="inline-block animate-spin rounded-full h-4 w-4 border-t-2 border-blue-500 border-r-2 border-gray-200 mr-2"></div>
      Cargando actividades...
    </div>
    <div v-else-if="activityFeedStore.error" class="text-center text-red-500 py-4">
      Error al cargar las actividades
    </div>
    <div v-else-if="!activityFeedStore.activities.length" class="text-center text-gray-500 py-4">
      No hay actividades registradas
    </div>
    <div v-else class="timeline">
      <div 
        v-for="(activity, index) in activityFeedStore.activities" 
        :key="activity.id || index" 
        class="timeline-item pb-6"
        :class="{'last-item': index === activityFeedStore.activities.length - 1}"
      >
        <div class="flex">
          <!-- Timeline icon with connector -->
          <div class="timeline-icon relative flex-shrink-0 mr-3" style="width: 40px;">
            <div 
              class="w-10 h-10 rounded-full flex items-center justify-center border-2 relative z-10"
              :class="[
                getActivityIconClass(activity.type),
                getBorderColorClass(activity.type)
              ]"
            >
              <PlusIcon v-if="activity.type === 'create'" class="h-5 w-5 text-green-500" />
              <PencilIcon v-else-if="activity.type === 'edit'" class="h-5 w-5 text-blue-500" />
              <ArrowDownIcon v-else-if="activity.type === 'finish'" class="h-5 w-5 text-indigo-500" />
              <TrashIcon v-else-if="activity.type === 'delete'" class="h-5 w-5 text-red-500" />
              <ArrowUpIcon v-else-if="activity.type === 'update'" class="h-5 w-5 text-yellow-500" />
              <QuestionMarkCircleIcon v-else class="h-5 w-5 text-gray-500" />
            </div>
            <!-- Timeline connector line -->
            <div 
              v-if="index < activityFeedStore.activities.length - 1" 
              class="timeline-connector w-0.5 top-10 h-full"
              :class="getActivityLineClass(activity.type)"
            ></div>
          </div>
          
          <!-- Content -->
          <div class="flex-grow pr-2 flex items-center">
            <div class="flex justify-between w-full">
              <p class="text-gray-500 pr-2 my-auto">{{ activity.description }}</p>
              <div class="text-gray-400 text-sm whitespace-nowrap flex-shrink-0 my-auto">{{ activity.time }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * Feed Widget Component
 * 
 * This component displays a feed of recent activities.
 */
import { watch, onMounted } from 'vue';
import { 
  ArrowUpIcon, 
  ArrowDownIcon, 
  PlusIcon, 
  TrashIcon, 
  PencilIcon, 
  QuestionMarkCircleIcon 
} from '@heroicons/vue/24/outline';
import { useActivityFeedStore } from '@/stores/activity_feed';

const props = defineProps({
  /**
   * Current user object
   */
  user: {
    type: Object,
    required: true
  }
});

const activityFeedStore = useActivityFeedStore();

// Function to get activity border color class
const getBorderColorClass = (type) => {
  switch (type) {
    case 'create':
      return 'border-green-500';
    case 'edit':
      return 'border-blue-500';
    case 'finish':
      return 'border-indigo-500';
    case 'delete':
      return 'border-red-500';
    case 'update':
      return 'border-yellow-500';
    case 'other':
    default:
      return 'border-gray-500';
  }
};

// Function to get activity icon CSS class based on type
const getActivityIconClass = (type) => {
  switch (type) {
    case 'create':
      return 'bg-green-200';
    case 'edit':
      return 'bg-blue-200';
    case 'finish':
      return 'bg-indigo-200';
    case 'delete':
      return 'bg-red-200';
    case 'update':
      return 'bg-yellow-200';
    case 'other':
    default:
      return 'bg-gray-200';
  }
};

// Function to get timeline connector line color
const getActivityLineClass = (type) => {
  switch (type) {
    case 'create':
      return 'bg-green-300';
    case 'edit':
      return 'bg-blue-300';
    case 'finish':
      return 'bg-indigo-300';
    case 'delete':
      return 'bg-red-300';
    case 'update':
      return 'bg-yellow-300';
    case 'other':
    default:
      return 'bg-gray-300';
  }
};

// Initialize component data
onMounted(async () => { 
  await activityFeedStore.fetchUserActivities();
});
</script>

<style scoped>
.timeline {
  position: relative;
  padding-left: 10px;
}

.timeline-item {
  position: relative;
}

.timeline-connector {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1;
}

.timeline-item:last-child .timeline-connector {
  display: none;
}

.last-item .timeline-connector {
  display: none;
}

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