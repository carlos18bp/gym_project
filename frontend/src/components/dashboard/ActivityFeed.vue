<!-- ActivityFeed.vue -->
<!--
  Container for the dashboard tabs:
  - NotificationsWidget — Notification Center summary (first tab, replaces the
    standalone NotificationSummaryCard).
  - FeedWidget — Recent user activity.
  - ContactsWidget — Contacts (clients) or Lawyers depending on role.
  - ReportsWidget — Reports/statistics, lawyer-only.
-->
<template>
  <div class="bg-white rounded-xl shadow-md border border-gray-200 p-4 flex flex-col min-h-0 max-h-[36rem] lg:max-h-[32rem]">
    <!-- Tabs navigation. On mobile we use icons + tight spacing so the
         four-tab lawyer view (Notificaciones / Feed / Abogados / Reportes)
         fits without horizontal overflow on narrow phones. Each tab keeps
         its full label on >=sm screens. The Reportes tab was restored after
         it was temporarily hidden during R2 — the overflow is now fixed at
         the layout level instead of by removing functionality. -->
    <div class="border-b border-gray-200">
      <div class="flex flex-nowrap items-end gap-x-2 sm:gap-x-8 overflow-x-auto -mx-1 px-1">
        <!-- Notifications tab (first) -->
        <div class="text-center flex-shrink-0">
          <button
            class="inline-flex items-center gap-1 pb-2 font-medium relative whitespace-nowrap text-xs sm:text-sm"
            :class="activeTab === 'notifications' ? 'text-blue-500' : 'text-gray-500 hover:text-gray-700'"
            @click="activeTab = 'notifications'"
            data-testid="activity-feed-tab-notifications"
          >
            <BellIcon class="h-4 w-4 sm:hidden" />
            <span class="hidden sm:inline">Notificaciones</span>
            <span
              v-if="unreadCount > 0"
              class="ml-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full"
            >
              {{ unreadCount > 99 ? '99+' : unreadCount }}
            </span>
          </button>
          <div v-if="activeTab === 'notifications'" class="h-0.5 bg-blue-500 w-full mx-auto mt-2"></div>
        </div>

        <!-- Feed tab -->
        <div class="text-center flex-shrink-0">
          <button
            class="inline-flex items-center gap-1 pb-2 font-medium whitespace-nowrap text-xs sm:text-sm"
            :class="activeTab === 'feed' ? 'text-blue-500' : 'text-gray-500 hover:text-gray-700'"
            @click="activeTab = 'feed'"
            data-testid="activity-feed-tab-feed"
          >
            <RssIcon class="h-4 w-4 sm:hidden" />
            <span class="hidden sm:inline">Feed</span>
          </button>
          <div v-if="activeTab === 'feed'" class="h-0.5 bg-blue-500 w-full mx-auto mt-2"></div>
        </div>

        <!-- Contacts tab -->
        <div class="text-center flex-shrink-0">
          <button
            class="inline-flex items-center gap-1 pb-2 font-medium whitespace-nowrap text-xs sm:text-sm"
            :class="activeTab === 'contacts' ? 'text-blue-500' : 'text-gray-500 hover:text-gray-700'"
            @click="activeTab = 'contacts'"
            data-testid="activity-feed-tab-contacts"
          >
            <UsersIcon class="h-4 w-4 sm:hidden" />
            <span class="hidden sm:inline">{{ isLawyer ? 'Contactos' : 'Abogados' }}</span>
          </button>
          <div v-if="activeTab === 'contacts'" class="h-0.5 bg-blue-500 w-full mx-auto mt-2"></div>
        </div>

        <!-- Reports tab - visible to lawyer / admin / staff / superuser. -->
        <div v-if="isLawyerLike" class="text-center flex-shrink-0">
          <button
            class="inline-flex items-center gap-1 pb-2 font-medium whitespace-nowrap text-xs sm:text-sm"
            :class="activeTab === 'reports' ? 'text-blue-500' : 'text-gray-500 hover:text-gray-700'"
            @click="activeTab = 'reports'"
            data-testid="activity-feed-tab-reports"
          >
            <ChartBarIcon class="h-4 w-4 sm:hidden" />
            <span class="hidden sm:inline">Reportes</span>
          </button>
          <div v-if="activeTab === 'reports'" class="h-0.5 bg-blue-500 w-full mx-auto mt-2"></div>
        </div>
      </div>
    </div>

    <!-- Tab content -->
    <div class="mt-4 flex-1 min-h-0 overflow-hidden">
      <NotificationsWidget v-if="activeTab === 'notifications'" :user="user" />
      <FeedWidget v-if="activeTab === 'feed'" :user="user" />
      <ContactsWidget v-if="activeTab === 'contacts'" :user="user" />
      <ReportsWidget v-if="activeTab === 'reports' && isLawyerLike" :user="user" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { BellIcon, RssIcon, UsersIcon, ChartBarIcon } from '@heroicons/vue/24/outline'
import NotificationsWidget from '@/components/dashboard/widgets/NotificationsWidget.vue'
import FeedWidget from '@/components/dashboard/widgets/FeedWidget.vue'
import ContactsWidget from '@/components/dashboard/widgets/ContactsWidget.vue'
import ReportsWidget from '@/components/dashboard/widgets/ReportsWidget.vue'
import { useNotificationStore } from '@/stores/notification'

const props = defineProps({
  user: {
    type: Object,
    required: true,
  },
})

// Notifications becomes the default landing tab so the user sees pending
// items immediately when entering the dashboard.
const activeTab = ref('notifications')

// ``isLawyer`` controls UI text (Contactos vs Abogados) which is semantic to
// the lawyer role only. ``isLawyerLike`` controls access to the Reports tab
// and includes admin / is_staff / is_superuser, mirroring the
// ``isLawyerLike`` getter in ``stores/auth/user.js`` so admin users see the
// same lawyer-only widgets across the app (R3 follow-up: Reportes invisible
// para Admin).
const isLawyer = computed(() => props.user?.role === 'lawyer')
const isLawyerLike = computed(() => {
  const u = props.user
  return !!u && (
    u.role === 'lawyer' ||
    u.role === 'admin' ||
    u.is_staff ||
    u.is_superuser
  )
})

const notificationStore = useNotificationStore()
const unreadCount = computed(() => notificationStore.unreadCount)

// Reset to notifications tab if reports is active but the user is no longer
// allowed to see it (lost lawyer/admin/staff privileges).
watch(() => props.user, (newUser) => {
  if (activeTab.value !== 'reports') return
  const stillAllowed = !!newUser && (
    newUser.role === 'lawyer' ||
    newUser.role === 'admin' ||
    newUser.is_staff ||
    newUser.is_superuser
  )
  if (!stillAllowed) {
    activeTab.value = 'notifications'
  }
}, { deep: true })
</script>
