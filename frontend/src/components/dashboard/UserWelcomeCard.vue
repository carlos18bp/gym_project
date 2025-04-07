<!-- UserWelcomeCard.vue -->
<template>
  <div class="rounded-xl w-full bg-gradient-to-r from-[#639CFF] to-[#BEB3FF] p-6">
    <!-- Flex layout with two columns of correct width -->
    <div class="flex flex-col gap-6">
      <!-- First row: welcome title with correct offset -->
      <div class="text-4xl font-bold text-white">
        Bienvenido/a, {{ user?.first_name || 'Usuario' }}!
      </div>

      <!-- Second row: Avatar + Stats cards in columns -->
      <div class="flex gap-6">
        <!-- Avatar column - only as wide as needed -->
        <div class="flex-shrink-0 w-40">
          <img 
            :src="user?.photo_profile || '/default-avatar.jpg'" 
            :alt="user?.first_name"
            class="w-40 h-40 rounded-full object-cover border-4 border-white"
          />
        </div>

        <!-- Stats cards column -->
        <div class="flex gap-4">
          <!-- Membership date -->
          <div class="bg-white rounded-lg p-4 flex flex-col items-center w-40 h-40">
            <div class="text-blue-500 mb-2">
              <CalendarDaysIcon class="w-10 h-10 mx-auto" />
            </div>
            <div class="text-blue-500 text-2xl font-bold text-center">
              {{ formattedDate }}
            </div>
            <div class="text-gray-500 text-sm text-center mt-auto">
              Miembro desde
            </div>
          </div>
      
          <!-- Active processes -->
          <div class="bg-white rounded-lg p-4 flex flex-col items-center w-40 h-40">
            <div class="text-blue-500 mb-2">
              <RectangleStackIcon class="w-10 h-10 mx-auto" />
            </div>
            <div class="text-blue-500 text-5xl font-bold text-center">
              {{ activeProcesses }}
            </div>
            <div class="text-gray-500 text-sm text-center mt-auto">
              Procesos activos
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
  
<script setup>
/**
 * User welcome card component
 * 
 * This component displays a welcome card for the logged-in user
 * with their avatar, name, membership date, and active processes count.
 * The background features a horizontal linear gradient from #639CFF to #BEB3FF.
 * Uses Heroicons Outline: calendar-days for membership date and rectangle-stack for active processes.
 */
import { defineProps, computed } from 'vue';
import { RectangleStackIcon, CalendarDaysIcon } from '@heroicons/vue/24/outline';

// Props for customization
const props = defineProps({
  /**
   * User object containing user information
   */
  user: {
    type: Object,
    default: () => ({})
  },
  /**
   * Number of active processes for the user
   */
  activeProcesses: {
    type: Number,
    default: 0
  }
});

// Format date for display
const formattedDate = computed(() => {
  if (!props.user?.created_at) return '';
  
  const date = new Date(props.user.created_at);
  const month = date.toLocaleString('default', { month: 'short' });
  const day = date.getDate();
  const year = date.getFullYear();
  
  return `${month} ${day}, ${year}`;
});
</script>