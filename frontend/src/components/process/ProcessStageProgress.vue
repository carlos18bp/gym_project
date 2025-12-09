<template>
  <div class="w-full">
    <!-- Header with stage info and button -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
      <div class="flex-1 min-w-0">
        <h3 class="text-sm font-semibold text-blue-600">Etapa Procesal</h3>
        <p class="text-sm sm:text-base font-medium text-gray-900 mt-1 truncate">
          {{ currentStage }}
        </p>
      </div>
      <button
        @click="$emit('openHistory')"
        class="inline-flex items-center justify-center px-3 py-2 sm:px-4 border border-blue-300 rounded-md shadow-sm text-xs sm:text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors whitespace-nowrap flex-shrink-0"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 sm:h-5 sm:w-5 sm:mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span class="hidden sm:inline">Histórico Procesal</span>
        <span class="sm:hidden ml-1">Histórico</span>
      </button>
    </div>

    <!-- Progress bar with chevron design -->
    <div class="relative">
      <!-- Labels -->
      <div class="flex justify-between mb-2 text-xs font-medium text-gray-600">
        <span class="truncate max-w-[80px] sm:max-w-none">Inicio</span>
        <span class="hidden sm:inline truncate px-2">{{ currentStage }}</span>
        <span class="truncate max-w-[80px] sm:max-w-none text-right">Fin Proceso</span>
      </div>

      <!-- Chevron progress bar -->
      <div class="flex items-center">
        <!-- Progress segments -->
        <div class="flex-1 flex items-center">
          <div
            v-for="(segment, index) in progressSegments"
            :key="index"
            class="relative flex-1 h-8 sm:h-10"
            :style="{ zIndex: progressSegments.length - index }"
          >
            <!-- Chevron shape -->
            <div
              class="absolute inset-0 flex items-center transition-all duration-300"
              :class="[
                segment.active ? 'opacity-100' : 'opacity-40'
              ]"
            >
              <!-- Main chevron body -->
              <div
                class="h-full flex-1 flex items-center justify-center relative"
                :class="[
                  segment.active ? 'bg-blue-600' : 'bg-gray-300'
                ]"
                :style="{
                  clipPath: index === progressSegments.length - 1 
                    ? 'polygon(0 0, calc(100% - 15px) 0, 100% 50%, calc(100% - 15px) 100%, 0 100%, 15px 50%)'
                    : 'polygon(0 0, calc(100% - 15px) 0, 100% 50%, calc(100% - 15px) 100%, 0 100%, 15px 50%)',
                  marginLeft: index === 0 ? '0' : '-15px'
                }"
              >
                <!-- Segment label (optional, can be removed if not needed) -->
                <span
                  v-if="segment.active"
                  class="text-white text-xs font-medium px-2 truncate"
                  :style="{ marginLeft: index === 0 ? '0' : '15px' }"
                >
                  <!-- Empty for cleaner look, or add stage names if needed -->
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Progress percentage text -->
      <div class="mt-2 text-center sm:text-right">
        <span class="text-xs sm:text-sm font-medium text-gray-700">
          {{ progressPercentage }}% completado
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  stages: {
    type: Array,
    default: () => []
  },
  totalStagesExpected: {
    type: Number,
    default: 5 // Default expected stages in a process
  }
})

defineEmits(['openHistory'])

// Get current stage (last one)
const currentStage = computed(() => {
  if (!props.stages || props.stages.length === 0) return 'Sin etapa'
  return props.stages[props.stages.length - 1].status
})

// Calculate progress percentage
const progressPercentage = computed(() => {
  if (!props.stages || props.stages.length === 0) return 0
  const percentage = (props.stages.length / props.totalStagesExpected) * 100
  return Math.min(Math.round(percentage), 100)
})

// Create progress segments for the chevron bar
const progressSegments = computed(() => {
  const segments = []
  const numSegments = 5 // Fixed number of visual segments
  const activeSegments = Math.ceil((progressPercentage.value / 100) * numSegments)
  
  for (let i = 0; i < numSegments; i++) {
    segments.push({
      active: i < activeSegments
    })
  }
  
  return segments
})
</script>
