<template>
  <div>
    <!-- Header -->
    <div class="mb-6">
      <h2 class="text-lg font-medium text-gray-900">Mis Organizaciones</h2>
      <p class="mt-1 text-sm text-gray-600">
        Organizaciones donde eres miembro activo
      </p>
    </div>

    <!-- Loading state -->
    <div v-if="isLoading" class="flex justify-center items-center py-8">
      <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      <span class="ml-2 text-gray-600">Cargando organizaciones...</span>
    </div>

    <!-- Organizations grid -->
    <div v-else-if="organizations.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <OrganizationCard
        v-for="organization in organizations"
        :key="organization.id"
        :organization="organization"
        @left="handleOrganizationLeft"
        @create-request="handleCreateRequest"
      />
    </div>

    <!-- Empty state -->
    <div v-else class="text-center py-12">
      <BuildingOfficeIcon class="h-16 w-16 mx-auto mb-4 text-gray-300" />
      <h3 class="text-lg font-medium text-gray-900 mb-2">
        No perteneces a ninguna organización
      </h3>
      <p class="text-gray-600 mb-6">
        Para unirte a organizaciones, necesitas recibir y aceptar invitaciones de clientes corporativos.
      </p>
      
      <!-- Info boxes -->
      <div class="max-w-2xl mx-auto space-y-4">
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div class="flex">
            <InformationCircleIcon class="h-5 w-5 text-blue-400 mt-0.5" />
            <div class="ml-3 text-left">
              <h5 class="text-sm font-medium text-blue-800">¿Cómo unirme a una organización?</h5>
              <div class="mt-1 text-sm text-blue-700 space-y-1">
                <p>1. Espera a recibir una invitación de un cliente corporativo</p>
                <p>2. Revisa la invitación en la pestaña "Invitaciones"</p>
                <p>3. Acepta la invitación para convertirte en miembro</p>
                <p>4. Una vez miembro, podrás enviar solicitudes a esa organización</p>
              </div>
            </div>
          </div>
        </div>

        <div class="bg-green-50 border border-green-200 rounded-lg p-4">
          <div class="flex">
            <CheckCircleIcon class="h-5 w-5 text-green-400 mt-0.5" />
            <div class="ml-3 text-left">
              <h5 class="text-sm font-medium text-green-800">Beneficios de ser miembro</h5>
              <div class="mt-1 text-sm text-green-700 space-y-1">
                <p>• Enviar solicitudes corporativas especializadas</p>
                <p>• Acceso a servicios específicos de la organización</p>
                <p>• Comunicación directa con el equipo corporativo</p>
                <p>• Seguimiento detallado de tus solicitudes</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { 
  BuildingOfficeIcon, 
  InformationCircleIcon, 
  CheckCircleIcon 
} from '@heroicons/vue/24/outline';
import OrganizationCard from '../cards/OrganizationCard.vue';

// Props
const props = defineProps({
  organizations: {
    type: Array,
    default: () => []
  },
  isLoading: {
    type: Boolean,
    default: false
  }
});

// Emits
const emit = defineEmits(['organization-left', 'create-request']);

// Methods
const handleOrganizationLeft = (organizationId) => {
  emit('organization-left', organizationId);
};

const handleCreateRequest = (organizationId) => {
  emit('create-request', organizationId);
};
</script>

