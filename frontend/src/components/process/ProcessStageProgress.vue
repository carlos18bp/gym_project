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

    <!-- Progress bar with continuous fill -->
    <div class="relative">
      <!-- Labels -->
      <div class="flex justify-between mb-2 text-xs font-medium text-gray-600">
        <span class="truncate max-w-[80px] sm:max-w-none">Inicio</span>
        <span class="hidden sm:inline truncate px-2">{{ currentStage }}</span>
        <span class="truncate max-w-[80px] sm:max-w-none text-right">Fin Proceso</span>
      </div>

      <!-- Chevron progress bar -->
      <div class="relative flex items-center">
        <!-- Chevron segments -->
        <div
          v-for="(segment, index) in progressSegments"
          :key="index"
          class="relative h-10 flex-1"
          :style="{ zIndex: totalStagesExpected - index }"
        >
          <!-- Chevron shape -->
          <div
            class="absolute inset-0 transition-all duration-500"
            :style="{
              clipPath: getChevronClipPath(index),
              marginLeft: index === 0 ? '0' : '-12px'
            }"
          >
            <!-- Background layer -->
            <div
              class="absolute inset-0"
              :class="segment.filled ? 'bg-blue-600' : 'bg-gray-200'"
            >
              <!-- Shine effect for filled segments -->
              <div
                v-if="segment.filled"
                class="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-10"
              ></div>
            </div>
            
            <!-- White border/stroke effect -->
            <div
              class="absolute inset-0"
              :style="{
                clipPath: getChevronClipPath(index),
                border: '4px solid white',
                margin: '-4px'
              }"
            ></div>
          </div>
        </div>
      </div>

      <!-- Progress status text -->
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
  },
  // Optional explicit progress percentage from the backend (0-100).
  // When provided, it overrides the derived percentage based on stages.
  progress: {
    type: Number,
    default: null
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
  // Prefer explicit progress value from props when available
  if (typeof props.progress === 'number' && !Number.isNaN(props.progress)) {
    const clamped = Math.min(Math.max(Math.round(props.progress), 0), 100)
    return clamped
  }

  // Fallback: derive from number of stages vs expected total
  if (!props.stages || props.stages.length === 0) return 0
  const percentage = (props.stages.length / props.totalStagesExpected) * 100
  return Math.min(Math.round(percentage), 100)
})

// Create progress segments for chevron display
const progressSegments = computed(() => {
  const segments = []
  const numSegments = props.totalStagesExpected
  const percentagePerSegment = 100 / numSegments
  
  for (let i = 0; i < numSegments; i++) {
    const segmentStart = i * percentagePerSegment
    const segmentEnd = (i + 1) * percentagePerSegment
    
    // A segment is filled if the progress percentage is greater than or equal to its end
    const filled = progressPercentage.value >= segmentEnd
    
    segments.push({ filled })
  }
  
  return segments
})

/**
 * Generate clip-path for chevron shape
 * @param {number} index - Index of the chevron segment
 * @returns {string} CSS clip-path value
 */
const getChevronClipPath = (index) => {
  const isLast = index === props.totalStagesExpected - 1
  
  if (isLast) {
    // Last chevron: has arrow on left, flat on right
    return 'polygon(0 0, calc(100% - 8px) 0, 100% 50%, calc(100% - 8px) 100%, 0 100%, 12px 50%)'
  } else {
    // Regular chevron: has arrow on both sides
    return 'polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%, 12px 50%)'
  }
}
</script>
