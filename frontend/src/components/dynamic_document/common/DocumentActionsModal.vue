<template>
  <ModalTransition v-show="isVisible">
    <div class="w-full h-full flex items-center justify-center p-4" @click.self="close">
    <div class="relative bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
      <!-- Modal header -->
      <div class="px-6 py-4 border-b border-gray-200">
        <h2 class="text-xl font-semibold text-gray-800">Acciones del Documento</h2>
        <p class="text-sm text-gray-500 mt-1">
          {{ document?.title || 'Cargando...' }}
        </p>
        <button 
          @click="close" 
          class="absolute top-4 right-4 text-gray-400 hover:text-gray-500 transition-colors"
        >
          <XMarkIcon class="h-6 w-6" />
        </button>
      </div>
      
      <!-- Modal body -->
      <div class="p-6 overflow-y-auto flex-grow">
        <div class="space-y-4">
          <!-- Group actions by category -->
          <div v-for="(group, groupIndex) in organizedOptions" :key="groupIndex" class="space-y-2">
            <!-- Group title if exists -->
            <h3 v-if="group.title" class="text-sm font-semibold text-gray-700 uppercase tracking-wide px-2">
              {{ group.title }}
            </h3>
            
            <!-- Action buttons grid -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div
                v-for="option in group.options"
                :key="option.action"
                class="relative group"
              >
                <button
                  @click="handleAction(option.action)"
                  :disabled="option.disabled"
                  :class="[
                    'flex items-center justify-start w-full px-4 py-3 rounded-lg border transition-all duration-200',
                    option.disabled 
                      ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed opacity-60' 
                      : getButtonClasses(option.action),
                    'hover:shadow-md hover:scale-[1.02]'
                  ]"
                >
                  <!-- Icon -->
                  <component 
                    :is="getIcon(option.action)" 
                    class="h-5 w-5 mr-3 flex-shrink-0"
                    :class="option.disabled ? 'text-gray-400' : getIconColor(option.action)"
                  />
                  
                  <!-- Label -->
                  <span class="text-sm font-medium">{{ option.label }}</span>
                  
                  <!-- Disabled indicator -->
                  <NoSymbolIcon 
                    v-if="option.disabled" 
                    class="h-4 w-4 ml-auto text-gray-400"
                  />
                </button>

                <!-- Tooltip for relationships disabled due to document state (Progress) -->
                <div
                  v-if="option.disabled && option.action === 'relationships' && !isBasicUser && document?.state === 'Progress'"
                  class="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 max-w-xs w-max"
                >
                  Solo puedes administrar asociaciones cuando el documento está completado.
                  <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-b-gray-900"></div>
                </div>

                <!-- Tooltip for relationships disabled because there are no associations -->
                <div
                  v-else-if="option.disabled && option.action === 'relationships' && !isBasicUser"
                  class="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 max-w-xs w-max"
                >
                  Este documento no tiene documentos asociados.
                  <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-b-gray-900"></div>
                </div>

                <!-- Tooltip for formalize disabled due to document state -->
                <div
                  v-else-if="option.disabled && option.action === 'formalize' && document?.state !== 'Completed'"
                  class="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 max-w-xs w-max"
                >
                  Solo puedes formalizar y agregar firmas cuando el documento está completado.
                  <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-b-gray-900"></div>
                </div>

                <!-- Tooltip for download/share disabled due to document state -->
                <div
                  v-else-if="option.disabled && ['downloadPDF', 'downloadWord', 'email'].includes(option.action) && document?.state !== 'Completed'"
                  class="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 max-w-xs w-max"
                >
                  Solo puedes usar esta acción cuando el documento está completado.
                  <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-b-gray-900"></div>
                </div>

                <!-- Tooltip for restricted actions (Basic users) -->
                <div
                  v-else-if="option.disabled && isBasicUser && isRestrictedAction(option.action)"
                  class="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 max-w-xs w-max"
                >
                  Actualiza tu suscripción para usar esta funcionalidad
                  <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-b-gray-900"></div>
                </div>
              </div>
            </div>
            
            <!-- Divider between groups -->
            <div v-if="groupIndex < organizedOptions.length - 1" class="border-t border-gray-200 my-4"></div>
          </div>
          
          <!-- Empty state -->
          <div v-if="organizedOptions.length === 0" class="text-center py-12">
            <DocumentIcon class="mx-auto h-12 w-12 text-gray-400" />
            <h3 class="mt-2 text-sm font-medium text-gray-900">No hay acciones disponibles</h3>
            <p class="mt-1 text-sm text-gray-500">
              No hay opciones disponibles para este documento.
            </p>
          </div>
        </div>
      </div>
    </div>
    </div>
  </ModalTransition>
</template>

<script setup>
import { computed } from 'vue';
import ModalTransition from '@/components/layouts/animations/ModalTransition.vue';
import { useBasicUserRestrictions } from '@/composables/useBasicUserRestrictions';
import {
  XMarkIcon,
  DocumentIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  DocumentDuplicateIcon,
  PaperClipIcon,
  EnvelopeIcon,
  ArrowDownTrayIcon,
  UserGroupIcon,
  LockClosedIcon,
  LinkIcon,
  CheckCircleIcon,
  PencilSquareIcon,
  NoSymbolIcon,
  DocumentTextIcon,
  PhotoIcon,
  ShareIcon,
  XCircleIcon,
  HandThumbDownIcon
} from '@heroicons/vue/24/outline';
import { getMenuOptionsForCardType } from '@/components/dynamic_document/cards/menuOptionsHelper.js';

const props = defineProps({
  isVisible: {
    type: Boolean,
    default: false
  },
  document: {
    type: Object,
    default: null
  },
  cardType: {
    type: String,
    required: true,
    validator: (value) => ['lawyer', 'client', 'signatures'].includes(value)
  },
  context: {
    type: String,
    default: 'table'
  },
  userStore: {
    type: Object,
    default: null
  }
});

const emit = defineEmits(['close', 'action']);

// Get menu options for the document
const menuOptions = computed(() => {
  if (!props.document) return [];
  return getMenuOptionsForCardType(
    props.cardType,
    props.document,
    props.context,
    props.userStore
  );
});

// Organize options into groups
const organizedOptions = computed(() => {
  const options = menuOptions.value;
  if (!options || options.length === 0) return [];
  
  const groups = [];
  
  // Define action categories
  const categories = {
    edit: 'Edición',
    view: 'Visualización',
    share: 'Compartir',
    manage: 'Gestión',
    signatures: 'Firmas',
    delete: 'Eliminación'
  };
  
  // Categorize actions (flatten submenus)
  const categorized = {
    edit: [],
    view: [],
    share: [],
    manage: [],
    signatures: [],
    delete: []
  };
  
  options.forEach(option => {
    // Handle submenus (like edit-submenu with children)
    if (option.children && Array.isArray(option.children)) {
      option.children.forEach(child => {
        const action = child.action.toLowerCase();
        categorizeAction(child, action, categorized);
      });
    } else {
      const action = option.action.toLowerCase();
      categorizeAction(option, action, categorized);
    }
  });
  
  // Build groups
  if (categorized.edit.length > 0) {
    groups.push({ title: categories.edit, options: categorized.edit });
  }
  if (categorized.view.length > 0) {
    groups.push({ title: categories.view, options: categorized.view });
  }
  if (categorized.share.length > 0) {
    groups.push({ title: categories.share, options: categorized.share });
  }
  if (categorized.signatures.length > 0) {
    groups.push({ title: categories.signatures, options: categorized.signatures });
  }
  if (categorized.manage.length > 0) {
    groups.push({ title: categories.manage, options: categorized.manage });
  }
  if (categorized.delete.length > 0) {
    groups.push({ title: categories.delete, options: categorized.delete });
  }
  
  return groups;
});

// Helper function to categorize an action
const categorizeAction = (option, action, categorized) => {
  if (action.includes('edit') || action.includes('editar') || action === 'copy' || action === 'draft' || action === 'publish' || action === 'completar') {
    categorized.edit.push(option);
  } else if (action.includes('signature') || action.includes('firma') || action.includes('sign') || action === 'reject') {
    // Todas las acciones relacionadas con firmas (incluido rechazo) van al grupo "Firmas"
    categorized.signatures.push(option);
  } else if (action.includes('view') || action.includes('preview') || action.includes('ver') || action.includes('previsualización')) {
    categorized.view.push(option);
  } else if (action.includes('download') || action.includes('email') || action.includes('enviar') || action.includes('descargar')) {
    categorized.share.push(option);
  } else if (action.includes('permission') || action.includes('relationship') || action.includes('letterhead') || action.includes('permiso') || action.includes('asociación') || action.includes('membrete') || action === 'formalize') {
    categorized.manage.push(option);
  } else if (action.includes('delete') || action.includes('eliminar')) {
    categorized.delete.push(option);
  } else {
    // Default to manage
    categorized.manage.push(option);
  }
};

// Get icon for action
const getIcon = (action) => {
  const actionLower = action.toLowerCase();
  
  // Specific icon for signing action
  if (actionLower === 'sign' || actionLower.includes('firmar')) {
    return CheckCircleIcon;
  }

  if (actionLower === 'editform' || actionLower.includes('completar')) {
    return PencilSquareIcon;
  } else if (actionLower === 'editdocument' || actionLower.includes('editar documento')) {
    return PencilIcon;
  } else if (actionLower.includes('edit') || actionLower === 'editar') {
    return PencilIcon;
  } else if (actionLower.includes('delete') || actionLower === 'eliminar') {
    return TrashIcon;
  } else if (actionLower.includes('preview') || actionLower.includes('ver') || actionLower.includes('previsualización')) {
    return EyeIcon;
  } else if (actionLower === 'copy' || actionLower.includes('copia')) {
    return DocumentDuplicateIcon;
  } else if (actionLower.includes('download') || actionLower.includes('descargar')) {
    return ArrowDownTrayIcon;
  } else if (actionLower.includes('email') || actionLower.includes('enviar')) {
    return EnvelopeIcon;
  } else if (actionLower.includes('permission') || actionLower.includes('permiso')) {
    return LockClosedIcon;
  } else if (actionLower.includes('relationship') || actionLower.includes('asociación')) {
    return LinkIcon;
  } else if (actionLower.includes('letterhead') || actionLower.includes('membrete')) {
    return PhotoIcon;
  } else if (actionLower === 'reject' || actionLower.includes('rechazar')) {
    return XCircleIcon;
  } else if (actionLower.includes('signature') || actionLower.includes('firma')) {
    return CheckCircleIcon;
  } else if (actionLower === 'publish' || actionLower.includes('publicar')) {
    return ShareIcon;
  } else if (actionLower === 'draft' || actionLower.includes('borrador')) {
    return DocumentTextIcon;
  } else if (actionLower === 'formalize' || actionLower.includes('formalizar')) {
    return PencilSquareIcon;
  }
  
  return DocumentIcon;
};

// Get icon color
const getIconColor = (action) => {
  const actionLower = action.toLowerCase();
  
  if (actionLower.includes('delete') || actionLower === 'eliminar') {
    return 'text-red-600';
  } else if (actionLower === 'reject' || actionLower.includes('rechazar')) {
    return 'text-red-600';
  } else if (actionLower === 'sign' || actionLower.includes('firmar')) {
    return 'text-green-600';
  } else if (actionLower.includes('download') || actionLower.includes('descargar')) {
    return 'text-blue-600';
  } else if (actionLower.includes('email') || actionLower.includes('enviar')) {
    return 'text-green-600';
  } else if (actionLower.includes('signature') || actionLower.includes('firma')) {
    return 'text-purple-600';
  }
  
  return 'text-gray-600';
};

// Get button classes based on action type
const getButtonClasses = (action) => {
  const actionLower = action.toLowerCase();
  
  if (actionLower.includes('delete') || actionLower === 'eliminar') {
    return 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:border-red-300';
  } else if (actionLower === 'reject' || actionLower.includes('rechazar')) {
    return 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:border-red-300';
  } else if (actionLower === 'sign' || actionLower.includes('firmar')) {
    return 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100 hover:border-green-300';
  } else if (actionLower.includes('download') || actionLower.includes('descargar')) {
    return 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:border-blue-300';
  } else if (actionLower.includes('email') || actionLower.includes('enviar')) {
    return 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100 hover:border-green-300';
  } else if (actionLower.includes('signature') || actionLower.includes('firma')) {
    return 'border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 hover:border-purple-300';
  }
  
  return 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300';
};

// Basic user restrictions
const { isBasicUser, handleFeatureAccess } = useBasicUserRestrictions();

const restrictedActionsForBasic = ['formalize', 'letterhead', 'relationships', 'downloadWord', 'email'];

const isRestrictedAction = (action) => {
  const actionLower = action.toLowerCase();
  return restrictedActionsForBasic.some(key => actionLower === key.toLowerCase());
};

// Handle action click
const handleAction = (action) => {
  // Find the option to check if it's disabled
  const option = menuOptions.value.find(opt => {
    if (opt.action === action) return opt;
    if (opt.children) {
      return opt.children.find(child => child.action === action);
    }
    return null;
  });
  
  const actualOption = option?.children ? option.children.find(child => child.action === action) : option;
  
  // If option is disabled, show restriction notification
  if (actualOption?.disabled) {
    handleFeatureAccess('Esta funcionalidad', null);
    return;
  }
  
  emit('action', action, props.document);
};

// Close modal
const close = () => {
  emit('close');
};
</script>

