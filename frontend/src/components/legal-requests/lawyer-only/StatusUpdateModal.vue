<template>
  <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
    <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
      <!-- Header -->
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-medium text-gray-900">
          Actualizar Estado
        </h3>
        <button
          @click="$emit('close')"
          class="text-gray-400 hover:text-gray-600"
        >
          <XMarkIcon class="h-6 w-6" />
        </button>
      </div>

      <!-- Request info -->
      <div class="mb-4 p-3 bg-gray-50 rounded-lg">
        <p class="text-sm font-medium text-gray-900">{{ request.request_number }}</p>
        <p class="text-sm text-gray-600">{{ request.first_name }} {{ request.last_name }}</p>
      </div>

      <!-- Current status -->
      <div class="mb-4">
        <label class="block text-sm font-medium text-gray-700 mb-2">
          Estado actual:
        </label>
        <StatusBadge :status="request.status" />
      </div>

      <!-- New status selection -->
      <div class="mb-6">
        <label class="block text-sm font-medium text-gray-700 mb-2">
          Nuevo estado:
        </label>
        <select
          v-model="newStatus"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        >
          <option value="">Seleccionar estado...</option>
          <option value="PENDING">Pendiente</option>
          <option value="IN_REVIEW">En Revisión</option>
          <option value="RESPONDED">Respondida</option>
          <option value="CLOSED">Cerrada</option>
        </select>
      </div>

      <!-- Actions -->
      <div class="flex justify-end space-x-3">
        <button
          @click="$emit('close')"
          class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
        >
          Cancelar
        </button>
        <button
          @click="updateStatus"
          :disabled="!newStatus || newStatus === request.status || updating"
          class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md"
        >
          {{ updating ? 'Actualizando...' : 'Actualizar' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { XMarkIcon } from '@heroicons/vue/24/outline'
import StatusBadge from '../StatusBadge.vue'
import { useLegalRequestsStore } from '@/stores/legal/legal_requests_management.js'

// Props
const props = defineProps({
  request: {
    type: Object,
    required: true
  }
})

// Emits
const emit = defineEmits(['close', 'updated'])

// Store
const legalRequestsStore = useLegalRequestsStore()

// Reactive data
const newStatus = ref('')
const updating = ref(false)

// Methods
const updateStatus = async () => {
  if (!newStatus.value || newStatus.value === props.request.status) return

  updating.value = true

  try {
    const updatedRequest = await legalRequestsStore.updateRequestStatus(
      props.request.id,
      newStatus.value
    )
    
    emit('updated', updatedRequest)
    
    // Show success notification
    // You can integrate with your notification system here
    
  } catch (error) {
    console.error('Error updating status:', error)
    // Show error notification
  } finally {
    updating.value = false
  }
}
</script>
