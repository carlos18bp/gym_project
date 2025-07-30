<template>
  <ModalTransition>
    <div v-if="isOpen" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div 
          class="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" 
          @click="closeModal"
        ></div>

        <!-- Modal panel -->
        <div class="inline-block w-full max-w-4xl p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl">
          <!-- Header -->
          <div class="flex items-center justify-between pb-4 mb-6 border-b border-gray-200">
            <div>
              <h3 class="text-lg font-medium leading-6 text-gray-900">
                Gestión de Permisos
              </h3>
              <p class="mt-1 text-sm text-gray-500">
                {{ document?.title || 'Documento' }}
              </p>
            </div>
            <button
              @click="closeModal"
              class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
            >
              <XMarkIcon class="w-6 h-6" />
            </button>
          </div>

          <!-- Permissions Manager Component -->
          <div v-if="canManagePermissions" class="mb-6">
            <DocumentPermissionsManager 
              ref="permissionsManagerRef"
              :document="document"
            />
          </div>

          <!-- Error State -->
          <div v-else class="p-4 mb-6 bg-red-50 border border-red-200 rounded-lg">
            <div class="flex items-center">
              <svg class="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <p class="text-red-700">No tienes permisos para gestionar los permisos de este documento.</p>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              @click="closeModal"
              type="button"
              class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
            >
              {{ canManagePermissions ? 'Cancelar' : 'Cerrar' }}
            </button>
            <button
              v-if="canManagePermissions"
              @click="savePermissions"
              :disabled="isSaving"
              type="button"
              class="px-4 py-2 text-sm font-medium text-white bg-secondary rounded-md hover:bg-secondary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span v-if="isSaving" class="flex items-center">
                <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Guardando...
              </span>
              <span v-else>Guardar Permisos</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </ModalTransition>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { XMarkIcon } from '@heroicons/vue/24/outline';
import ModalTransition from '@/components/layouts/animations/ModalTransition.vue';
import DocumentPermissionsManager from '@/components/dynamic_document/lawyer/document-config/DocumentPermissionsManager.vue';
import { useDynamicDocumentStore } from '@/stores/dynamic_document';
import { useDocumentPermissions } from '@/composables/document-variables/useDocumentPermissions';
import { showNotification } from '@/shared/notification_message';

// Props
const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  document: {
    type: Object,
    default: null
  }
});

// Emits
const emit = defineEmits(['close', 'saved']);

// Store
const store = useDynamicDocumentStore();

// Refs
const permissionsManagerRef = ref(null);
const isSaving = ref(false);

// Use permissions composable - reutilizando toda la lógica existente
const {
  isLawyer
} = useDocumentPermissions();

// Computed
const canManagePermissions = computed(() => {
  return isLawyer.value && props.document?.id;
});

/**
 * Close modal
 */
const closeModal = () => {
  if (!isSaving.value) {
    emit('close');
  }
};

/**
 * Save permissions using store methods
 */
const savePermissions = async () => {
  if (!canManagePermissions.value || isSaving.value) {
    return;
  }

  // Obtener permisos del componente reutilizado
  const currentPermissions = permissionsManagerRef.value?.getPermissionsData();
  if (!currentPermissions) {
    await showNotification('Error al obtener los permisos actuales', 'error');
    return;
  }

  isSaving.value = true;
  
  try {
    const documentId = props.document.id;
    
    // Usar métodos del store para todas las operaciones
    if (typeof currentPermissions.is_public === 'boolean') {
      await store.toggleDocumentPublicAccess(documentId);
    }
    
    if (!currentPermissions.is_public) {
      if (currentPermissions.visibility_user_ids?.length > 0) {
        await store.grantVisibilityPermissions(documentId, currentPermissions.visibility_user_ids);
      }
      
      if (currentPermissions.usability_user_ids?.length > 0) {
        await store.grantUsabilityPermissions(documentId, currentPermissions.usability_user_ids);
      }
    }

    await showNotification('Permisos actualizados exitosamente', 'success');
    emit('saved', props.document);
    closeModal();
    
  } catch (error) {
    console.error('Error saving permissions:', error);
    await showNotification('Error al guardar los permisos', 'error');
  } finally {
    isSaving.value = false;
  }
};
</script> 