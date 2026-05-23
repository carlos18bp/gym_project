<template>
  <div class="flex flex-col h-full min-h-0">
    <div v-if="widgetNotifications.length === 0" class="text-center py-6">
      <p class="text-sm text-gray-400">Sin notificaciones recientes</p>
    </div>

    <!-- Scrollable list: aligned 1:1 with FeedWidget / ContactsWidget
         (``max-h-[170px]``) so the three tabs share the same visual height.
         The R3 first pass tightened the limit but still left the panel
         ~2x taller than its siblings — the client reported that mismatch in
         the second feedback pass. The list keeps scrolling internally when
         there are more notifications than the visible height allows. -->
    <ul
      v-else
      class="space-y-1 overflow-y-auto pr-1 -mr-1 max-h-[170px] scrollbar-thin"
      data-testid="notifications-widget-list"
    >
      <li
        v-for="notif in widgetNotifications"
        :key="notif.id"
        class="flex items-start gap-3 cursor-pointer hover:bg-gray-50 px-2 py-2 rounded-lg transition-colors"
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
      </li>
    </ul>

    <div class="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
      <span v-if="unreadCount > 0" class="text-xs text-gray-500">
        {{ unreadCount }} sin leer
      </span>
      <span v-else class="text-xs text-gray-400">Al día</span>
      <router-link
        :to="{ name: 'notifications' }"
        class="text-xs text-blue-600 hover:text-blue-800 font-medium"
      >
        Ver todas
      </router-link>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useNotificationStore } from '@/stores/notification'

defineProps({
  user: { type: Object, required: true },
})

const router = useRouter()
const store = useNotificationStore()

const unreadCount = computed(() => store.unreadCount)
const widgetNotifications = computed(() => store.widgetNotifications)

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

<style scoped>
/* ``scrollbar-thin`` is not a Tailwind utility — each dashboard widget that
   uses it ships its own scoped definition (FeedWidget / ContactsWidget). The
   scoped class only applies inside this component, so it must be declared
   here too for the notifications list to match its sibling widgets. */
.scrollbar-thin::-webkit-scrollbar {
  width: 6px;
}

.scrollbar-thin::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.scrollbar-thin::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 3px;
}

.scrollbar-thin::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
}
</style>
