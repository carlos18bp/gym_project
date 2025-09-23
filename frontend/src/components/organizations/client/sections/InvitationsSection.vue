<template>
  <div>
    <!-- Header -->
    <div class="mb-6">
      <h2 class="text-lg font-medium text-gray-900">Invitaciones Recibidas</h2>
      <p class="mt-1 text-sm text-gray-600">
        Revisa y responde a las invitaciones de organizaciones
      </p>
    </div>

    <!-- Loading state -->
    <div v-if="isLoading" class="flex justify-center items-center py-8">
      <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      <span class="ml-2 text-gray-600">Cargando invitaciones...</span>
    </div>

    <!-- Invitations list -->
    <div v-else-if="invitations.length > 0" class="space-y-4">
      <InvitationCard
        v-for="invitation in invitations"
        :key="invitation.id"
        :invitation="invitation"
        @responded="handleInvitationResponded"
      />
    </div>

    <!-- Empty state -->
    <div v-else class="text-center py-12">
      <EnvelopeIcon class="h-16 w-16 mx-auto mb-4 text-gray-300" />
      <h3 class="text-lg font-medium text-gray-900 mb-2">
        No tienes invitaciones
      </h3>
      <p class="text-gray-600 mb-6">
        Cuando recibas invitaciones de organizaciones, aparecerán aquí para que puedas responderlas.
      </p>
      
      <!-- Info box -->
      <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto">
        <div class="flex">
          <InformationCircleIcon class="h-5 w-5 text-blue-400 mt-0.5" />
          <div class="ml-3 text-left">
            <h5 class="text-sm font-medium text-blue-800">¿Cómo recibir invitaciones?</h5>
            <div class="mt-1 text-sm text-blue-700 space-y-1">
              <p>• Los clientes corporativos pueden invitarte a sus organizaciones</p>
              <p>• Solo necesitan tu email registrado en la plataforma</p>
              <p>• Las invitaciones aparecerán automáticamente aquí</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { EnvelopeIcon, InformationCircleIcon } from '@heroicons/vue/24/outline';
import InvitationCard from '../cards/InvitationCard.vue';

// Props
const props = defineProps({
  invitations: {
    type: Array,
    default: () => []
  },
  isLoading: {
    type: Boolean,
    default: false
  }
});

// Emits
const emit = defineEmits(['invitation-responded']);

// Methods
const handleInvitationResponded = (invitationData) => {
  emit('invitation-responded', invitationData);
};
</script>

