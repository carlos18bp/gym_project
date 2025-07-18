<template>
  <div
    :data-document-id="document.id"
    class="relative bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 p-4 cursor-pointer focus:outline-none focus:ring-0"
    :class="[
      cardClasses,
      highlightClasses,
      additionalClasses
    ]"
    @click="handleCardClick"
  >
    <!-- Header with status and menu/action -->
    <div class="flex justify-between items-start mb-3">
      <div class="flex items-center gap-2">
        <!-- Status Badge -->
        <slot name="status-badge">
          <div 
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
            :class="statusBadgeClasses"
          >
            <component
              :is="statusIcon"
              class="w-3.5 h-3.5"
            />
            <span>{{ statusText }}</span>
          </div>
        </slot>

        <!-- Additional badges slot -->
        <slot name="additional-badges"></slot>
      </div>
      
      <!-- Right action slot (menu or arrow) -->
      <slot name="right-action">
        <Menu as="div" class="relative inline-block text-left menu-container" v-if="menuOptions && menuOptions.length > 0">
          <MenuButton class="flex items-center justify-center w-8 h-8 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors focus:outline-none focus:ring-0">
            <EllipsisVerticalIcon class="w-5 h-5" aria-hidden="true" />
          </MenuButton>
          <transition
            enter-active-class="transition ease-out duration-100"
            enter-from-class="transform opacity-0 scale-95"
            enter-to-class="transform opacity-100 scale-100"
            leave-active-class="transition ease-in duration-75"
            leave-from-class="transform opacity-100 scale-100"
            leave-to-class="transform opacity-0 scale-95"
          >
            <MenuItems
              class="absolute z-50 mt-2 w-56 rounded-md bg-white shadow-lg ring-1 ring-black/5 focus:outline-none"
              :class="menuPosition"
            >
              <div class="py-1">
                <MenuItem
                  v-for="option in menuOptions"
                  :key="option.label"
                >
                  <button
                    class="block w-full text-left px-4 py-2 text-sm font-regular hover:bg-gray-100 transition focus:outline-none focus:ring-0"
                    :disabled="option.disabled"
                    @click="handleMenuAction(option.action, document)"
                    :class="{
                      'opacity-50 cursor-not-allowed': option.disabled,
                      'cursor-pointer': !option.disabled,
                    }"
                  >
                    <NoSymbolIcon
                      v-if="option.disabled"
                      class="size-5 text-gray-400 inline mr-2"
                      aria-hidden="true"
                    />
                    {{ option.label }}
                  </button>
                </MenuItem>
              </div>
            </MenuItems>
          </transition>
        </Menu>
      </slot>
    </div>

    <!-- Document Content -->
    <div class="space-y-2">
      <!-- Title -->
      <h3 class="text-lg font-semibold text-gray-900 leading-tight">
        {{ document.title }}
      </h3>
      
      <!-- Description -->
      <p v-if="document.description" class="text-sm text-gray-600 leading-relaxed">
        {{ document.description }}
      </p>

      <!-- Additional content slot -->
      <slot name="additional-content"></slot>
      
      <!-- Tags Section -->
      <div v-if="showTags && document.tags && document.tags.length > 0" class="pt-2">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-xs font-medium text-gray-500">Etiquetas:</span>
          <div class="flex items-center gap-1.5">
            <div 
              v-for="tag in document.tags" 
              :key="tag.id"
              class="group relative"
            >
              <div 
                class="w-5 h-5 rounded-full cursor-pointer transition-all duration-200 hover:scale-110 hover:ring-2 hover:ring-offset-1 shadow-sm"
                :style="{ 
                  backgroundColor: getColorById(tag.color_id)?.hex || '#9CA3AF',
                  boxShadow: `0 0 0 1px ${getColorById(tag.color_id)?.dark || '#6B7280'}40`
                }"
                :title="tag.name"
              ></div>
              
              <!-- Tooltip -->
              <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-50">
                <div class="bg-gray-900 text-white text-xs rounded-lg py-1.5 px-2.5 whitespace-nowrap shadow-lg">
                  {{ tag.name }}
                  <div class="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[4px] border-r-[4px] border-t-[4px] border-transparent border-t-gray-900"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer slot -->
    <slot name="footer"></slot>

    <!-- Additional actions slot - positioned absolutely on top -->
    <slot name="additional-actions"></slot>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/vue";
import { 
  EllipsisVerticalIcon, 
  NoSymbolIcon, 
  CheckCircleIcon, 
  PencilIcon 
} from "@heroicons/vue/24/outline";
import { getColorById } from "@/shared/color_palette";
import { showNotification } from "@/shared/notification_message";
import { showConfirmationAlert } from "@/shared/confirmation_alert";

const props = defineProps({
  document: {
    type: Object,
    required: true
  },
  cardType: {
    type: String,
    default: 'default', // 'client', 'lawyer', 'signatures', 'useDocument', etc.
  },
  cardContext: {
    type: String,
    default: 'list' // 'list', 'folder', 'finished', 'progress'
  },
  highlightedDocId: {
    type: [String, Number],
    default: null
  },
  showTags: {
    type: Boolean,
    default: true
  },
  additionalClasses: {
    type: [String, Array, Object],
    default: ''
  },
  // Props para override manual de status (opcional)
  statusIcon: {
    type: [String, Object, Function],
    default: null
  },
  statusText: {
    type: String,
    default: null
  },
  statusBadgeClasses: {
    type: [String, Object, Array],
    default: null
  },
  // Stores para ejecutar acciones
  documentStore: {
    type: Object,
    default: null
  },
  userStore: {
    type: Object,
    default: null
  },
  // Props específicos para contextos especiales
  promptDocuments: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits([
  'click', 
  'preview', 
  'edit', 
  'refresh', 
  'remove-from-folder',
  'email',
  'copy',
  'formalize',
  'view-signatures',
  'sign'
]);

// Computed classes for card styling based on document state
const cardClasses = computed(() => {
  const state = props.document.state;
  
  switch (state) {
    case 'Completed':
    case 'Published':
    case 'FullySigned':
      return 'border-green-400 bg-green-50/50 shadow-green-100';
    case 'Progress':
    case 'Draft':
      return 'border-blue-300 bg-blue-50/30 shadow-blue-100';
    case 'PendingSignatures':
      return 'border-yellow-400 bg-yellow-50/50 shadow-yellow-100';
    default:
      return 'border-gray-200 bg-white';
  }
});

// Computed classes for highlight animation
const highlightClasses = computed(() => {
  if (!props.highlightedDocId || String(props.document.id) !== String(props.highlightedDocId)) {
    return '';
  }
  
  const state = props.document.state;
  if (state === 'Published' || state === 'FullySigned' || state === 'Completed') {
    return 'shadow-lg animate-pulse-highlight-green';
  } else if (state === 'PendingSignatures') {
    return 'shadow-lg animate-pulse-highlight-yellow';
  } else {
    return 'shadow-lg animate-pulse-highlight-blue';
  }
});

// Handle card click, avoiding menu clicks
const handleCardClick = (e) => {
  if (!e.target.closest('.menu-container')) {
    emit('click', props.document, e);
  }
};

// ===== CONFIGURACIÓN DE TIPOS DE CARD =====
const cardConfigs = {
  client: {
    getMenuOptions: (document, context) => {
      const options = [];
      
      // Edit/Complete option
      options.push({
        label: document.state === "Completed" ? "Editar" : "Completar",
        action: "edit"
      });

      // Preview option for completed documents
      if (document.state === 'Completed') {
        options.push({
          label: "Previsualizar",
          action: "preview"
        });
      }

      // Delete option
      options.push({
        label: "Eliminar",
        action: "delete"
      });

      // Options only for Completed state
      if (document.state === 'Completed') {
        options.push(
          {
            label: "Descargar PDF",
            action: "downloadPDF"
          },
          {
            label: "Descargar Word",
            action: "downloadWord"
          },
          {
            label: "Enviar",
            action: "email"
          }
        );
      }

      return options;
    }
  },
  
  lawyer: {
    getMenuOptions: (document, context) => {
      const baseOptions = [
        { label: "Editar", action: "edit" },
        { label: "Eliminar", action: "delete" },
        { label: "Previsualización", action: "preview" },
        { label: "Crear una Copia", action: "copy" },
      ];
      
      // Add state-based options
      if (document.state === "Draft") {
        baseOptions.push({
          label: "Publicar",
          action: "publish",
          disabled: !canPublishDocument(document),
        });
      } else if (document.state === "Published") {
        baseOptions.push({
          label: "Mover a Borrador",
          action: "draft",
        });
        
        baseOptions.push({
          label: "Formalizar y Agregar Firmas",
          action: "formalize",
        });
      }

      // Add common actions for completed documents
      if (document.state === 'Completed' || document.state === 'Published') {
        baseOptions.push(
          { label: "Descargar PDF", action: "downloadPDF" },
          { label: "Descargar Word", action: "downloadWord" },
          { label: "Enviar por Email", action: "email" }
        );
      }

      // Add signature-related options
      if (document.requires_signature) {
        baseOptions.push({
          label: "Ver Firmas",
          action: "viewSignatures"
        });
      }

      return baseOptions;
    }
  },

  signatures: {
    getMenuOptions: (document, context) => {
      return [
        { label: "Ver", action: "preview" },
        { label: "Firmar", action: "sign" },
        { label: "Descargar PDF", action: "downloadPDF" }
      ];
    }
  },

  folder: {
    getMenuOptions: (document, context) => {
      const options = [
        { label: "Editar", action: "edit" },
        { label: "Ver", action: "preview" },
        { label: "Descargar PDF", action: "downloadPDF" },
        { label: "Duplicar", action: "copy" }
      ];

      // Add remove from folder option
      options.push({
        label: "Quitar de Carpeta",
        action: "removeFromFolder"
      });

      if (document.requires_signature) {
        options.push({
          label: "Ver Firmas",
          action: "viewSignatures"
        });
      }

      return options;
    }
  }
};

// ===== COMPUTED PROPERTIES =====
const menuOptions = computed(() => {
  const config = cardConfigs[props.cardType];
  if (!config) return [];
  
  return config.getMenuOptions(props.document, props.cardContext);
});

const menuPosition = computed(() => {
  // Position logic based on context
  if (props.promptDocuments) {
    return 'right-auto left-0 -translate-x-[calc(100%-24px)]';
  }
  return 'left-0 right-auto';
});

// Computed status properties - use props if provided, otherwise derive from document
const statusIcon = computed(() => {
  if (props.statusIcon) return props.statusIcon;
  
  // Default icon logic based on document state
  const state = props.document.state;
  switch (state) {
    case 'Published':
    case 'FullySigned':
    case 'Completed':
      return CheckCircleIcon;
    case 'Draft':
    case 'Progress':
    case 'PendingSignatures':
    default:
      return PencilIcon;
  }
});

const statusText = computed(() => {
  if (props.statusText) return props.statusText;
  
  // Default text logic based on document state
  const state = props.document.state;
  switch (state) {
    case 'Published':
      return 'Publicado';
    case 'Draft':
      return 'Borrador';
    case 'Progress':
      return 'En progreso';
    case 'Completed':
      return 'Completado';
    case 'PendingSignatures':
      return 'Pendiente de firmas';
    case 'FullySigned':
      return 'Completamente firmado';
    default:
      return 'Desconocido';
  }
});

const statusBadgeClasses = computed(() => {
  if (props.statusBadgeClasses) return props.statusBadgeClasses;
  
  // Default classes logic based on document state
  const state = props.document.state;
  switch (state) {
    case 'Published':
    case 'FullySigned':
    case 'Completed':
      return 'bg-green-100 text-green-700 border border-green-200';
    case 'Draft':
    case 'Progress':
      return 'bg-blue-100 text-blue-700 border border-blue-200';
    case 'PendingSignatures':
      return 'bg-yellow-100 text-yellow-700 border border-yellow-200';
    default:
      return 'bg-gray-100 text-gray-700 border border-gray-200';
  }
});

// ===== ACTION HANDLERS =====

/**
 * Centralized menu action handler
 */
const handleMenuAction = async (action, document) => {
  try {
    switch (action) {
      case "edit":
        emit('edit', document);
        break;
        
      case "preview":
        emit('preview', document);
        break;
        
      case "delete":
        await deleteDocument(document);
        break;
        
      case "downloadPDF":
        await downloadPDFDocument(document);
        break;
        
      case "downloadWord":
        await downloadWordDocument(document);
        break;
        
      case "email":
        await sendEmailDocument(document);
        break;
        
      case "copy":
        await copyDocument(document);
        break;
        
      case "publish":
        await publishDocument(document);
        break;
        
      case "draft":
        await moveToDraft(document);
        break;
        
      case "formalize":
        await formalizeDocument(document);
        break;
        
      case "viewSignatures":
        await viewSignatures(document);
        break;
        
      case "sign":
        await signDocument(document);
        break;
        
      case "removeFromFolder":
        emit('remove-from-folder', document);
        break;
        
      default:
        console.warn("Unknown action:", action);
    }
  } catch (error) {
    console.error(`Error executing action ${action}:`, error);
    await showNotification(`Error al ejecutar la acción: ${error.message}`, 'error');
  }
};

/**
 * Delete document
 */
const deleteDocument = async (document) => {
  const confirmed = await showConfirmationAlert(
    'Confirmar eliminación',
    `¿Estás seguro de que deseas eliminar el documento "${document.title}"?`,
    'Eliminar',
    'Cancelar'
  );

  if (confirmed && props.documentStore) {
    try {
      await props.documentStore.deleteDocument(document.id);
      await showNotification('Documento eliminado exitosamente', 'success');
      emit('refresh');
    } catch (error) {
      await showNotification('Error al eliminar el documento', 'error');
      throw error;
    }
  }
};

/**
 * Download PDF document
 */
const downloadPDFDocument = async (document) => {
  if (!props.documentStore) return;
  
  try {
    await props.documentStore.downloadPDF(document.id, document.title);
    await showNotification('PDF descargado exitosamente', 'success');
  } catch (error) {
    await showNotification('Error al descargar el PDF', 'error');
    throw error;
  }
};

/**
 * Download Word document
 */
const downloadWordDocument = async (document) => {
  if (!props.documentStore) return;
  
  try {
    await props.documentStore.downloadWord(document.id, document.title);
    await showNotification('Documento Word descargado exitosamente', 'success');
  } catch (error) {
    await showNotification('Error al descargar el documento Word', 'error');
    throw error;
  }
};

/**
 * Send document via email
 */
const sendEmailDocument = async (document) => {
  // Emit event to parent to handle email modal
  emit('email', document);
};

/**
 * Copy document - emit event since this functionality may not be available in all stores
 */
const copyDocument = async (document) => {
  // Emit event to parent to handle copy/duplicate functionality
  emit('copy', document);
};

/**
 * Publish document
 */
const publishDocument = async (document) => {
  if (!props.documentStore) return;
  
  try {
    await props.documentStore.publishDocument(document.id);
    await showNotification('Documento publicado exitosamente', 'success');
    emit('refresh');
  } catch (error) {
    await showNotification('Error al publicar el documento', 'error');
    throw error;
  }
};

/**
 * Move document to draft
 */
const moveToDraft = async (document) => {
  if (!props.documentStore) return;
  
  try {
    await props.documentStore.moveToDraft(document.id);
    await showNotification('Documento movido a borrador exitosamente', 'success');
    emit('refresh');
  } catch (error) {
    await showNotification('Error al mover el documento a borrador', 'error');
    throw error;
  }
};

/**
 * Formalize document with signatures
 */
const formalizeDocument = async (document) => {
  // Emit event to parent to handle formalization modal
  emit('formalize', document);
};

/**
 * View document signatures
 */
const viewSignatures = async (document) => {
  // Emit event to parent to handle signatures modal
  emit('view-signatures', document);
};

/**
 * Sign document
 */
const signDocument = async (document) => {
  // Emit event to parent to handle signing
  emit('sign', document);
};

/**
 * Check if document can be published
 */
const canPublishDocument = (document) => {
  // Add your validation logic here
  return document.title && document.title.trim().length > 0;
};



</script>

<style scoped>
@keyframes pulse-highlight-green {
  0% {
    box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.6);
    border-color: rgb(74, 222, 128);
    background-color: rgba(34, 197, 94, 0.03);
    transform: scale(1);
  }
  50% {
    box-shadow: 0 0 10px 5px rgba(34, 197, 94, 0.4);
    border-color: rgb(74, 222, 128);
    background-color: rgba(34, 197, 94, 0.1);
    transform: scale(1.02);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.6);
    border-color: rgb(74, 222, 128);
    background-color: rgba(34, 197, 94, 0.03);
    transform: scale(1);
  }
}

@keyframes pulse-highlight-blue {
  0% {
    box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.6);
    border-color: rgb(147, 197, 253);
    background-color: rgba(59, 130, 246, 0.019);
    transform: scale(1);
  }
  50% {
    box-shadow: 0 0 10px 5px rgba(59, 130, 246, 0.4);
    border-color: rgb(147, 197, 253);
    background-color: rgba(59, 130, 246, 0.1);
    transform: scale(1.02);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.6);
    border-color: rgb(147, 197, 253);
    background-color: rgba(59, 130, 246, 0.019);
    transform: scale(1);
  }
}

@keyframes pulse-highlight-yellow {
  0% {
    box-shadow: 0 0 0 0 rgba(234, 179, 8, 0.6);
    border-color: rgb(253, 224, 71);
    background-color: rgba(234, 179, 8, 0.019);
    transform: scale(1);
  }
  50% {
    box-shadow: 0 0 10px 5px rgba(234, 179, 8, 0.4);
    border-color: rgb(253, 224, 71);
    background-color: rgba(234, 179, 8, 0.1);
    transform: scale(1.02);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(234, 179, 8, 0.6);
    border-color: rgb(253, 224, 71);
    background-color: rgba(234, 179, 8, 0.019);
    transform: scale(1);
  }
}

.animate-pulse-highlight-green {
  animation: pulse-highlight-green 1s ease-in-out 3;
  animation-fill-mode: forwards;
  border-width: 1px !important;
  position: relative;
  z-index: 10;
}

.animate-pulse-highlight-blue {
  animation: pulse-highlight-blue 1s ease-in-out 3;
  animation-fill-mode: forwards;
  border-width: 1px !important;
  position: relative;
  z-index: 10;
}

.animate-pulse-highlight-yellow {
  animation: pulse-highlight-yellow 1s ease-in-out 3;
  animation-fill-mode: forwards;
  border-width: 1px !important;
  position: relative;
  z-index: 10;
}
</style> 