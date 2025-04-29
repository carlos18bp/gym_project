<!-- QuickActionButtons.vue -->
<template>
  <div class="w-full">
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <!-- Buttons for lawyers -->
      <template v-if="user?.role === 'lawyer'">
        <router-link 
          :to="{ name: 'process_list', query: { group: 'general' } }" 
          class="flex items-center bg-blue-300/30 rounded-xl px-6 py-4 hover:shadow-md transition border border-blue-300"
        >
          <div class="flex-shrink-0 rounded-full p-3 mr-4">
            <ChevronRightIcon class="size-8 text-blue-500" />
          </div>
          <div class="flex flex-col">
            <span class="font-medium text-primary">Todos los Procesos</span>
            <span class="text-sm text-gray-500">Ver casos activos</span>
          </div>
          <ChevronRightIcon class="w-5 h-5 text-gray-400 ml-auto" />
        </router-link>
        
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
        
        <div 
          @click="showFacturationModal = true"
          class="flex items-center bg-green-300/30 rounded-xl px-6 py-4 hover:shadow-md transition border border-green-300 cursor-pointer"
        >
          <div class="flex-shrink-0 rounded-full p-3 mr-4">
            <PlusIcon class="size-8 text-green-500" />
          </div>
          <div class="flex flex-col">
            <span class="font-medium text-primary">Radicar Informe</span>
            <span class="text-sm text-gray-500">Cuenta de cobro</span>
          </div>
          <ChevronRightIcon class="w-5 h-5 text-gray-400 ml-auto" />
        </div>
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

    <!-- Modal for lawyers to file a report -->
    <ModalTransition v-show="showFacturationModal">
      <FacturationForm @close="showFacturationModal = false" />
    </ModalTransition>
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
import { ref } from 'vue';
import { 
  DocumentIcon, 
  CalendarDaysIcon,
  FolderIcon,
  PlusIcon,
  ChevronRightIcon
} from '@heroicons/vue/24/outline';
import ModalTransition from '@/components/layouts/animations/ModalTransition.vue';
import FacturationForm from '@/views/intranet_g_y_m/FacturationForm.vue';

// Modal state
const showFacturationModal = ref(false);

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
