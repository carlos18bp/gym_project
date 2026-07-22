<template>
  <div class="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8 lg:hidden">
    <slot></slot>
  </div>

  <section class="pb-6 pt-4 px-4 sm:px-6 lg:px-8 lg:pt-10 lg:pb-10">
    <!-- Back button (visible on every screen size, useful on mobile where the
         sidebar is collapsed). -->
    <button
      type="button"
      class="inline-flex items-center text-sm text-secondary hover:text-secondary/80 mb-3"
      @click="goBack"
      data-testid="back-button"
    >
      <ChevronLeftIcon class="h-4 w-4 mr-1" />
      Volver a Inicio
    </button>

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
    <div class="border-b border-gray-200 mb-4">
      <nav class="flex space-x-6" aria-label="Tabs">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          @click="switchTab(tab.key)"
          :class="[
            currentTab === tab.key
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
            'relative whitespace-nowrap border-b-2 pb-3 px-1 text-sm font-medium transition-colors'
          ]"
          :data-testid="`tab-${tab.key}`"
        >
          {{ tab.label }}
          <span
            v-if="tabBadgeCount(tab.key) > 0"
            class="ml-2 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full align-middle"
          >
            {{ tabBadgeCount(tab.key) > 99 ? '99+' : tabBadgeCount(tab.key) }}
          </span>
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
        {{ currentTab === 'archived' ? 'No tienes notificaciones archivadas.' : 'No tienes notificaciones.' }}
      </p>
    </div>

    <!-- Notification table (Gmail-like rows) -->
    <ul
      v-else
      class="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden bg-white"
      data-testid="notifications-table"
    >
      <li
        v-for="notif in notifications"
        :key="notif.id"
        class="group relative flex items-center gap-3 px-3 sm:px-4 py-2.5 cursor-pointer transition-colors"
        :class="rowClasses(notif)"
        :data-testid="`notification-${notif.id}`"
        @click="handleNotificationClick(notif)"
      >
        <!-- Unread dot (always rendered to keep alignment stable) -->
        <span
          class="flex-shrink-0 w-2 h-2 rounded-full"
          :class="notif.is_read ? 'bg-transparent' : 'bg-blue-500'"
        ></span>

        <!-- Category icon (compact) -->
        <span
          class="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
          :class="getCategoryIconClass(notif.category)"
        >
          <component :is="getCategoryIcon(notif.category)" class="h-4 w-4" />
        </span>

        <!-- Title (column) -->
        <span
          class="flex-shrink-0 truncate text-sm w-40 sm:w-56 lg:w-64"
          :class="notif.is_read ? 'font-normal text-gray-700' : 'font-semibold text-gray-900'"
        >
          {{ notif.title }}
          <span
            v-if="notif.priority === 'high'"
            class="ml-1 px-1 py-0.5 text-[9px] font-bold uppercase bg-red-100 text-red-700 rounded align-middle"
          >
            Urgente
          </span>
        </span>

        <!-- Message (flex grow) -->
        <span
          class="flex-1 min-w-0 truncate text-sm"
          :class="notif.is_read ? 'text-gray-500' : 'text-gray-700'"
        >
          {{ notif.message }}
        </span>

        <!-- Date (visible by default, hidden on hover so the actions overlay) -->
        <span
          class="flex-shrink-0 ml-3 text-xs text-gray-400 whitespace-nowrap group-hover:opacity-0 transition-opacity"
        >
          {{ formatRelativeDate(notif.created_at) }}
        </span>

        <!-- Hover actions (overlay over the date column). While this row's
             snooze menu is open the bar stays visible and elevated: the
             hover-out fade would otherwise hide the open menu and its
             mid-transition opacity (<1) creates a stacking context that
             buries the z-10 dropdown beneath the next row. -->
        <div
          :class="[
            'absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 transition-opacity',
            openSnoozeId === notif.id ? 'opacity-100 z-20' : 'opacity-0 group-hover:opacity-100',
          ]"
        >
          <!-- Mark as read / unread toggle -->
          <button
            v-if="!notif.is_read"
            @click.stop="handleMarkRead(notif.id)"
            class="p-1.5 rounded-lg hover:bg-gray-200 text-gray-500"
            title="Marcar como leída"
            :data-testid="`mark-read-${notif.id}`"
          >
            <CheckIcon class="h-4 w-4" />
          </button>
          <button
            v-else
            @click.stop="handleMarkUnread(notif.id)"
            class="p-1.5 rounded-lg hover:bg-gray-200 text-gray-500"
            title="Marcar como no leída"
            :data-testid="`mark-unread-${notif.id}`"
          >
            <EnvelopeIcon class="h-4 w-4" />
          </button>

          <!-- Snooze (dropdown) — only for non-archived rows -->
          <div class="relative" v-if="currentTab !== 'archived'">
            <button
              @click.stop="toggleSnoozeMenu(notif.id)"
              class="p-1.5 rounded-lg hover:bg-gray-200 text-gray-500"
              title="Recordar después"
            >
              <ClockIcon class="h-4 w-4" />
            </button>
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

          <!-- Archive (active rows) -->
          <button
            v-if="currentTab !== 'archived'"
            @click.stop="handleArchive(notif.id)"
            class="p-1.5 rounded-lg hover:bg-gray-200 text-gray-500"
            title="Archivar"
            :data-testid="`archive-${notif.id}`"
          >
            <ArchiveBoxIcon class="h-4 w-4" />
          </button>

          <!-- Unarchive (only on the archived tab) -->
          <button
            v-else
            @click.stop="handleUnarchive(notif.id)"
            class="p-1.5 rounded-lg hover:bg-gray-200 text-gray-500"
            title="Desarchivar"
            :data-testid="`unarchive-${notif.id}`"
          >
            <ArchiveBoxXMarkIcon class="h-4 w-4" />
          </button>

          <!-- Delete -->
          <button
            @click.stop="handleDelete(notif.id)"
            class="p-1.5 rounded-lg hover:bg-red-100 text-gray-500 hover:text-red-600"
            title="Eliminar"
            :data-testid="`delete-${notif.id}`"
          >
            <TrashIcon class="h-4 w-4" />
          </button>
        </div>
      </li>
    </ul>

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
  ArchiveBoxXMarkIcon,
  TrashIcon,
  EnvelopeIcon,
  ChevronLeftIcon,
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

// "No leídas" tab removed — unread items already render with a stronger
// background tint inside "Todas", which made the dedicated tab redundant.
const tabs = [
  { key: 'all', label: 'Todas' },
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

// Archived rows are always read in the current data model, so only "all"
// surfaces a count badge.
const tabBadgeCount = (key) => (key === 'all' ? unreadCount.value : 0)

const goBack = () => {
  // Use router.back when there is history; fall back to dashboard otherwise.
  if (window.history.length > 1) {
    router.back()
  } else {
    router.push({ name: 'dashboard' })
  }
}

onMounted(async () => {
  // If a previously-stored "unread" tab leaks in from session state, normalize.
  const startTab = store.currentTab === 'unread' ? 'all' : (store.currentTab || 'all')
  await Promise.all([
    store.fetchNotifications(startTab, 1),
    store.fetchUnreadCount(),
  ])
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

const handleMarkUnread = async (id) => {
  await store.markAsUnread(id)
}

const handleMarkAllRead = async () => {
  await store.markAllRead()
  await store.fetchNotifications()
}

const handleArchive = async (id) => {
  await store.archiveNotification(id)
}

const handleUnarchive = async (id) => {
  await store.unarchiveNotification(id)
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

watch(openSnoozeId, (val) => {
  if (val !== null) {
    const handler = () => {
      openSnoozeId.value = null
      document.removeEventListener('click', handler)
    }
    setTimeout(() => document.addEventListener('click', handler), 0)
  }
})

const rowClasses = (notif) => {
  // Stronger contrast on unread rows so they stand out against read entries.
  // Archived rows always show as muted regardless of read state.
  if (currentTab.value === 'archived') {
    return 'bg-white hover:bg-gray-50'
  }
  return notif.is_read
    ? 'bg-white hover:bg-gray-50'
    : 'bg-blue-100 hover:bg-blue-100/80'
}

const getCategoryIcon = (category) => {
  if (!category) return RectangleStackIcon
  if (category.startsWith('signature')) return DocumentTextIcon
  if (category === 'process_alert') return BellAlertIcon
  if (category === 'general') return InboxIcon
  return RectangleStackIcon
}

const getCategoryIconClass = (category) => {
  if (!category) return 'bg-gray-100 text-gray-600'
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
