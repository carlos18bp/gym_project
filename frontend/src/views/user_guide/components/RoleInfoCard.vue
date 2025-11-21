<template>
  <div class="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-200 rounded-lg p-6">
    <div class="flex items-center space-x-3 mb-4">
      <UserCircleIcon class="h-8 w-8 text-indigo-600" />
      <div>
        <h3 class="text-lg font-semibold text-gray-900">Tu Rol</h3>
        <p class="text-sm text-gray-600">{{ getRoleName(role) }}</p>
      </div>
    </div>
    
    <p class="text-sm text-gray-700 mb-4">
      {{ getRoleDescription(role) }}
    </p>

    <div class="space-y-2">
      <div class="flex items-center space-x-2 text-sm">
        <CheckCircleIcon class="h-5 w-5 text-green-500" />
        <span class="text-gray-700">{{ getModuleCount(role) }} módulos disponibles</span>
      </div>
      <div class="flex items-center space-x-2 text-sm">
        <CheckCircleIcon class="h-5 w-5 text-green-500" />
        <span class="text-gray-700">Acceso a funcionalidades {{ getAccessLevel(role) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { UserCircleIcon, CheckCircleIcon } from '@heroicons/vue/24/outline';
import { useUserGuideStore } from '@/stores/user_guide';

const props = defineProps({
  role: {
    type: String,
    required: true
  }
});

const guideStore = useUserGuideStore();

const getRoleName = (role) => {
  const names = {
    lawyer: 'Abogado',
    client: 'Cliente',
    corporate_client: 'Cliente Corporativo',
    basic: 'Usuario Básico'
  };
  return names[role] || role;
};

const getRoleDescription = (role) => {
  const descriptions = {
    lawyer: 'Como abogado, tienes acceso completo a todas las funcionalidades de gestión de procesos, clientes y documentos jurídicos.',
    client: 'Como cliente, puedes consultar tus procesos, solicitar servicios legales y gestionar documentos asignados.',
    corporate_client: 'Como cliente corporativo, además de las funciones de cliente regular, puedes gestionar organizaciones y sus miembros.',
    basic: 'Como usuario básico, tienes acceso a funcionalidades esenciales para consultar información y realizar solicitudes.'
  };
  return descriptions[role] || '';
};

const getModuleCount = (role) => {
  const modules = guideStore.getModulesForRole(role);
  return modules.length;
};

const getAccessLevel = (role) => {
  const levels = {
    lawyer: 'completas',
    client: 'estándar',
    corporate_client: 'avanzadas',
    basic: 'básicas'
  };
  return levels[role] || 'limitadas';
};
</script>
