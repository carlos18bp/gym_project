<template>
  <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
    <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
      <!-- Header -->
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-medium text-red-900">
          Eliminar Solicitud
        </h3>
        <button
          @click="$emit('close')"
          class="text-gray-400 hover:text-gray-600"
        >
          <XMarkIcon class="h-6 w-6" />
        </button>
      </div>

      <!-- Warning icon -->
      <div class="flex items-center justify-center mb-4">
        <div class="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
          <ExclamationTriangleIcon class="h-6 w-6 text-red-600" />
        </div>
      </div>

      <!-- Request info -->
      <div class="mb-4 p-3 bg-gray-50 rounded-lg">
        <p class="text-sm font-medium text-gray-900">{{ request.request_number }}</p>
        <p class="text-sm text-gray-600">{{ request.first_name }} {{ request.last_name }}</p>
        <p class="text-sm text-gray-600">{{ request.email }}</p>
      </div>

      <!-- Warning message -->
      <div class="mb-6">
        <p class="text-sm text-gray-700 mb-2">
          ¿Estás seguro de que deseas eliminar esta solicitud?
        </p>
        <p class="text-sm text-red-600 font-medium">
          Esta acción no se puede deshacer. Se eliminarán todos los archivos y respuestas asociadas.
        </p>
      </div>

      <!-- Confirmation input -->
      <div class="mb-6">
        <label class="block text-sm font-medium text-gray-700 mb-2">
          Para confirmar, escribe "ELIMINAR":
        </label>
        <input
          v-model="confirmationText"
          type="text"
          placeholder="ELIMINAR"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
        />
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
          @click="deleteRequest"
          :disabled="confirmationText !== 'ELIMINAR' || deleting"
          class="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md"
        >
          {{ deleting ? 'Eliminando...' : 'Eliminar Solicitud' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { XMarkIcon, ExclamationTriangleIcon } from '@heroicons/vue/24/outline'
import { useLegalRequestsStore } from '@/stores/legal/legal_requests_management.js'

// Props
const props = defineProps({
  request: {
    type: Object,
    required: true
  }
})

// Emits
const emit = defineEmits(['close', 'deleted'])

// Store and Router
const legalRequestsStore = useLegalRequestsStore()
const router = useRouter()

// Reactive data
const confirmationText = ref('')
const deleting = ref(false)

// Methods
const deleteRequest = async () => {
  if (confirmationText.value !== 'ELIMINAR') return

  deleting.value = true

  try {
    await legalRequestsStore.deleteRequest(props.request.id)
    
    emit('deleted')
    
    // Close modal first
    emit('close')
    
    // Use window.location for reliable redirect after deletion
    console.log('🔄 Redirigiendo a lista de solicitudes...')
    window.location.href = '/legal_requests_list'
    
    // Show success notification
    console.log('✅ Solicitud eliminada exitosamente')
    
  } catch (error) {
    console.error('Error deleting request:', error)
    // Show error notification
  } finally {
    deleting.value = false
  }
}
</script>
