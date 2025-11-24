<template>
  <div class="bg-white shadow rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
    <!-- Organization Header with Cover Image -->
    <div class="relative h-32 bg-gradient-to-r from-blue-500 to-purple-600">
      <img 
        v-if="organization.cover_image_url" 
        :src="organization.cover_image_url" 
        :alt="`Portada de ${organization.title}`"
        class="w-full h-full object-cover"
      />
      <div class="absolute inset-0 bg-black bg-opacity-30"></div>
      
      <!-- Organization Profile Image -->
      <div class="absolute bottom-3 left-4">
        <img
          :src="organization.profile_image_url || userAvatar"
          :alt="`Logo de ${organization.title}`"
          class="h-12 w-12 rounded-full border-2 border-white object-cover bg-white"
        />
      </div>

      <!-- Member Badge -->
      <div class="absolute top-3 right-3">
        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <CheckIcon class="h-3 w-3 mr-1" />
          Miembro
        </span>
      </div>
    </div>

    <!-- Card Content -->
    <div class="p-4">
      <!-- Organization Info -->
      <div class="mb-4">
        <h3 class="text-lg font-semibold text-gray-900 mb-1">
          {{ organization.title }}
        </h3>
        <p class="text-sm text-gray-600 mb-3 line-clamp-2">
          {{ organization.description }}
        </p>
        
        <!-- Organization Metrics -->
        <div class="flex items-center space-x-4 text-xs text-gray-500 mb-3">
          <div class="flex items-center">
            <UsersIcon class="h-3 w-3 mr-1" />
            {{ organization.member_count }} miembros
          </div>
          <div class="flex items-center">
            <CalendarIcon class="h-3 w-3 mr-1" />
            Miembro desde {{ formatDate(organization.joined_at) }}
          </div>
        </div>
      </div>

      <!-- Corporate Client Info -->
      <div class="mb-4 p-3 bg-gray-50 rounded-lg">
        <p class="text-xs text-gray-500 mb-1">Líder de la organización</p>
        <div class="flex items-center space-x-2">
          <img
            :src="organization.corporate_client_info.profile_image_url || userAvatar"
            :alt="`Avatar de ${organization.corporate_client_info.full_name}`"
            class="h-6 w-6 rounded-full object-cover border border-gray-200"
          />
          <div>
            <p class="text-sm font-medium text-gray-900">
              {{ organization.corporate_client_info.full_name }}
            </p>
            <p class="text-xs text-gray-500">
              {{ organization.corporate_client_info.email }}
            </p>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="space-y-2">
        <!-- Primary action - Create request -->
        <button
          @click="createRequest"
          class="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
        >
          <PlusIcon class="h-4 w-4 mr-2" />
          Nueva Solicitud
        </button>

        <!-- Secondary actions -->
        <div class="flex gap-2">
          <button
            @click="viewDetails"
            class="flex-1 inline-flex justify-center items-center px-2 py-2 border border-gray-300 text-xs sm:text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            <EyeIcon class="h-4 w-4 sm:mr-1" />
            <span class="hidden sm:inline">Ver Detalles</span>
            <span class="sm:hidden">Detalles</span>
          </button>
          
          <button
            @click="showLeaveConfirmation = true"
            class="flex-1 inline-flex justify-center items-center px-2 py-2 border border-red-300 text-xs sm:text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
          >
            <ArrowLeftOnRectangleIcon class="h-4 w-4 sm:mr-1" />
            <span class="hidden sm:inline">Salir</span>
            <span class="sm:hidden">Salir</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Leave Confirmation Modal -->
    <ConfirmationModal
      :visible="showLeaveConfirmation"
      :title="`¿Salir de ${organization.title}?`"
      :message="`¿Estás seguro de que quieres abandonar esta organización? Ya no podrás enviar solicitudes a través de ella.`"
      confirm-text="Sí, salir"
      confirm-color="red"
      :is-loading="isLeaving"
      @confirm="leaveOrganization"
      @cancel="showLeaveConfirmation = false"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { 
  UsersIcon, 
  CalendarIcon, 
  CheckIcon, 
  PlusIcon, 
  EyeIcon, 
  ArrowLeftOnRectangleIcon 
} from '@heroicons/vue/24/outline';
import { useOrganizationsStore } from '@/stores/organizations';
import { showNotification } from '@/shared/notification_message';
import ConfirmationModal from '../../modals/ConfirmationModal.vue';
import userAvatar from '@/assets/images/user_avatar.jpg';

// Props
const props = defineProps({
  organization: {
    type: Object,
    required: true
  }
});

// Emits
const emit = defineEmits(['left', 'create-request', 'view-details']);

// Store
const organizationsStore = useOrganizationsStore();

// Reactive state
const showLeaveConfirmation = ref(false);
const isLeaving = ref(false);

// Methods
const createRequest = () => {
  emit('create-request', props.organization.id);
};

const viewDetails = () => {
  // Emit event to parent to scroll to organization posts section
  emit('view-details', props.organization.id);
};

const leaveOrganization = async () => {
  try {
    isLeaving.value = true;
    
    await organizationsStore.leaveOrganization(props.organization.id);
    
    showNotification(`Has abandonado ${props.organization.title}`, 'success');
    showLeaveConfirmation.value = false;
    emit('left', props.organization.id);
    
  } catch (error) {
    console.error('Error leaving organization:', error);
    
    if (error.response?.data?.error) {
      showNotification(error.response.data.error, 'error');
    } else {
      showNotification('Error al abandonar la organización', 'error');
    }
  } finally {
    isLeaving.value = false;
  }
};

const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('es-ES', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
};
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>

