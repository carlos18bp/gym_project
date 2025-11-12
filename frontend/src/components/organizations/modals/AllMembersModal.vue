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
            <DialogPanel class="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-4xl sm:p-6">
              <!-- Header -->
              <div class="mb-4">
                <div class="flex items-center justify-between">
                  <div>
                    <DialogTitle as="h3" class="text-lg font-semibold leading-6 text-gray-900">
                      Todos los Miembros
                    </DialogTitle>
                    <p class="text-sm text-gray-500 mt-1">
                      {{ totalMembers }} {{ totalMembers === 1 ? 'miembro' : 'miembros' }} en {{ organizations.length }} {{ organizations.length === 1 ? 'organización' : 'organizaciones' }}
                    </p>
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

              <!-- Organizations with members -->
              <div v-else-if="organizationsWithMembers.length > 0" class="mt-4">
                <div class="max-h-[32rem] overflow-y-auto space-y-6">
                  <div
                    v-for="org in organizationsWithMembers"
                    :key="org.organization.id"
                    class="border border-gray-200 rounded-lg overflow-hidden"
                  >
                    <!-- Organization Header -->
                    <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
                      <div class="flex items-center space-x-3">
                        <img
                          :src="org.organization.profile_image_url || userAvatar"
                          :alt="`Logo de ${org.organization.title}`"
                          class="h-10 w-10 rounded-full object-cover border-2 border-gray-200"
                        />
                        <div>
                          <h4 class="text-sm font-semibold text-gray-900">
                            {{ org.organization.title }}
                          </h4>
                          <p class="text-xs text-gray-500">
                            {{ org.members.length }} {{ org.members.length === 1 ? 'miembro' : 'miembros' }}
                          </p>
                        </div>
                      </div>
                    </div>

                    <!-- Members List -->
                    <div class="bg-white">
                      <ul role="list" class="divide-y divide-gray-200">
                        <li
                          v-for="member in org.members"
                          :key="member.id"
                          class="py-3 px-4 hover:bg-gray-50 transition-colors"
                        >
                          <div class="flex items-center space-x-3">
                            <!-- Member Avatar -->
                            <div class="flex-shrink-0">
                              <img
                                :src="member.user_info?.profile_image_url || userAvatar"
                                :alt="`Avatar de ${member.user_info?.full_name}`"
                                class="h-8 w-8 rounded-full object-cover border border-gray-200"
                              />
                            </div>

                            <!-- Member Info -->
                            <div class="flex-1 min-w-0">
                              <p class="text-sm font-medium text-gray-900 truncate">
                                {{ member.user_info?.full_name }}
                              </p>
                              <p class="text-xs text-gray-500 truncate">
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
                                  'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium'
                                ]"
                              >
                                {{ member.role_display }}
                              </span>
                              
                              <span
                                v-if="member.is_active"
                                class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800"
                              >
                                <CheckCircleIcon class="h-3 w-3 mr-1" />
                                Activo
                              </span>
                            </div>

                            <!-- Joined Date -->
                            <div class="flex-shrink-0 text-xs text-gray-500 hidden sm:block">
                              <div class="flex items-center">
                                <CalendarIcon class="h-3 w-3 mr-1" />
                                {{ formatDate(member.joined_at) }}
                              </div>
                            </div>
                          </div>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Empty state -->
              <div v-else class="text-center py-12">
                <UsersIcon class="h-12 w-12 mx-auto text-gray-300" />
                <h3 class="mt-2 text-sm font-medium text-gray-900">No hay miembros</h3>
                <p class="mt-1 text-sm text-gray-500">
                  Tus organizaciones aún no tienen miembros activos.
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
import { ref, computed, watch } from 'vue';
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
  organizations: {
    type: Array,
    default: () => []
  }
});

// Emits
const emit = defineEmits(['close']);

// Store
const organizationsStore = useOrganizationsStore();

// Reactive state
const isLoading = ref(false);
const organizationsWithMembers = ref([]);

// Computed
const totalMembers = computed(() => {
  return organizationsWithMembers.value.reduce((total, org) => total + org.members.length, 0);
});

// Methods
const loadAllMembers = async () => {
  if (!props.organizations || props.organizations.length === 0) return;
  
  try {
    isLoading.value = true;
    
    // Load members for each organization
    const promises = props.organizations.map(async (org) => {
      try {
        const members = await organizationsStore.getOrganizationMembers(org.id);
        return {
          organization: org,
          members: members || []
        };
      } catch (error) {
        console.error(`Error loading members for organization ${org.id}:`, error);
        return {
          organization: org,
          members: []
        };
      }
    });
    
    organizationsWithMembers.value = await Promise.all(promises);
  } catch (error) {
    console.error('Error loading all members:', error);
    showNotification('Error al cargar los miembros', 'error');
    organizationsWithMembers.value = [];
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

// Watchers
watch(() => props.visible, (newValue) => {
  if (newValue && props.organizations && props.organizations.length > 0) {
    loadAllMembers();
  }
});
</script>

