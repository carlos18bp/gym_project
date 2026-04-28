<template>
  <div class="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8 lg:hidden">
    <slot></slot>
  </div>

  <section class="pb-6 pt-4 px-4 sm:px-6 lg:px-8 lg:pt-10 lg:pb-10">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Centro de Notificaciones</h1>
        <p class="text-sm text-gray-500 mt-1">
          {{ totalCount }} notificación{{ totalCount !== 1 ? 'es' : '' }}
          <span v-if="unreadCount > 0" class="text-blue-600 font-medium">
            · {{ unreadCount }} sin leer
          </span>
        </p>
      </div>
      <button
        v-if="unreadCount > 0"
        @click="handleMarkAllRead"
        class="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
        data-testid="mark-all-read-btn"
      >
        <CheckIcon class="h-4 w-4 mr-2" />
        Marcar todas como leídas
      </button>
    </div>

    <!-- Tabs -->
    <div class="border-b border-gray-200 mb-6">
      <nav class="flex space-x-6" aria-label="Tabs">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          @click="switchTab(tab.key)"
          :class="[
            currentTab === tab.key
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
            'whitespace-nowrap border-b-2 pb-3 px-1 text-sm font-medium transition-colors'
          ]"
          :data-testid="`tab-${tab.key}`"
        >
          {{ tab.label }}
        </button>
      </nav>
    </div>

    <!-- Empty state -->
    <div
      v-if="dataLoaded && notifications.length === 0"
      class="text-center py-16"
      data-testid="empty-state"
    >
      <BellSlashIcon class="mx-auto h-12 w-12 text-gray-300" />
      <h3 class="mt-3 text-sm font-semibold text-gray-900">Sin notificaciones</h3>
      <p class="mt-1 text-sm text-gray-500">
        {{ currentTab === 'unread' ? 'No tienes notificaciones sin leer.' : currentTab === 'archived' ? 'No tienes notificaciones archivadas.' : 'No tienes notificaciones.' }}
      </p>
    </div>

    <!-- Notification list -->
    <div v-else class="space-y-2">
      <div
        v-for="notif in notifications"
        :key="notif.id"
        class="group relative flex items-start gap-4 p-4 rounded-xl border transition-all cursor-pointer"
        :class="notif.is_read ? 'bg-white border-gray-200 hover:bg-gray-50' : 'bg-blue-50/50 border-blue-200 hover:bg-blue-50'"
        :data-testid="`notification-${notif.id}`"
        @click="handleNotificationClick(notif)"
      >
        <!-- Category icon -->
        <div
          class="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
          :class="getCategoryIconClass(notif.category)"
        >
          <component :is="getCategoryIcon(notif.category)" class="h-5 w-5" />
        </div>

        <!-- Content -->
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span
              v-if="!notif.is_read"
              class="flex-shrink-0 w-2 h-2 rounded-full bg-blue-500"
            ></span>
            <h4 class="text-sm font-semibold text-gray-900 truncate">
              {{ notif.title }}
            </h4>
            <span
              v-if="notif.priority === 'high'"
              class="flex-shrink-0 px-1.5 py-0.5 text-[10px] font-bold uppercase bg-red-100 text-red-700 rounded"
            >
              Urgente
            </span>
          </div>
          <p class="text-sm text-gray-600 mt-0.5 line-clamp-2">
            {{ notif.message }}
          </p>
          <p class="text-xs text-gray-400 mt-1">
            {{ formatRelativeDate(notif.created_at) }}
          </p>
        </div>

        <!-- Actions -->
        <div class="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            v-if="!notif.is_read"
            @click.stop="handleMarkRead(notif.id)"
            class="p-1.5 rounded-lg hover:bg-gray-200 text-gray-500"
            title="Marcar como leída"
          >
            <CheckIcon class="h-4 w-4" />
          </button>
          <div class="relative" v-if="currentTab !== 'archived'">
            <button
              @click.stop="toggleSnoozeMenu(notif.id)"
              class="p-1.5 rounded-lg hover:bg-gray-200 text-gray-500"
              title="Recordar después"
            >
              <ClockIcon class="h-4 w-4" />
            </button>
            <!-- Snooze dropdown -->
            <div
              v-if="openSnoozeId === notif.id"
              class="absolute right-0 mt-1 w-36 bg-white rounded-lg shadow-lg ring-1 ring-gray-200 py-1 z-10"
            >
              <button
                v-for="option in snoozeOptions"
                :key="option.value"
                @click.stop="handleSnooze(notif.id, option.value)"
                class="block w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
              >
                {{ option.label }}
              </button>
            </div>
          </div>
          <button
            v-if="currentTab !== 'archived'"
            @click.stop="handleArchive(notif.id)"
            class="p-1.5 rounded-lg hover:bg-gray-200 text-gray-500"
            title="Archivar"
          >
            <ArchiveBoxIcon class="h-4 w-4" />
          </button>
          <button
            @click.stop="handleDelete(notif.id)"
            class="p-1.5 rounded-lg hover:bg-red-100 text-gray-500 hover:text-red-600"
            title="Eliminar"
          >
            <TrashIcon class="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>

    <!-- Pagination -->
    <div
      v-if="totalPages > 1"
      class="flex items-center justify-center gap-2 mt-8"
    >
      <button
        @click="goToPage(currentPage - 1)"
        :disabled="currentPage <= 1"
        class="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Anterior
      </button>
      <span class="text-sm text-gray-600">
        Página {{ currentPage }} de {{ totalPages }}
      </span>
      <button
        @click="goToPage(currentPage + 1)"
        :disabled="currentPage >= totalPages"
        class="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Siguiente
      </button>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  CheckIcon,
  ClockIcon,
  ArchiveBoxIcon,
  TrashIcon,
} from '@heroicons/vue/24/outline'
import { BellIcon as BellSlashIcon } from '@heroicons/vue/24/outline'
import {
  BellAlertIcon,
  DocumentTextIcon,
  RectangleStackIcon,
  InboxIcon,
} from '@heroicons/vue/24/solid'
import { useNotificationStore } from '@/stores/notification'

const router = useRouter()
const store = useNotificationStore()

const openSnoozeId = ref(null)

const tabs = [
  { key: 'all', label: 'Todas' },
  { key: 'unread', label: 'No leídas' },
  { key: 'archived', label: 'Archivadas' },
]

const snoozeOptions = [
  { value: '1h', label: '1 hora' },
  { value: '3h', label: '3 horas' },
  { value: '1d', label: '1 día' },
  { value: '3d', label: '3 días' },
]

const notifications = computed(() => store.notifications)
const totalCount = computed(() => store.totalCount)
const unreadCount = computed(() => store.unreadCount)
const currentTab = computed(() => store.currentTab)
const currentPage = computed(() => store.currentPage)
const dataLoaded = computed(() => store.dataLoaded)
const totalPages = computed(() => Math.ceil(totalCount.value / store.pageSize) || 1)

onMounted(async () => {
  await store.fetchNotifications('all', 1)
  await store.fetchUnreadCount()
})

const switchTab = async (tab) => {
  openSnoozeId.value = null
  await store.fetchNotifications(tab, 1)
}

const goToPage = async (page) => {
  if (page >= 1 && page <= totalPages.value) {
    await store.fetchNotifications(null, page)
  }
}

const handleMarkRead = async (id) => {
  await store.markAsRead(id)
}

const handleMarkAllRead = async () => {
  await store.markAllRead()
  await store.fetchNotifications()
}

const handleArchive = async (id) => {
  await store.archiveNotification(id)
}

const toggleSnoozeMenu = (id) => {
  openSnoozeId.value = openSnoozeId.value === id ? null : id
}

const handleSnooze = async (id, duration) => {
  openSnoozeId.value = null
  await store.snoozeNotification(id, duration)
}

const handleDelete = async (id) => {
  await store.deleteNotification(id)
}

const handleNotificationClick = async (notif) => {
  if (!notif.is_read) {
    await store.markAsRead(notif.id)
  }
  store.navigateToNotificationTarget(router, notif)
}

// Close snooze menu on outside click
watch(openSnoozeId, (val) => {
  if (val !== null) {
    const handler = () => {
      openSnoozeId.value = null
      document.removeEventListener('click', handler)
    }
    setTimeout(() => document.addEventListener('click', handler), 0)
  }
})

const getCategoryIcon = (category) => {
  if (category.startsWith('signature')) return DocumentTextIcon
  if (category === 'process_alert') return BellAlertIcon
  if (category === 'general') return InboxIcon
  return RectangleStackIcon
}

const getCategoryIconClass = (category) => {
  if (category.startsWith('signature')) return 'bg-purple-100 text-purple-600'
  if (category === 'process_alert') return 'bg-orange-100 text-orange-600'
  return 'bg-gray-100 text-gray-600'
}

const formatRelativeDate = (dateStr) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Ahora'
  if (diffMins < 60) return `Hace ${diffMins} min`
  if (diffHours < 24) return `Hace ${diffHours}h`
  if (diffDays < 7) return `Hace ${diffDays}d`

  return date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
}
</script>
