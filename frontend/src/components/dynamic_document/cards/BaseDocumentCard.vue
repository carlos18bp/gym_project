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
        <!-- Use hierarchical menu if there are many options or if any option has children -->
        <HierarchicalMenu
          v-if="shouldUseHierarchicalMenu(menuOptions) || hasSubMenuOptions(menuOptions)"
          :menu-items="organizedMenuItems"
          :menu-position="menuPosition"
          @menu-action="(action) => handleMenuAction(action, document)"
        />
        
        <!-- Use traditional menu for fewer options without submenus -->
        <Menu v-else-if="menuOptions && menuOptions.length > 0" as="div" class="relative inline-block text-left menu-container">
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

  <!-- MODALS - Handled internally -->
  
  <!-- Edit Document Modal -->
  <EditDocumentModal
    v-if="activeModals.edit.isOpen"
    :document="activeModals.edit.document"
    :user-role="getUserRole()"
    @close="closeModal('edit')"
  />

  <!-- Send Document Modal -->
  <SendDocumentModal
    v-if="activeModals.email.isOpen"
    :document="activeModals.email.document"
    @close="closeModal('email')"
  />

  <!-- Document Signatures Modal -->
  <DocumentSignaturesModal
    v-if="activeModals.signatures.isOpen"
    :document-id="activeModals.signatures.document?.id"
    @close="closeModal('signatures')"
    @refresh="handleRefresh"
  />

  <!-- Electronic Signature Modal -->
  <ElectronicSignatureModal
    v-if="activeModals.electronicSignature.isOpen"
    @close="closeModal('electronicSignature')"
  />

  <!-- Document Permissions Modal -->
  <DocumentPermissionsModal
    v-if="activeModals.permissions.isOpen"
    :is-open="activeModals.permissions.isOpen"
    :document="activeModals.permissions.document"
    @close="closeModal('permissions')"
    @saved="handleRefresh"
  />

  <!-- Letterhead Modal -->
  <LetterheadModal
    v-if="activeModals.letterhead.isOpen"
    :is-visible="activeModals.letterhead.isOpen"
    :document="activeModals.letterhead.document"
    @close="closeModal('letterhead')"
    @uploaded="handleRefresh"
    @deleted="handleRefresh"
  />

  <!-- Document Relationships Modal -->
  <DocumentRelationshipsModal
    v-if="activeModals.relationships.isOpen"
    :is-open="activeModals.relationships.isOpen"
    :document="activeModals.relationships.document"
    @close="closeModal('relationships')"
    @refresh="handleRefresh"
  />
</template>

<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/vue";
import { 
  EllipsisVerticalIcon, 
  NoSymbolIcon, 
  CheckCircleIcon, 
  PencilIcon 
} from "@heroicons/vue/24/outline";
import { getColorById } from "@/shared/color_palette";
import { useRecentViews } from '@/composables/useRecentViews';

// Import centralized system from index.js
import { 
  useCardModals, 
  useDocumentActions,
  EditDocumentModal,
  SendDocumentModal,
  DocumentSignaturesModal,
  ElectronicSignatureModal,
  DocumentPermissionsModal
} from './index.js';

// Import the document relationships modal
import DocumentRelationshipsModal from '../modals/DocumentRelationshipsModal.vue';

// Import LetterheadModal from common
import LetterheadModal from '../common/LetterheadModal.vue';

// Import hierarchical menu components
import HierarchicalMenu from './HierarchicalMenu.vue';
import { organizeMenuIntoGroups, shouldUseHierarchicalMenu } from './menuGroupHelpers.js';

// Composables
const router = useRouter();
const { registerView } = useRecentViews();

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
  // Override for menu options (for selection-only contexts)
  menuOptions: {
    type: Array,
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
  },
  // Configuration props for centralized actions
  enableModals: {
    type: Boolean,
    default: true
  },
  editModalComponent: {
    type: String,
    default: 'UseDocumentByClient' // 'UseDocumentByClient', 'editor', 'CreateDocumentByLawyer'
  },
  editRoute: {
    type: String,
    default: null // When set, navigates instead of opening modal
  },
  enableSignatures: {
    type: Boolean,
    default: true
  },
  disableInternalActions: {
    type: Boolean,
    default: false
  },
  showMenuOptions: {
    type: Boolean,
    default: null
  }
});

const emit = defineEmits([
  'click', 
  'refresh',
  'remove-from-folder',
  'modal-open',
  'navigation',
  'menuAction'
]);

// Initialize centralized modal and actions system
const { activeModals, openModal, closeModal, getUserRole } = useCardModals(props.documentStore, props.userStore);
const {
  handlePreviewDocument,
  deleteDocument,
  downloadPDFDocument,
  downloadWordDocument,
  copyDocument,
  publishDocument,
  moveToDraft,
  formalizeDocument,
  signDocument,
  downloadSignedDocument
} = useDocumentActions(props.documentStore, props.userStore, emit);

// Handle card click, avoiding menu clicks
const handleCardClick = (e) => {
  if (!e.target.closest('.menu-container')) {
    emit('click', props.document, e);
  }
};

// Handle refresh
const handleRefresh = () => {
  emit('refresh');
};

// ===== CONFIGURACIÓN DE TIPOS DE CARD =====
const cardConfigs = {
  default: {
    getMenuOptions: (document, context) => {
      const options = [];

      // Always show "Usar Formato" for default card type
      options.push({ label: "Usar Formato", action: "useDocument" });

      // Add letterhead management option
      options.push({ label: "Gestionar Membrete", action: "letterhead" });

      // Add remove from folder option when in folder context
      if (context === 'folder') {
        options.push({
          label: "Quitar de Carpeta",
          action: "removeFromFolder"
        });
      }

      return options;
    }
  },

  client: {
    getMenuOptions: (document, context) => {
      const options = [];
      
      // Edit options with submenu for completed documents
      if (document.state === "Completed") {
        options.push({
          label: "Editar",
          action: "edit-submenu",
          isGroup: true,
          children: [
            {
              label: "Editar Formulario",
              action: "editForm"
            },
            {
              label: "Editar Documento", 
              action: "editDocument"
            }
          ]
        });
      } else {
        // For non-completed documents, keep simple "Completar" option
        options.push({
          label: "Completar",
          action: "editForm"
        });
      }

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

      // Add letterhead management option
      options.push({ label: "Gestionar Membrete", action: "letterhead" });

      // Add document relationships management option
      options.push({ label: "Administrar Asociaciones", action: "relationships" });

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

      // Add remove from folder option when in folder context
      if (context === 'folder') {
        options.push({
          label: "Quitar de Carpeta",
          action: "removeFromFolder"
        });
      }

      return options;
    }
  },
  
  lawyer: {
    getMenuOptions: (document, context) => {
      const baseOptions = [
        { label: "Editar", action: "edit" },
        { label: "Permisos", action: "permissions" },
        { label: "Administrar Asociaciones", action: "relationships" },
        { label: "Eliminar", action: "delete" },
        { label: "Previsualización", action: "preview" },
        { label: "Crear una Copia", action: "copy" },
        { label: "Gestionar Membrete", action: "letterhead" },
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

        // Add sign option if the lawyer needs to sign
        if (canSignDocument(document)) {
          baseOptions.push({
            label: "Firmar documento",
            action: "sign"
          });
        }
      }

      return baseOptions;
    }
  },

  signatures: {
    getMenuOptions: (document, context) => {
      const options = [
        { label: "Previsualizar", action: "preview" },
        { label: "Gestionar Membrete", action: "letterhead" }
      ];

      // Add signature-related options
      if (document.requires_signature && (document.state === 'PendingSignatures' || document.state === 'FullySigned')) {
        options.push({
          label: "Estado de las firmas",
          action: "viewSignatures"
        });
      }

      // Sign document option
      if (canSignDocument(document)) {
        options.push({
          label: "Firmar documento",
          action: "sign"
        });
      }

      // Download signed document option (only for fully signed documents)
      if (document.state === 'FullySigned') {
        options.push({
          label: "Descargar Documento firmado",
          action: "downloadSignedDocument"
        });
      }

      // Download PDF option
      if (document.state === 'PendingSignatures') {
        options.push({
          label: "Descargar PDF",
          action: "downloadPDF"
        });
      }

      // Add remove from folder option when in folder context
      if (context === 'folder') {
        options.push({
          label: "Quitar de Carpeta",
          action: "removeFromFolder"
        });
      }

      return options;
    }
  },


};

// ===== COMPUTED PROPERTIES =====
const menuOptions = computed(() => {
  // If menuOptions prop is provided, use it (allows override for selection-only contexts)
  if (props.menuOptions !== null) {
    return props.menuOptions;
  }
  
  // If showMenuOptions is explicitly set, respect it
  if (props.showMenuOptions === false) {
    return []; // Force hide menu
  }
  
  if (props.showMenuOptions === true) {
    // Force show menu - get options from config
    const config = cardConfigs[props.cardType];
    if (!config) return [];
    return config.getMenuOptions(props.document, props.cardContext);
  }
  
  // Auto-detect logic (showMenuOptions is null) - use internal logic based on cardType
  const config = cardConfigs[props.cardType];
  if (!config) return [];
  
  return config.getMenuOptions(props.document, props.cardContext);
});

const menuPosition = computed(() => {
  // Responsive position logic
  if (props.promptDocuments) {
    // For prompt documents, use responsive positioning
    return 'right-0 left-auto sm:right-auto sm:left-0 sm:-translate-x-[calc(100%-24px)]';
  }
  
  // Default responsive positioning: right-aligned on mobile, left-aligned on desktop
  return 'right-0 left-auto sm:left-0 sm:right-auto';
});

// Organize menu items into hierarchical groups when there are many options
const organizedMenuItems = computed(() => {
  if (!menuOptions.value || menuOptions.value.length === 0) {
    return [];
  }
  
  // If any option already has children, return as-is (already organized)
  if (hasSubMenuOptions(menuOptions.value)) {
    return menuOptions.value;
  }
  
  // Otherwise, organize into groups
  return organizeMenuIntoGroups(menuOptions.value, props.document);
});

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
        await handleEditAction(document);
        break;
        
      case "editForm":
        await handleEditFormAction(document);
        break;
        
      case "editDocument":
        await handleEditDocumentAction(document);
        break;
        
      case "permissions":
        openModal('permissions', document);
        break;

      case "relationships":
        openModal('relationships', document);
        break;
        
      case "preview":
        await handlePreviewDocument(document);
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
        openModal('email', document);
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
        openModal('signatures', document);
        break;
        
      case "sign":
        await signDocument(document, openModal);
        break;
        
      case "downloadSignedDocument":
        await downloadSignedDocument(document);
        break;
        
      case "removeFromFolder":
        emit('remove-from-folder', document);
        break;

      case "useDocument":
        // For UseDocumentCard - emit click to trigger use document modal
        emit('click', document);
        break;
        
      case "use":
        // For UseDocumentCard - emit menuAction to be handled by the card
        emit('menuAction', action, document);
        break;
        
      case "letterhead":
        openModal('letterhead', document);
        break;
        
      default:
        console.warn("Unknown action:", action);
    }
  } catch (error) {
    console.error(`Error executing action ${action}:`, error);
  }
};

/**
 * Handle edit action - can be modal or navigation
 */
const handleEditAction = async (document) => {
  if (props.editRoute) {
    // Navigate to editor route
    const encodedTitle = encodeURIComponent(document.title.trim());
    const route = props.editRoute.replace(':id', document.id).replace(':title', encodedTitle);
    router.push(route);
  } else {
    // Open modal
    openModal('edit', document, { userRole: getUserRole() });
  }
};

/**
 * Handle edit form action - opens modal for form editing (original client behavior)
 */
const handleEditFormAction = async (document) => {
  // Always open modal for form editing
  openModal('edit', document, { userRole: getUserRole() });
};

/**
 * Handle edit document action - navigates directly to document editor
 */
const handleEditDocumentAction = async (document) => {
  // Navigate directly to client document editor
  router.push(`/dynamic_document_dashboard/client/editor/edit/${document.id}`);
};

/**
 * Check if any menu option has children (submenu)
 */
const hasSubMenuOptions = (options) => {
  return options && options.some(option => option.children && option.children.length > 0);
};

/**
 * Check if document can be published
 */
const canPublishDocument = (document) => {
  if (!document.variables || document.variables.length === 0) {
    return true;
  }
  
  return document.variables.every((variable) => {
    return variable.name_es && variable.name_es.trim().length > 0;
  });
};

/**
 * Check if the current user can sign the document
 */
const canSignDocument = (document) => {
  if (!document.requires_signature || document.state !== 'PendingSignatures') {
    return false;
  }
  
  if (!document.signatures || document.signatures.length === 0) {
    return false;
  }
  
  const userEmail = props.userStore?.currentUser?.email;
  
  const userSignature = document.signatures.find(s => s.signer_email === userEmail);
  
  if (!userSignature) {
    return false;
  }
  
  if (userSignature.signed) {
    return false;
  }
  
  return true;
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