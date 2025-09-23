<template>
  <div class="bg-white shadow rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
    <!-- Organization Header -->
    <div class="relative h-32 bg-gradient-to-r from-blue-500 to-purple-600">
      <img 
        v-if="invitation.organization_info.cover_image_url" 
        :src="invitation.organization_info.cover_image_url" 
        :alt="`Portada de ${invitation.organization_info.title}`"
        class="w-full h-full object-cover"
      />
      <div class="absolute inset-0 bg-black bg-opacity-30"></div>
      
      <!-- Organization Profile Image -->
      <div class="absolute bottom-3 left-4">
        <img 
          :src="invitation.organization_info.profile_image_url || '/src/assets/images/user_avatar.jpg'" 
          :alt="`Logo de ${invitation.organization_info.title}`"
          class="h-12 w-12 rounded-full border-2 border-white object-cover bg-white"
        />
      </div>

      <!-- Status Badge -->
      <div class="absolute top-3 right-3">
        <span 
          :class="getStatusColorClass(invitation.status)"
          class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
        >
          {{ getStatusDisplay(invitation.status) }}
        </span>
      </div>
    </div>

    <!-- Card Content -->
    <div class="p-6">
      <!-- Organization Info -->
      <div class="mb-4">
        <h3 class="text-lg font-semibold text-gray-900 mb-1">
          {{ invitation.organization_info.title }}
        </h3>
        <p class="text-sm text-gray-600 mb-3 line-clamp-2">
          {{ invitation.organization_info.description }}
        </p>
        
        <!-- Organization Metrics -->
        <div class="flex items-center space-x-4 text-xs text-gray-500">
          <div class="flex items-center">
            <UsersIcon class="h-3 w-3 mr-1" />
            {{ invitation.organization_info.member_count }} miembros
          </div>
          <div class="flex items-center">
            <CalendarIcon class="h-3 w-3 mr-1" />
            {{ formatDate(invitation.created_at) }}
          </div>
        </div>
      </div>

      <!-- Invitation Details -->
      <div class="mb-4 p-3 bg-gray-50 rounded-lg">
        <div class="flex items-start space-x-3">
          <img 
            :src="invitedByProfileImage"
            :alt="`Avatar de ${invitation.invited_by_info.full_name}`"
            class="h-8 w-8 rounded-full object-cover border border-gray-200"
          />
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-gray-900">
              {{ invitation.invited_by_info.full_name }}
            </p>
            <p class="text-xs text-gray-500 mb-2">
              {{ invitation.invited_by_info.email }}
            </p>
            <p class="text-sm text-gray-700 italic">
              "{{ invitation.message || 'Te invita a unirte a esta organización.' }}"
            </p>
          </div>
        </div>
      </div>

      <!-- Expiration Info -->
      <div v-if="invitation.expires_at" class="mb-4">
        <div class="flex items-center text-xs" :class="isExpiringSoon ? 'text-orange-600' : 'text-gray-500'">
          <ClockIcon class="h-3 w-3 mr-1" />
          <span v-if="invitation.is_expired">
            Expiró {{ formatRelativeDate(invitation.expires_at) }}
          </span>
          <span v-else>
            Expira {{ formatRelativeDate(invitation.expires_at) }}
          </span>
        </div>
      </div>

      <!-- Actions -->
      <div v-if="canRespond" class="flex space-x-3">
        <button
          @click="respondToInvitation('accept')"
          :disabled="isLoading"
          class="flex-1 inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <div v-if="isLoading && actionType === 'accept'" class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
          <CheckIcon v-else class="h-4 w-4 mr-2" />
          {{ isLoading && actionType === 'accept' ? 'Aceptando...' : 'Aceptar' }}
        </button>
        
        <button
          @click="respondToInvitation('reject')"
          :disabled="isLoading"
          class="flex-1 inline-flex justify-center items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <div v-if="isLoading && actionType === 'reject'" class="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
          <XMarkIcon v-else class="h-4 w-4 mr-2" />
          {{ isLoading && actionType === 'reject' ? 'Rechazando...' : 'Rechazar' }}
        </button>
      </div>

      <!-- Already responded -->
      <div v-else-if="invitation.responded_at" class="text-center py-2">
        <p class="text-sm text-gray-600">
          Respondiste {{ formatRelativeDate(invitation.responded_at) }}
        </p>
      </div>

      <!-- Expired -->
      <div v-else class="text-center py-2">
        <p class="text-sm text-gray-500">
          Esta invitación ha expirado
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { 
  UsersIcon, 
  CalendarIcon, 
  ClockIcon, 
  CheckIcon, 
  XMarkIcon 
} from '@heroicons/vue/24/outline';
import { useOrganizationsStore } from '@/stores/organizations';
import { showNotification } from '@/shared/notification_message';

// Props
const props = defineProps({
  invitation: {
    type: Object,
    required: true
  }
});

// Emits
const emit = defineEmits(['responded']);

// Store
const organizationsStore = useOrganizationsStore();

// Reactive state
const isLoading = ref(false);
const actionType = ref(null);

// Computed properties
const canRespond = computed(() => {
  return props.invitation.can_be_responded && 
         !props.invitation.is_expired && 
         props.invitation.status === 'PENDING';
});

const isExpiringSoon = computed(() => {
  if (!props.invitation.expires_at) return false;
  const expirationDate = new Date(props.invitation.expires_at);
  const now = new Date();
  const timeDiff = expirationDate - now;
  const daysDiff = timeDiff / (1000 * 60 * 60 * 24);
  return daysDiff <= 7 && daysDiff > 0;
});

const invitedByProfileImage = computed(() => {
  // Use organization profile image as fallback for invited_by user
  return props.invitation.organization_info.profile_image_url || '/src/assets/images/user_avatar.jpg';
});

// Methods
const respondToInvitation = async (action) => {
  try {
    isLoading.value = true;
    actionType.value = action;
    
    const response = await organizationsStore.respondToInvitation(props.invitation.id, action);
    
    const actionText = action === 'accept' ? 'aceptada' : 'rechazada';
    showNotification(`Invitación ${actionText} exitosamente`, 'success');
    
    emit('responded', response.invitation);
    
  } catch (error) {
    console.error('Error responding to invitation:', error);
    
    if (error.response?.data?.error) {
      showNotification(error.response.data.error, 'error');
    } else {
      showNotification('Error al responder la invitación', 'error');
    }
  } finally {
    isLoading.value = false;
    actionType.value = null;
  }
};

const getStatusDisplay = (status) => {
  const statusMap = {
    'PENDING': 'Pendiente',
    'ACCEPTED': 'Aceptada',
    'REJECTED': 'Rechazada',
    'EXPIRED': 'Expirada',
    'CANCELLED': 'Cancelada'
  };
  return statusMap[status] || status;
};

const getStatusColorClass = (status) => {
  const colorMap = {
    'PENDING': 'bg-yellow-100 text-yellow-800',
    'ACCEPTED': 'bg-green-100 text-green-800',
    'REJECTED': 'bg-red-100 text-red-800',
    'EXPIRED': 'bg-gray-100 text-gray-800',
    'CANCELLED': 'bg-gray-100 text-gray-800'
  };
  return colorMap[status] || 'bg-gray-100 text-gray-800';
};

const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('es-ES', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
};

const formatRelativeDate = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now - date);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'hoy';
  if (diffDays === 1) return 'hace 1 día';
  if (diffDays < 7) return `hace ${diffDays} días`;
  if (diffDays < 30) return `hace ${Math.ceil(diffDays / 7)} semanas`;
  return formatDate(dateString);
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

