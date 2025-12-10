<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
    @click.self="closeModal"
  >
    <div class="bg-white rounded-xl shadow-xl max-w-3xl w-full mx-4 max-h-[85vh] flex flex-col">
      <!-- Header -->
      <div class="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex-shrink-0">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-3">
            <div class="p-2 bg-white bg-opacity-20 rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h3 class="text-lg font-semibold text-white">
                Histórico Procesal
              </h3>
              <p class="text-blue-100 text-sm">
                Registro cronológico de etapas
              </p>
            </div>
          </div>
          <button
            @click="closeModal"
            class="text-white hover:text-blue-200 transition-colors p-2 hover:bg-white hover:bg-opacity-10 rounded-lg"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Content (scrollable area) -->
      <div class="p-6 overflow-y-auto flex-1 min-h-0">
        <div v-if="stages && stages.length > 0" class="space-y-4">
          <div
            v-for="(stage, index) in sortedStages"
            :key="stage.id"
            class="flex items-start space-x-4 p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <!-- Number badge -->
            <div class="flex-shrink-0">
              <div class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <span class="text-blue-700 font-semibold text-sm">{{ index + 1 }}</span>
              </div>
            </div>

            <!-- Stage info -->
            <div class="flex-1 min-w-0">
              <h4 class="text-base font-medium text-gray-900">
                {{ stage.status }}
              </h4>
              <p class="text-sm text-gray-500 mt-1">
                {{ formatDate(stage.date || stage.created_at) }}
              </p>
            </div>
          </div>
        </div>

        <!-- Empty state -->
        <div v-else class="text-center py-12">
          <svg xmlns="http://www.w3.org/2000/svg" class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 class="mt-2 text-sm font-medium text-gray-900">Sin etapas registradas</h3>
          <p class="mt-1 text-sm text-gray-500">
            No hay etapas procesales registradas para este proceso.
          </p>
        </div>
      </div>

      <!-- Footer (always visible at bottom) -->
      <div class="bg-gray-50 px-6 py-4 flex justify-end border-t border-gray-200 flex-shrink-0 rounded-b-xl">
        <button
          @click="closeModal"
          class="px-5 py-2.5 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
        >
          Cerrar
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  stages: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['close'])

const closeModal = () => {
  emit('close')
}

// Sort stages by logical stage date (newest first), falling back to created_at
const sortedStages = computed(() => {
  if (!props.stages) return []
  return [...props.stages].sort((a, b) => {
    const aDate = a.date || a.created_at
    const bDate = b.date || b.created_at
    return new Date(bDate) - new Date(aDate)
  })
})

/**
 * Formats a date string to a readable format
 * @param {string} dateString - ISO date string
 * @returns {string} Formatted date
 */
const formatDate = (dateString) => {
  if (!dateString) return 'Fecha no disponible'

  let date

  // If it's a pure date (YYYY-MM-DD), build a local Date to avoid timezone shifting
  if (typeof dateString === 'string' && dateString.length === 10 && dateString.includes('-') && !dateString.includes('T')) {
    const [year, month, day] = dateString.split('-').map(Number)
    date = new Date(year, month - 1, day)
    return date.toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  // Fallback for full datetime strings (created_at)
  date = new Date(dateString)
  const options = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Bogota'
  }

  return date.toLocaleDateString('es-CO', options)
}
</script>
