<template>
  <BaseDocumentCard
      :document="document"
      :card-type="cardType"
      :card-context="cardContext"
      :status-icon="DocumentArrowUpIcon"
      status-text="Disponible"
      :status-badge-classes="statusBadgeClasses"
      :menu-options="menuOptions"
      :highlighted-doc-id="null"
      :show-tags="showTags"
      :document-store="documentStore"
      :user-store="userStore"
      :additional-classes="cardAdditionalClasses"
      :disable-internal-actions="disableInternalActions"
      :show-menu-options="showMenuOptions"
      @click="handleCardClick"
      @menuAction="handleMenuAction"
      @remove-from-folder="$emit('remove-from-folder', $event)"
  >
    <!-- Custom right action slot with arrow instead of menu (only when should show arrow) -->
    <template v-if="shouldShowArrowOnly" #right-action>
      <ChevronRightIcon class="w-5 h-5 text-gray-400 group-hover:text-gray-600 transition-colors" />
    </template>

    <!-- Footer with click indicator (only when internal actions enabled) -->
    <template v-if="!disableInternalActions" #footer>
      <div class="mt-3 pt-2 border-t border-gray-100">
        <div class="flex items-center gap-2 text-xs text-gray-500">
          <div 
            class="w-2 h-2 rounded-full" 
            :style="{ backgroundColor: indicatorColor }"
          ></div>
          <span>Hacer clic para usar este documento</span>
        </div>
      </div>
    </template>

    <!-- Pass through additional actions slot -->
    <template #additional-actions>
      <slot name="additional-actions"></slot>
    </template>
  </BaseDocumentCard>

  <!-- Modal interno para personalizar nombre del documento -->
  <ModalTransition v-show="showUseModal">
    <UseDocumentByClient
      :document-id="selectedDocumentId"
      v-if="selectedDocumentId !== null"
      @close="handleModalClose"
    />
  </ModalTransition>
</template>

<script setup>
import { computed, ref } from 'vue';
import BaseDocumentCard from './BaseDocumentCard.vue';
import { getColorById, getColorStyles } from '@/shared/color_palette.js';
import {
  ChevronRightIcon,
  DocumentArrowUpIcon,
  EllipsisVerticalIcon,
  EyeIcon,
  PlayIcon,
} from "@heroicons/vue/24/outline";
import UseDocumentByClient from '../client/modals/UseDocumentByClient.vue';
import ModalTransition from "@/components/layouts/animations/ModalTransition.vue";
import { openPreviewModal } from "@/shared/document_utils";

const props = defineProps({
  document: {
    type: Object,
    required: true
  },
  showTags: {
    type: Boolean,
    default: true
  },
  cardType: {
    type: String,
    default: 'default'
  },
  cardContext: {
    type: String,
    default: 'list'
  },
  documentStore: {
    type: Object,
    default: null
  },
  userStore: {
    type: Object,
    default: null
  },
  menuOptions: {
    type: Array,
    default: null
  },
  disableInternalActions: {
    type: Boolean,
    default: false
  },
  showMenuOptions: {
    type: Boolean,
    default: null // null = auto-detect, true = force show, false = force hide
  },
  additionalClasses: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['click', 'remove-from-folder', 'document-created']);

// Modal state
const showUseModal = ref(false);
const selectedDocumentId = ref(null);

// 🟣 Purple theme using Violeta color (id: 9)
const purpleColor = getColorById(9); // Violeta: light="#EDE7F6", dark="#4527A0"

// Status badge classes with purple theme - overrides BaseDocumentCard defaults
const statusBadgeClasses = computed(() => {
  return 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium !bg-purple-100 !text-purple-700 !border !border-purple-200';
});

// Indicator dot color (matching purple theme)
const indicatorColor = computed(() => purpleColor.dark);

// Card additional classes with purple border - overrides BaseDocumentCard green border
const cardAdditionalClasses = computed(() => {
  const base = 'group !border-purple-400 !bg-purple-50/50 !shadow-purple-100';
  return props.additionalClasses
    ? `${base} ${props.additionalClasses}`
    : base;
});

// Menu options - always show menu with "Usar" and "Previsualización" options
const menuOptions = computed(() => {
  // If menuOptions prop is explicitly provided, use it (highest priority)
  if (props.menuOptions !== null) {
    return props.menuOptions;
  }
  
  // Default menu options for UseDocumentCard
  return [
    {
      label: "Usar",
      action: "use",
      icon: PlayIcon,
      iconClasses: "w-4 h-4 text-purple-600"
    },
    {
      label: "Previsualización", 
      action: "preview",
      icon: EyeIcon,
      iconClasses: "w-4 h-4 text-gray-600"
    }
  ];
});

// Always show menu instead of arrow for UseDocumentCard
const shouldShowArrowOnly = computed(() => {
  // Never show arrow only - always show menu for UseDocumentCard
  return false;
});

/**
 * Handle card click - open internal modal or just emit based on disableInternalActions
 */
const handleCardClick = (document, event) => {
  if (props.disableInternalActions) {
    // Just emit click event, don't open modal
    emit('click', document, event);
  } else {
    // Open internal modal instead of emitting to parent
    openUseModal(document.id);
  }
};

/**
 * Handle menu actions from BaseDocumentCard
 */
const handleMenuAction = (action, document) => {
  switch (action) {
    case 'use':
      // Same action as clicking the card
      openUseModal(document.id);
      break;
    case 'preview':
      // Open preview modal using shared utility
      openPreviewModal(document);
      break;
    default:
      console.warn('Unknown menu action:', action);
  }
};

/**
 * Opens the use document modal internally
 * @param {string|number} documentId - The ID of the document to be used.
 */
function openUseModal(documentId) {
  if (documentId) {
    selectedDocumentId.value = documentId;
    showUseModal.value = true;
  } else {
    console.error('Document ID is required:', documentId);
  }
}

/**
 * Handles modal close event.
 * Also handles visual highlighting of updated documents if necessary.
 * 
 * @param {Object} data - Data received from the modal, may contain updatedDocId
 */
function handleModalClose(data) {
  showUseModal.value = false;
  selectedDocumentId.value = null;
  
  // If we receive an updated document ID, update lastUpdatedDocumentId
  if (data && data.updatedDocId) {
    // Note: We'll need documentStore access for this, but for now just emit the event
    // Parent components can handle the highlighting if needed
    emit('document-created', data);
    
    // For direct navigation/highlighting, check current path
    const currentPath = window.location.pathname;
    const isDashboard = currentPath === '/dynamic_document_dashboard' || 
                        currentPath === '/dynamic_document_dashboard/';
    
    if (!isDashboard) {
      // Only redirect if we're not already on the dashboard
      setTimeout(() => {
        window.location.href = '/dynamic_document_dashboard';
      }, 500);
    } else {
      // Try to use global highlight function if available
      setTimeout(() => {
        if (window.forceDocumentHighlight) {
          window.forceDocumentHighlight(data.updatedDocId);
        }
      }, 100);
    }
  }
}
</script> 