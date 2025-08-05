<template>


  <!-- Permissions Management Section (visible only to lawyers) -->
  <div v-if="isLawyer" class="mt-6">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-medium text-primary">Gestión de Permisos</h3>
    </div>

    <!-- Public Access Toggle -->
    <div class="mb-6 p-4 bg-gray-50 rounded-lg border">
      <div class="flex items-center justify-between">
        <div>
          <h4 class="text-sm font-medium text-gray-700">Acceso Público</h4>
          <p class="text-sm text-gray-500 mt-1">
            Si está habilitado, todos los usuarios pueden ver y usar este documento
          </p>
        </div>
        <button
          @click="togglePublicAccess"
          type="button"
          class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2"
          :class="isPublicDocument ? 'bg-secondary' : 'bg-gray-200'"
        >
          <span
            class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
            :class="isPublicDocument ? 'translate-x-5' : 'translate-x-0'"
          ></span>
        </button>
      </div>
    </div>

    <!-- Individual Permissions (only show if not public) -->
    <div v-if="!isPublicDocument" class="space-y-4">
      <!-- Available Clients List -->
      <div v-if="hasAvailableClients">
        <div class="flex items-center justify-between mb-3">
          <h4 class="text-sm font-medium text-gray-700">
            Asignar Permisos a Clientes: 
            <span v-if="clientSearchQuery.trim()" class="text-blue-600">
              ({{ filteredClients.length }} de {{ availableClients.length }} clientes)
            </span>
            <span v-else class="text-gray-500">
              ({{ availableClients.length }} clientes)
            </span>
          </h4>
        </div>

        <!-- Search Bar -->
        <div class="mb-3">
          <div class="relative">
            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg class="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
              </svg>
            </div>
            <input
              v-model="clientSearchQuery"
              type="text"
              placeholder="Buscar por nombre o email..."
              class="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-secondary focus:border-secondary text-sm"
            />
            <div v-if="clientSearchQuery.trim()" class="absolute inset-y-0 right-0 pr-3 flex items-center">
              <button
                @click="clientSearchQuery = ''"
                type="button"
                class="text-gray-400 hover:text-gray-600"
              >
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>
          </div>
        </div>
        
        <div v-if="hasFilteredClients" class="space-y-2 max-h-60 overflow-y-auto border rounded-lg p-3">
          <div
            v-for="client in filteredClients"
            :key="client.id"
            class="flex items-center justify-between p-3 bg-white border rounded-lg hover:bg-gray-50"
          >
            <div class="flex-1">
              <p class="text-sm font-medium text-gray-900">{{ client.full_name }}</p>
              <p class="text-sm text-gray-500">{{ client.email }}</p>
            </div>
            
            <div class="flex items-center space-x-4">
              <!-- Visibility Permission -->
              <div class="flex items-center">
                <input
                  :id="`visibility_${client.id}`"
                  type="checkbox"
                  :checked="hasVisibilityPermission(client)"
                  @change="toggleVisibilityPermission(client)"
                  class="h-4 w-4 text-secondary focus:ring-secondary border-gray-300 rounded"
                />
                <label :for="`visibility_${client.id}`" class="ml-2 text-sm text-gray-600">
                  Ver
                </label>
              </div>
              
              <!-- Usability Permission -->
              <div class="flex items-center">
                <input
                  :id="`usability_${client.id}`"
                  type="checkbox"
                  :checked="hasUsabilityPermission(client)"
                  @change="toggleUsabilityPermission(client)"
                  :disabled="!hasVisibilityPermission(client)"
                  class="h-4 w-4 text-secondary focus:ring-secondary border-gray-300 rounded disabled:bg-gray-100"
                />
                <label :for="`usability_${client.id}`" class="ml-2 text-sm text-gray-600">
                  Usar
                </label>
              </div>
            </div>
          </div>
        </div>

        <!-- No search results message -->
        <div v-else-if="clientSearchQuery.trim() && !hasFilteredClients" class="text-center py-6 border rounded-lg">
          <div class="flex flex-col items-center">
            <svg class="h-12 w-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
            <p class="text-gray-500 font-medium">No se encontraron clientes</p>
            <p class="text-gray-400 text-sm mt-1">
              No hay clientes que coincidan con "{{ clientSearchQuery }}"
            </p>
            <button
              @click="clientSearchQuery = ''"
              type="button"
              class="mt-3 text-sm text-secondary hover:text-secondary-dark underline"
            >
              Limpiar búsqueda
            </button>
          </div>
        </div>
      </div>

      <!-- No clients message -->
      <div v-else-if="!isLoadingClients && !hasAvailableClients" class="text-center py-6">
        <p class="text-gray-500">No hay clientes disponibles.</p>
        <p class="text-gray-400 text-sm mt-1">Los clientes aparecerán aquí cuando estén registrados en el sistema.</p>
      </div>

      <!-- Loading state -->
      <div v-if="isLoadingClients" class="text-center py-6">
        <p class="text-gray-500">Cargando clientes disponibles...</p>
      </div>

      <!-- Permissions Summary -->
      <div v-if="selectedVisibilityUsers.length > 0 || selectedUsabilityUsers.length > 0" class="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h5 class="text-sm font-medium text-blue-800 mb-2">Resumen de Permisos:</h5>
        
        <!-- Visibility Permissions Summary -->
        <div v-if="selectedVisibilityUsers.length > 0" class="mb-2">
          <p class="text-sm text-blue-700">
            <strong>Pueden ver ({{ selectedVisibilityUsers.length }}):</strong>
            {{ selectedVisibilityUsers.map(u => u.full_name).join(', ') }}
          </p>
        </div>
        
        <!-- Usability Permissions Summary -->
        <div v-if="selectedUsabilityUsers.length > 0">
          <p class="text-sm text-blue-700">
            <strong>Pueden usar ({{ selectedUsabilityUsers.length }}):</strong>
            {{ selectedUsabilityUsers.map(u => u.full_name).join(', ') }}
          </p>
        </div>
      </div>
    </div>

    <!-- Public Document Notice -->
    <div v-if="isPublicDocument" class="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
      <div class="flex items-center">
        <svg class="h-5 w-5 text-green-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <p class="text-sm text-green-700">
          <strong>Documento público:</strong> Todos los usuarios registrados pueden ver y usar este documento.
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, defineProps, defineExpose } from 'vue';
import { useDocumentPermissions } from '@/composables/document-variables/useDocumentPermissions';

// Props
const props = defineProps({
  document: {
    type: Object,
    default: null
  }
});

// Use the permissions composable
const {
  // State
  availableClients,
  selectedVisibilityUsers,
  selectedUsabilityUsers,
  isPublicDocument,
  isLoadingClients,
  clientSearchQuery,
  
  // Computed
  isLawyer,
  filteredClients,
  hasAvailableClients,
  hasFilteredClients,
  
  // Methods
  toggleVisibilityPermission,
  toggleUsabilityPermission,
  hasVisibilityPermission,
  hasUsabilityPermission,
  togglePublicAccess,
  getPermissionsData,
  initializePermissions
} = useDocumentPermissions();

// Initialize permissions on mount
onMounted(async () => {
  if (props.document) {
    await initializePermissions(props.document);
  }
});

// Expose methods for parent component
defineExpose({
  getPermissionsData
});
</script> 