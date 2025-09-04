<template>
  <div class="response-form">
    <div class="flex items-start space-x-3">
      <!-- User avatar -->
      <div :class="avatarClasses" class="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center">
        <component :is="userIcon" class="w-4 h-4" />
      </div>

      <!-- Form -->
      <div class="flex-1">
        <form @submit.prevent="submitResponse" class="space-y-3">
          <!-- Textarea -->
          <div>
            <textarea
              v-model="responseText"
              :placeholder="placeholder"
              rows="3"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
              :disabled="submitting"
            ></textarea>
          </div>

          <!-- Actions -->
          <div class="flex items-center justify-between">
            <div class="text-xs text-gray-500">
              {{ userRole === 'lawyer' ? 'Respondiendo como abogado' : 'Respondiendo como cliente' }}
            </div>
            
            <div class="flex items-center space-x-2">
              <!-- Character count -->
              <span class="text-xs text-gray-500">
                {{ responseText.length }}/1000
              </span>
              
              <!-- Submit button -->
              <button
                type="submit"
                :disabled="!canSubmit"
                class="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {{ submitting ? 'Enviando...' : 'Responder' }}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { UserIcon, ScaleIcon } from '@heroicons/vue/24/solid'
import { useLegalRequestsStore } from '@/stores/legal/legal_requests_management.js'

// Props
const props = defineProps({
  requestId: {
    type: [String, Number],
    required: true
  },
  userRole: {
    type: String,
    default: 'client'
  }
})

// Emits
const emit = defineEmits(['response-added'])

// Store
const legalRequestsStore = useLegalRequestsStore()

// Reactive data
const responseText = ref('')
const submitting = ref(false)

// Computed
const isLawyer = computed(() => props.userRole === 'lawyer')

const avatarClasses = computed(() => {
  if (isLawyer.value) {
    return 'bg-indigo-100 text-indigo-600'
  }
  return 'bg-gray-100 text-gray-600'
})

const userIcon = computed(() => {
  return isLawyer.value ? ScaleIcon : UserIcon
})

const placeholder = computed(() => {
  if (isLawyer.value) {
    return 'Escribe tu respuesta profesional al cliente...'
  }
  return 'Escribe tu respuesta o pregunta adicional...'
})

const canSubmit = computed(() => {
  return responseText.value.trim().length > 0 && 
         responseText.value.length <= 1000 && 
         !submitting.value
})

// Methods
const submitResponse = async () => {
  if (!canSubmit.value) return

  submitting.value = true

  try {
    const newResponse = await legalRequestsStore.createResponse(
      props.requestId,
      responseText.value.trim()
    )

    // Clear form
    responseText.value = ''

    // Emit the new response
    emit('response-added', newResponse)
  } catch (error) {
    console.error('Error creating response:', error)
    // Show error notification
  } finally {
    submitting.value = false
  }
}
</script>
