<template>
  <button
    @click="goToNotifications"
    class="fixed top-4 right-4 z-50 lg:top-6 lg:right-8 flex items-center justify-center w-10 h-10 rounded-full bg-white shadow-lg ring-1 ring-gray-200 hover:bg-gray-50 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
    data-testid="notification-bell"
    aria-label="Notificaciones"
  >
    <BellIcon class="h-5 w-5 text-gray-600" />
    <span
      v-if="unreadCount > 0"
      class="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full ring-2 ring-white"
      data-testid="notification-badge"
    >
      {{ unreadCount > 99 ? '99+' : unreadCount }}
    </span>
  </button>
</template>

<script setup>
import { computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { BellIcon } from '@heroicons/vue/24/outline'
import { useNotificationStore } from '@/stores/notification'

const router = useRouter()
const notificationStore = useNotificationStore()

const unreadCount = computed(() => notificationStore.unreadCount)

onMounted(() => {
  notificationStore.startPolling()
})

onUnmounted(() => {
  notificationStore.stopPolling()
})

const goToNotifications = () => {
  router.push({ name: 'notifications' })
}
</script>
