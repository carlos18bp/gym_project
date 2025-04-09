<!-- QuickActionButtons.vue -->
<template>
  <div class="w-full">
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <!-- Buttons for lawyers -->
      <template v-if="user?.role === 'lawyer'">
        <router-link 
          :to="{ name: 'process_form', params: { action: 'create' } }" 
          class="flex items-center bg-terciary rounded-xl px-6 py-4 hover:shadow-md transition border border-stroke"
        >
          <div class="flex-shrink-0 rounded-full p-3 mr-4">
            <PlusIcon class="size-8 text-secondary" />
          </div>
          <div class="flex flex-col">
            <span class="font-medium text-primary">Radicar Proceso</span>
            <span class="text-sm text-gray-500">Nuevo caso</span>
          </div>
          <ChevronRightIcon class="w-5 h-5 text-gray-400 ml-auto" />
        </router-link>
        
        <router-link 
          :to="{ name: 'dynamic_document_dashboard' }" 
          class="flex items-center bg-yellow-300/30 rounded-xl px-6 py-4 hover:shadow-md transition border border-yellow-300"
        >
          <div class="flex-shrink-0 rounded-full p-3 mr-4">
            <PlusIcon class="size-8 text-yellow-500" />
          </div>
          <div class="flex flex-col">
            <span class="font-medium text-primary">Nuevo Documento</span>
            <span class="text-sm text-gray-500">Contrato o formato jurídico</span>
          </div>
          <ChevronRightIcon class="w-5 h-5 text-gray-400 ml-auto" />
        </router-link>
        
        <router-link 
          :to="{ name: 'legal_request' }" 
          class="flex items-center bg-green-300/30 rounded-xl px-6 py-4 hover:shadow-md transition border border-green-300"
        >
          <div class="flex-shrink-0 rounded-full p-3 mr-4">
            <PlusIcon class="size-8 text-green-500" />
          </div>
          <div class="flex flex-col">
            <span class="font-medium text-primary">Radicar Informe</span>
            <span class="text-sm text-gray-500">Cuenta de cobro</span>
          </div>
          <ChevronRightIcon class="w-5 h-5 text-gray-400 ml-auto" />
        </router-link>
      </template>
      
      <!-- Buttons for clients -->
      <template v-else-if="user?.role === 'client'">
        <router-link 
          :to="{ name: 'process_list' }" 
          class="flex items-center bg-terciary rounded-xl px-6 py-4 hover:shadow-md transition border border-stroke"
        >
          <div class="flex-shrink-0 rounded-full p-3 mr-4">
            <FolderIcon class="size-8 text-secondary" />
          </div>
          <div class="flex flex-col">
            <span class="font-medium text-primary">Mis Procesos</span>
            <span class="text-sm text-gray-500">Ver estado de casos</span>
          </div>
          <ChevronRightIcon class="w-5 h-5 text-gray-400 ml-auto" />
        </router-link>
        
        <router-link 
          :to="{ name: 'schedule_appointment' }" 
          class="flex items-center bg-yellow-300/30 rounded-xl px-6 py-4 hover:shadow-md transition border border-yellow-300"
        >
          <div class="flex-shrink-0 rounded-full p-3 mr-4">
            <CalendarDaysIcon class="size-8 text-yellow-500" />
          </div>
          <div class="flex flex-col">
            <span class="font-medium text-primary">Agendar Cita</span>
            <span class="text-sm text-gray-500">Asesoría jurídica</span>
          </div>
          <ChevronRightIcon class="w-5 h-5 text-gray-400 ml-auto" />
        </router-link>
        
        <router-link 
          :to="{ name: 'legal_request' }" 
          class="flex items-center bg-green-300/30 rounded-xl px-6 py-4 hover:shadow-md transition border border-green-300"
        >
          <div class="flex-shrink-0 rounded-full p-3 mr-4">
            <PlusIcon class="size-8 text-green-500" />
          </div>
          <div class="flex flex-col">
            <span class="font-medium text-primary">Radicar Solicitud</span>
            <span class="text-sm text-gray-500">Consulta jurídica</span>
          </div>
          <ChevronRightIcon class="w-5 h-5 text-gray-400 ml-auto" />
        </router-link>
      </template>
    </div>
  </div>
</template>

<script setup>
/**
 * Quick action buttons component
 * 
 * Displays different quick action buttons based on the user's role.
 * For lawyers: File Process, New Document, File Report
 * For clients: My Processes, Schedule Appointment, File Request
 */
import { defineProps } from 'vue';
import { 
  DocumentIcon, 
  CalendarDaysIcon,
  FolderIcon,
  PlusIcon,
  ChevronRightIcon
} from '@heroicons/vue/24/outline';

// Props for customization
const props = defineProps({
  /**
   * User object containing user information
   */
  user: {
    type: Object,
    default: () => ({})
  }
});
</script>
