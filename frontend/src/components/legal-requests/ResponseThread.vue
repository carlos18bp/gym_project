<template>
  <div class="bg-white rounded-lg shadow p-6 response-thread">
    <h2 class="text-lg font-semibold text-gray-900 mb-6">
      Conversación
      <span v-if="responses.length > 0" class="text-sm font-normal text-gray-500">
        ({{ responses.length }} {{ responses.length === 1 ? 'respuesta' : 'respuestas' }})
      </span>
    </h2>

    <!-- Empty state -->
    <div v-if="responses.length === 0" class="text-center py-8">
      <ChatBubbleLeftRightIcon class="mx-auto h-12 w-12 text-gray-400" />
      <h3 class="mt-4 text-sm font-medium text-gray-900">No hay respuestas aún</h3>
      <p class="mt-2 text-sm text-gray-600">
        {{ userRole === 'lawyer' 
          ? 'Sé el primero en responder a esta solicitud' 
          : 'El abogado aún no ha respondido a tu solicitud'
        }}
      </p>
    </div>

    <!-- Responses list -->
    <div v-else class="space-y-4 mb-6">
      <ResponseMessage
        v-for="response in responses"
        :key="response.id"
        :response="response"
        :is-current-user="isCurrentUserResponse(response)"
      />
    </div>

    <!-- Response form -->
    <div class="border-t border-gray-200 pt-6">
      <ResponseForm
        :request-id="requestId"
        :user-role="userRole"
        @response-added="$emit('response-added', $event)"
      />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { ChatBubbleLeftRightIcon } from '@heroicons/vue/24/outline'
import ResponseMessage from './ResponseMessage.vue'
import ResponseForm from './ResponseForm.vue'
import { useAuthStore } from '@/stores/auth/auth.js'

// Props
const props = defineProps({
  requestId: {
    type: [String, Number],
    required: true
  },
  responses: {
    type: Array,
    default: () => []
  },
  userRole: {
    type: String,
    default: 'client'
  }
})

// Emits
const emit = defineEmits(['response-added'])

// Store
const authStore = useAuthStore()

// Computed
const currentUserId = computed(() => authStore.user?.id)

// Methods
const isCurrentUserResponse = (response) => {
  return response.user === currentUserId.value
}
</script>
