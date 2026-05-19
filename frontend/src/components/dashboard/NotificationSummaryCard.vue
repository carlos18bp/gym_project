<template>
  <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-2">
        <BellAlertIcon class="h-5 w-5 text-blue-600" />
        <h3 class="text-sm font-semibold text-gray-900">Notificaciones</h3>
        <span
          v-if="unreadCount > 0"
          class="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold text-white bg-red-500 rounded-full"
        >
          {{ unreadCount > 99 ? '99+' : unreadCount }}
        </span>
      </div>
      <router-link
        :to="{ name: 'notifications' }"
        class="text-xs text-blue-600 hover:text-blue-800 font-medium"
      >
        Ver todas
      </router-link>
    </div>

    <div v-if="latestNotifications.length === 0" class="text-center py-4">
      <p class="text-sm text-gray-400">Sin notificaciones recientes</p>
    </div>

    <div v-else class="space-y-3">
      <div
        v-for="notif in latestNotifications"
        :key="notif.id"
        class="flex items-start gap-3 cursor-pointer hover:bg-gray-50 -mx-2 px-2 py-1.5 rounded-lg transition-colors"
        @click="goToNotification(notif)"
      >
        <span
          v-if="!notif.is_read"
          class="flex-shrink-0 w-2 h-2 mt-1.5 rounded-full bg-blue-500"
        ></span>
        <span
          v-else
          class="flex-shrink-0 w-2 h-2 mt-1.5 rounded-full bg-transparent"
        ></span>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium text-gray-900 truncate">{{ notif.title }}</p>
          <p class="text-xs text-gray-500 truncate">{{ notif.message }}</p>
        </div>
        <span class="text-xs text-gray-400 flex-shrink-0 whitespace-nowrap">
          {{ formatTime(notif.created_at) }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { BellAlertIcon } from '@heroicons/vue/24/solid'
import { useNotificationStore } from '@/stores/notification'

const router = useRouter()
const store = useNotificationStore()

const unreadCount = computed(() => store.unreadCount)
const latestNotifications = computed(() => store.latestNotifications)

onMounted(() => {
  const tasks = [store.fetchUnreadCount()]
  if (!store.dataLoaded) {
    tasks.push(store.fetchNotifications('all', 1))
  }
  return Promise.all(tasks)
})

const goToNotification = (notif) => {
  store.navigateToNotificationTarget(router, notif)
}

const formatTime = (dateStr) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)

  if (diffMins < 1) return 'Ahora'
  if (diffMins < 60) return `${diffMins}m`
  if (diffHours < 24) return `${diffHours}h`
  return date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
}
</script>
