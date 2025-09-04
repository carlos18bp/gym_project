<template>
  <span :class="badgeClasses" class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium">
    <component :is="statusIcon" class="w-3 h-3 mr-1" />
    {{ statusText }}
  </span>
</template>

<script setup>
import { computed } from 'vue'
import { 
  ClockIcon, 
  EyeIcon, 
  CheckCircleIcon, 
  XCircleIcon 
} from '@heroicons/vue/24/solid'

// Props
const props = defineProps({
  status: {
    type: String,
    required: true
  }
})

// Computed properties
const statusConfig = computed(() => {
  const configs = {
    'PENDING': {
      text: 'Pendiente',
      classes: 'bg-yellow-100 text-yellow-800',
      icon: ClockIcon
    },
    'IN_REVIEW': {
      text: 'En Revisión',
      classes: 'bg-blue-100 text-blue-800',
      icon: EyeIcon
    },
    'RESPONDED': {
      text: 'Respondida',
      classes: 'bg-green-100 text-green-800',
      icon: CheckCircleIcon
    },
    'CLOSED': {
      text: 'Cerrada',
      classes: 'bg-gray-100 text-gray-800',
      icon: XCircleIcon
    }
  }
  
  return configs[props.status] || {
    text: props.status,
    classes: 'bg-gray-100 text-gray-800',
    icon: ClockIcon
  }
})

const badgeClasses = computed(() => statusConfig.value.classes)
const statusText = computed(() => statusConfig.value.text)
const statusIcon = computed(() => statusConfig.value.icon)
</script>
