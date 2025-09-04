<template>
  <div class="bg-white rounded-lg shadow hover:shadow-md transition-shadow duration-200 overflow-hidden">
    <!-- Header with status and actions -->
    <div class="px-6 py-4 border-b border-gray-200">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-3">
          <StatusBadge :status="request.status" />
          <span class="text-sm font-medium text-gray-900">
            {{ request.request_number }}
          </span>
        </div>
        
        <!-- Actions dropdown (only for lawyers) -->
        <div v-if="userRole === 'lawyer'" class="relative">          
          <!-- Dropdown menu -->
          <div
            v-if="showActions"
            v-click-outside="() => showActions = false"
            class="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-10"
          >
            <div class="py-1">
              <button
                @click="updateStatus"
                class="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
              >
                <PencilIcon class="h-4 w-4 mr-3" />
                Cambiar Estado
              </button>
              <button
                @click="confirmDelete"
                class="flex items-center px-4 py-2 text-sm text-red-700 hover:bg-red-50 w-full text-left"
              >
                <TrashIcon class="h-4 w-4 mr-3" />
                Eliminar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Content -->
    <div class="px-6 py-4">
      <!-- Client info -->
      <div class="mb-4">
        <h3 class="text-lg font-semibold text-gray-900 mb-1">
          {{ request.first_name }} {{ request.last_name }}
        </h3>
        <p class="text-sm text-gray-600">{{ request.email }}</p>
      </div>

      <!-- Request details -->
      <div class="space-y-2 mb-4">
        <div class="flex items-center text-sm">
          <span class="font-medium text-gray-700 w-20">Tipo:</span>
          <span class="text-gray-600">{{ request.request_type_name }}</span>
        </div>
        <div class="flex items-center text-sm">
          <span class="font-medium text-gray-700 w-20">Área:</span>
          <span class="text-gray-600">{{ request.discipline_name }}</span>
        </div>
        <div class="flex items-center text-sm space-x-2">
          <span class="font-medium text-gray-700 w-20">Respuestas:</span>
          <span class="text-gray-600">{{ request.response_count }}</span>
        </div>
      </div>

      <!-- Description preview -->
      <div class="mb-4">
        <p class="text-sm text-gray-600 line-clamp-3">
          {{ request.description }}
        </p>
      </div>

      <!-- Footer with date and action -->
      <div class="flex items-center justify-between pt-4 border-t border-gray-100">
        <span class="text-xs text-gray-500">
          {{ formatDate(request.created_at) }}
        </span>
        <button
          @click="$emit('view-detail', request.id)"
          class="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
        >
          Ver detalles →
        </button>
      </div>
    </div>

    <!-- Status update modal -->
    <StatusUpdateModal
      v-if="showStatusModal"
      :request="request"
      @close="showStatusModal = false"
      @updated="handleStatusUpdated"
    />

    <!-- Delete confirmation modal -->
    <DeleteConfirmModal
      v-if="showDeleteModal"
      :request="request"
      @close="showDeleteModal = false"
      @deleted="handleDeleted"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { 
  EllipsisVerticalIcon, 
  PencilIcon, 
  TrashIcon 
} from '@heroicons/vue/24/outline'
import StatusBadge from './StatusBadge.vue'
import StatusUpdateModal from './lawyer-only/StatusUpdateModal.vue'
import DeleteConfirmModal from './lawyer-only/DeleteConfirmModal.vue'

// Props
const props = defineProps({
  request: {
    type: Object,
    required: true
  },
  userRole: {
    type: String,
    default: 'client'
  }
})

// Emits
const emit = defineEmits(['view-detail', 'status-updated', 'deleted'])

// Reactive data
const showActions = ref(false)
const showStatusModal = ref(false)
const showDeleteModal = ref(false)

// Methods
const formatDate = (dateString) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const updateStatus = () => {
  showActions.value = false
  showStatusModal.value = true
}

const confirmDelete = () => {
  showActions.value = false
  showDeleteModal.value = true
}

const handleStatusUpdated = (updatedRequest) => {
  showStatusModal.value = false
  emit('status-updated', updatedRequest)
}

const handleDeleted = () => {
  showDeleteModal.value = false
  emit('deleted', props.request.id)
}

// Click outside directive
const vClickOutside = {
  beforeMount(el, binding) {
    el.clickOutsideEvent = (event) => {
      if (!(el === event.target || el.contains(event.target))) {
        binding.value()
      }
    }
    document.addEventListener('click', el.clickOutsideEvent)
  },
  unmounted(el) {
    document.removeEventListener('click', el.clickOutsideEvent)
  }
}
</script>

<style scoped>
.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
