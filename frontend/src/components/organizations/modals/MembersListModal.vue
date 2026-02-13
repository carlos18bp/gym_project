<template>
  <TransitionRoot as="template" :show="visible">
    <Dialog as="div" class="relative z-50" @close="emit('close')">
      <TransitionChild
        as="template"
        enter="ease-out duration-300"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="ease-in duration-200"
        leave-from="opacity-100"
        leave-to="opacity-0"
      >
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
      </TransitionChild>

      <div class="fixed inset-0 z-10 overflow-y-auto">
        <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
          <TransitionChild
            as="template"
            enter="ease-out duration-300"
            enter-from="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            enter-to="opacity-100 translate-y-0 sm:scale-100"
            leave="ease-in duration-200"
            leave-from="opacity-100 translate-y-0 sm:scale-100"
            leave-to="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
          >
            <DialogPanel class="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl sm:p-6">
              <!-- Header -->
              <div class="mb-4">
                <div class="flex items-center justify-between">
                  <div class="flex items-center space-x-3">
                    <div class="flex-shrink-0">
                      <img
                        v-if="organization"
                        :src="organization.profile_image_url || userAvatar"
                        :alt="`Logo de ${organization?.title}`"
                        class="h-12 w-12 rounded-full object-cover border-2 border-gray-200"
                      />
                    </div>
                    <div>
                      <DialogTitle as="h3" class="text-lg font-semibold leading-6 text-gray-900">
                        Miembros de {{ organization?.title }}
                      </DialogTitle>
                      <p class="text-sm text-gray-500">
                        {{ members.length }} {{ members.length === 1 ? 'miembro activo' : 'miembros activos' }}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    class="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    @click="emit('close')"
                  >
                    <span class="sr-only">Cerrar</span>
                    <XMarkIcon class="h-6 w-6" />
                  </button>
                </div>
              </div>

              <!-- Loading state -->
              <div v-if="isLoading" class="flex justify-center items-center py-12">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span class="ml-2 text-gray-600">Cargando miembros...</span>
              </div>

              <!-- Members list -->
              <div v-else-if="members.length > 0" class="mt-4">
                <div class="max-h-96 overflow-y-auto">
                  <ul role="list" class="divide-y divide-gray-200">
                    <li
                      v-for="member in members"
                      :key="member.id"
                      class="py-4 hover:bg-gray-50 px-4 rounded-lg transition-colors"
                    >
                      <div class="flex items-center space-x-4">
                        <!-- Member Avatar -->
                        <div class="flex-shrink-0">
                          <img
                            v-if="member.user_info?.profile_image_url"
                            :src="member.user_info.profile_image_url"
                            :alt="`Avatar de ${member.user_info?.full_name}`"
                            class="h-10 w-10 rounded-full object-cover border border-gray-200"
                          />
                          <div
                            v-else
                            class="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold text-sm shadow-sm"
                          >
                            {{ getInitials(member.user_info?.first_name, member.user_info?.last_name) }}
                          </div>
                        </div>

                        <!-- Member Info -->
                        <div class="flex-1 min-w-0">
                          <p class="text-sm font-medium text-gray-900 truncate">
                            {{ member.user_info?.full_name }}
                          </p>
                          <p class="text-sm text-gray-500 truncate">
                            {{ member.user_info?.email }}
                          </p>
                        </div>

                        <!-- Member Role and Status -->
                        <div class="flex items-center space-x-2">
                          <span
                            :class="[
                              member.role === 'ADMIN'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-blue-100 text-blue-800',
                              'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium'
                            ]"
                          >
                            {{ member.role_display }}
                          </span>
                          
                          <span
                            v-if="member.is_active"
                            class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"
                          >
                            <CheckCircleIcon class="h-3 w-3 mr-1" />
                            Activo
                          </span>
                        </div>

                        <!-- Joined Date -->
                        <div class="flex-shrink-0 text-sm text-gray-500">
                          <div class="flex items-center">
                            <CalendarIcon class="h-4 w-4 mr-1" />
                            {{ formatDate(member.joined_at) }}
                          </div>
                        </div>
                      </div>
                    </li>
                  </ul>
                </div>
              </div>

              <!-- Empty state -->
              <div v-else class="text-center py-12">
                <UsersIcon class="h-12 w-12 mx-auto text-gray-300" />
                <h3 class="mt-2 text-sm font-medium text-gray-900">No hay miembros</h3>
                <p class="mt-1 text-sm text-gray-500">
                  Esta organización aún no tiene miembros activos.
                </p>
              </div>

              <!-- Footer -->
              <div class="mt-5 sm:mt-6">
                <button
                  type="button"
                  class="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                  @click="emit('close')"
                >
                  Cerrar
                </button>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

<script setup>
import { ref, watch } from 'vue';
import { Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from '@headlessui/vue';
import { 
  XMarkIcon, 
  UsersIcon, 
  CheckCircleIcon, 
  CalendarIcon 
} from '@heroicons/vue/24/outline';
import { useOrganizationsStore } from '@/stores/organizations';
import { showNotification } from '@/shared/notification_message';
import userAvatar from '@/assets/images/user_avatar.jpg';

// Props
const props = defineProps({
  visible: {
    type: Boolean,
    required: true
  },
  organization: {
    type: Object,
    default: null
  }
});

// Emits
const emit = defineEmits(['close']);

// Store
const organizationsStore = useOrganizationsStore();

// Reactive state
const isLoading = ref(false);
const members = ref([]);

// Methods
const loadMembers = async () => {
  if (!props.organization?.id) return;
  
  try {
    isLoading.value = true;
    const response = await organizationsStore.getOrganizationMembers(props.organization.id);
    members.value = response || [];
  } catch (error) {
    console.error('Error loading members:', error);
    showNotification('Error al cargar los miembros', 'error');
    members.value = [];
  } finally {
    isLoading.value = false;
  }
};

const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('es-ES', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
};

/**
 * Gets initials from first and last name
 */
const getInitials = (firstName, lastName) => {
  const first = firstName?.charAt(0)?.toUpperCase() || '';
  const last = lastName?.charAt(0)?.toUpperCase() || '';
  return `${first}${last}` || '?';
};

// Watchers
watch(() => props.visible, (newValue) => {
  if (newValue && props.organization) {
    loadMembers();
  }
});
</script>

