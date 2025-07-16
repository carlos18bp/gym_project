<template>
  <BaseDocumentCard
    :document="document"
    :status-icon="statusIcon"
    :status-text="statusText"
    :status-badge-classes="statusBadgeClasses"
    :menu-options="menuOptions"
    :menu-position="menuPosition"
    :highlighted-doc-id="highlightedDocId"
    :show-tags="showTags"
    :additional-classes="additionalClasses"
    @click="handleCardClick"
    @menu-action="handleMenuAction"
  >
    <!-- Custom status badge if needed -->
    <template v-if="customStatusBadge" #status-badge>
      <slot name="status-badge"></slot>
    </template>

    <!-- Signature status badge slot -->
    <template #additional-badges>
      <div 
        v-if="document.requires_signature" 
        class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
        :class="signatureStatusClasses"
      >
        <!-- Different icons based on signature status -->
        <svg 
          v-if="document.fully_signed"
          class="h-3 w-3" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          stroke-width="2" 
          stroke-linecap="round" 
          stroke-linejoin="round"
        >
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
        
        <svg 
          v-else-if="getCurrentUserSignature(document)?.signed"
          class="h-3 w-3" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          stroke-width="2" 
          stroke-linecap="round" 
          stroke-linejoin="round"
        >
          <path d="M20 6L9 17l-5-5"></path>
        </svg>
        
        <svg 
          v-else
          class="h-3 w-3" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          stroke-width="2" 
          stroke-linecap="round" 
          stroke-linejoin="round"
        >
          <path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
        </svg>
        
        <span>
          {{ document.fully_signed ? 'Formalizado' : getSignatureStatus(document) }}
        </span>
      </div>

      <!-- Progress badge for signatures list -->
      <div 
        v-if="showSignatureProgress && document.signatures" 
        class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200"
      >
        <span>{{ getCompletedSignatures(document) }}/{{ getTotalSignatures(document) }}</span>
      </div>
    </template>

    <!-- Additional content slot for client name, etc. -->
    <template #additional-content>
      <p v-if="showClientName && document.assigned_to" class="text-sm text-gray-600 leading-relaxed">
        Cliente: {{ getClientName(document.assigned_to) }}
      </p>
      <slot name="additional-content"></slot>
    </template>

    <!-- Pass through additional actions slot -->
    <template #additional-actions>
      <slot name="additional-actions"></slot>
    </template>
  </BaseDocumentCard>
</template>

<script setup>
import { computed } from 'vue';
import BaseDocumentCard from './BaseDocumentCard.vue';
import { 
  CheckCircleIcon, 
  PencilIcon,
  DocumentTextIcon
} from "@heroicons/vue/24/outline";

const props = defineProps({
  document: {
    type: Object,
    required: true
  },
  menuOptions: {
    type: Array,
    default: () => []
  },
  menuPosition: {
    type: String,
    default: 'right-0 left-auto'
  },
  highlightedDocId: {
    type: [String, Number],
    default: null
  },
  showTags: {
    type: Boolean,
    default: true
  },
  showClientName: {
    type: Boolean,
    default: false
  },
  showSignatureProgress: {
    type: Boolean,
    default: false
  },
  customStatusBadge: {
    type: Boolean,
    default: false
  },
  additionalClasses: {
    type: [String, Array, Object],
    default: ''
  },
  userStore: {
    type: Object,
    default: null
  }
});

const emit = defineEmits(['click', 'menu-action', 'preview']);

// Status icon based on document state
const statusIcon = computed(() => {
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

// Status text based on document state
const statusText = computed(() => {
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

// Status badge classes based on document state
const statusBadgeClasses = computed(() => {
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

// Signature status badge classes
const signatureStatusClasses = computed(() => {
  if (props.document.fully_signed) {
    return 'bg-green-100 text-green-700 border border-green-200';
  }
  
  const currentUserSignature = getCurrentUserSignature(props.document);
  if (currentUserSignature?.signed) {
    return 'bg-blue-100 text-blue-700 border border-blue-200';
  }
  
  if (currentUserSignature && !currentUserSignature.signed) {
    return 'bg-yellow-100 text-yellow-700 border border-yellow-200';
  }
  
  return 'bg-gray-100 text-gray-700 border border-gray-200';
});

/**
 * Get the current user's signature for the document
 */
const getCurrentUserSignature = (document) => {
  if (!document.signatures || !props.userStore?.currentUser) {
    return null;
  }
  
  const currentUserId = String(props.userStore.currentUser.id);
  return document.signatures.find(sig => String(sig.signer_id) === currentUserId);
};

/**
 * Get the signature status display text
 */
const getSignatureStatus = (document) => {
  if (!document.requires_signature) {
    return '';
  }
  
  if (document.fully_signed) {
    return 'Documento formalizado';
  }
  
  const currentUserSignature = getCurrentUserSignature(document);
  
  if (document.signatures && document.signatures.length > 0) {
    const totalSignatures = document.signatures.length;
    const signedCount = document.signatures.filter(sig => sig.signed).length;
    
    if (currentUserSignature && currentUserSignature.signed) {
      if (signedCount === 1 && totalSignatures > 1) {
        return `Has firmado. Faltan ${totalSignatures - signedCount} firmas más`;
      } else if (signedCount < totalSignatures) {
        return `Has firmado. Faltan ${totalSignatures - signedCount} firmas más`;
      }
    }
    
    return `Firmas: ${signedCount}/${totalSignatures}`;
  }
  
  return currentUserSignature ? 'Requiere tu firma' : 'Requiere firmas';
};

/**
 * Get client name by ID
 */
const getClientName = (clientId) => {
  if (!props.userStore) return 'Desconocido';
  
  const client = props.userStore.userById(clientId);
  return client ? `${client.first_name} ${client.last_name}` : 'Desconocido';
};

/**
 * Get total number of signatures
 */
const getTotalSignatures = (document) => {
  if (!document.signatures) return 0;
  return document.signatures.length;
};

/**
 * Get number of completed signatures
 */
const getCompletedSignatures = (document) => {
  if (!document.signatures) return 0;
  return document.signatures.filter(sig => sig.signed).length;
};

/**
 * Handle card click
 */
const handleCardClick = (document, event) => {
  emit('click', document, event);
  emit('preview', document);
};

/**
 * Handle menu action
 */
const handleMenuAction = (action, document) => {
  emit('menu-action', action, document);
};
</script> 