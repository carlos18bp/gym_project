<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
    @click.self="closeModal"
  >
    <div class="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[80vh] flex flex-col">
      <!-- Header -->
      <div class="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex-shrink-0 rounded-t-xl">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-lg font-semibold text-white">
              {{ title }}
            </h3>
            <p class="text-blue-100 text-sm">
              Usuarios asociados a este proceso
            </p>
          </div>
          <button
            type="button"
            @click="closeModal"
            class="text-white hover:text-blue-200 transition-colors p-2 hover:bg-white/10 rounded-lg"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Content -->
      <div class="p-6 overflow-y-auto flex-1 min-h-0">
        <div v-if="safeUsers.length" class="space-y-3">
          <div
            v-for="user in safeUsers"
            :key="user.id || user.email || `${user.first_name}-${user.last_name}`"
            class="flex items-center gap-3 p-2 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors"
          >
            <!-- Avatar -->
            <div class="flex-shrink-0">
              <img
                v-if="user.photo_profile"
                :src="user.photo_profile"
                :alt="user.first_name || user.last_name || 'Usuario'"
                class="w-10 h-10 rounded-full object-cover border border-gray-200 shadow-sm"
              />
              <div
                v-else
                class="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold text-sm shadow-sm"
              >
                {{ getInitials(user.first_name, user.last_name) }}
              </div>
            </div>

            <!-- User info -->
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium text-gray-900 truncate">
                {{ user.first_name }} {{ user.last_name }}
              </p>
            </div>
          </div>
        </div>

        <!-- Empty state -->
        <div v-else class="text-center py-10">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="mx-auto h-12 w-12 text-gray-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
          <h3 class="mt-3 text-sm font-medium text-gray-900">Sin usuarios asociados</h3>
          <p class="mt-1 text-sm text-gray-500">
            Este proceso aún no tiene usuarios asociados para mostrar.
          </p>
        </div>
      </div>

      <!-- Footer -->
      <div class="bg-gray-50 px-6 py-4 flex justify-end border-t border-gray-200 flex-shrink-0 rounded-b-xl">
        <button
          type="button"
          @click="closeModal"
          class="px-5 py-2.5 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
        >
          Cerrar
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false,
  },
  users: {
    type: Array,
    default: () => [],
  },
  title: {
    type: String,
    default: 'Usuarios del Proceso',
  },
})

const emit = defineEmits(['close'])

const safeUsers = computed(() => {
  return Array.isArray(props.users) ? props.users : []
})

const closeModal = () => {
  emit('close')
}

/**
 * Gets initials from first and last name
 * @param {string} firstName
 * @param {string} lastName
 * @returns {string} Initials
 */
const getInitials = (firstName, lastName) => {
  const first = firstName?.charAt(0)?.toUpperCase() || ''
  const last = lastName?.charAt(0)?.toUpperCase() || ''
  return `${first}${last}` || '?'
}
</script>

