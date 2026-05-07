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
  <div class="bg-white rounded-xl shadow-md border border-gray-200 p-4 h-full flex flex-col">
    <!-- Tabs navigation -->
    <div class="border-b border-gray-200">
      <div class="flex">
        <!-- Notifications tab (first) -->
        <div class="mr-8 text-center">
          <button
            class="inline-block pb-2 font-medium relative"
            :class="activeTab === 'notifications' ? 'text-blue-500' : 'text-gray-500 hover:text-gray-700'"
            @click="activeTab = 'notifications'"
          >
            Notificaciones
            <span
              v-if="unreadCount > 0"
              class="absolute -top-1 -right-3 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full"
            >
              {{ unreadCount > 99 ? '99+' : unreadCount }}
            </span>
          </button>
          <div v-if="activeTab === 'notifications'" class="h-0.5 bg-blue-500 w-24 mx-auto mt-2"></div>
        </div>

        <!-- Feed tab -->
        <div class="mr-8 text-center">
          <button
            class="inline-block pb-2 font-medium"
            :class="activeTab === 'feed' ? 'text-blue-500' : 'text-gray-500 hover:text-gray-700'"
            @click="activeTab = 'feed'"
          >
            Feed
          </button>
          <div v-if="activeTab === 'feed'" class="h-0.5 bg-blue-500 w-12 mx-auto mt-2"></div>
        </div>

        <!-- Contacts tab -->
        <div class="mr-8 text-center">
          <button
            class="inline-block pb-2 font-medium"
            :class="activeTab === 'contacts' ? 'text-blue-500' : 'text-gray-500 hover:text-gray-700'"
            @click="activeTab = 'contacts'"
          >
            {{ isLawyer ? 'Contactos' : 'Abogados' }}
          </button>
          <div v-if="activeTab === 'contacts'" class="h-0.5 bg-blue-500 w-20 mx-auto mt-2"></div>
        </div>

        <!-- Reports tab - only visible to lawyers -->
        <div v-if="isLawyer" class="text-center">
          <button
            class="inline-block pb-2 font-medium"
            :class="activeTab === 'reports' ? 'text-blue-500' : 'text-gray-500 hover:text-gray-700'"
            @click="activeTab = 'reports'"
          >
            Reportes
          </button>
          <div v-if="activeTab === 'reports'" class="h-0.5 bg-blue-500 w-20 mx-auto mt-2"></div>
        </div>
      </div>
    </div>

    <!-- Tab content -->
    <div class="mt-4 flex-1">
      <NotificationsWidget v-if="activeTab === 'notifications'" :user="user" />
      <FeedWidget v-if="activeTab === 'feed'" :user="user" />
      <ContactsWidget v-if="activeTab === 'contacts'" :user="user" />
      <ReportsWidget v-if="activeTab === 'reports' && isLawyer" :user="user" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
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

const isLawyer = computed(() => props.user?.role === 'lawyer')

const notificationStore = useNotificationStore()
const unreadCount = computed(() => notificationStore.unreadCount)

// Reset to notifications tab if reports is active but user is no longer a lawyer.
watch(() => props.user, (newUser) => {
  if (activeTab.value === 'reports' && newUser?.role !== 'lawyer') {
    activeTab.value = 'notifications'
  }
}, { deep: true })
</script>
