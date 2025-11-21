<template>
  <div :class="messageClasses" class="flex space-x-3 response-message">
    <!-- Avatar -->
    <div :class="avatarClasses" class="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center">
      <component :is="userIcon" class="w-4 h-4" />
    </div>

    <!-- Message content -->
    <div class="flex-1 min-w-0">
      <!-- Header -->
      <div class="flex items-center space-x-2 mb-1">
        <span class="text-sm font-medium text-gray-900">
          {{ response.user_name }}
        </span>
        <span :class="roleClasses" class="px-2 py-0.5 text-xs font-medium rounded-full">
          {{ response.user_type === 'lawyer' ? 'Abogado' : 'Cliente' }}
        </span>
        <span class="text-xs text-gray-500">
          {{ formatDate(response.created_at) }}
        </span>
      </div>

      <!-- Message text -->
      <div :class="bubbleClasses" class="p-3 rounded-lg">
        <p class="text-sm whitespace-pre-wrap">{{ response.response_text }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { UserIcon, ScaleIcon } from '@heroicons/vue/24/solid'

// Props
const props = defineProps({
  response: {
    type: Object,
    required: true
  },
  isCurrentUser: {
    type: Boolean,
    default: false
  }
})

// Computed properties
const isLawyer = computed(() => props.response.user_type === 'lawyer')

const messageClasses = computed(() => {
  return props.isCurrentUser ? 'flex-row-reverse' : ''
})

const avatarClasses = computed(() => {
  if (isLawyer.value) {
    return 'bg-indigo-100 text-indigo-600'
  }
  return 'bg-gray-100 text-gray-600'
})

const roleClasses = computed(() => {
  if (isLawyer.value) {
    return 'bg-indigo-100 text-indigo-800'
  }
  return 'bg-gray-100 text-gray-800'
})

const bubbleClasses = computed(() => {
  if (props.isCurrentUser) {
    return isLawyer.value 
      ? 'bg-indigo-600 text-white' 
      : 'bg-blue-600 text-white'
  }
  return 'bg-gray-100 text-gray-900'
})

const userIcon = computed(() => {
  return isLawyer.value ? ScaleIcon : UserIcon
})

// Methods
const formatDate = (dateString) => {
  const date = new Date(dateString)
  const now = new Date()
  
  // Reset time to compare only dates
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const nowOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  
  const diffInDays = Math.floor((nowOnly - dateOnly) / (1000 * 60 * 60 * 24))

  // Today - show only time
  if (diffInDays === 0) {
    return date.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }
  // Yesterday
  else if (diffInDays === 1) {
    return 'Ayer ' + date.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }
  // This week (2-6 days ago)
  else if (diffInDays < 7) {
    return date.toLocaleDateString('es-ES', {
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit'
    })
  }
  // Older than a week
  else {
    return date.toLocaleDateString('es-ES', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }
}
</script>
