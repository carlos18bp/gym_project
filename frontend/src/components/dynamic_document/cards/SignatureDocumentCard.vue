<template>
  <BaseDocumentCard
    :document="document"
    :card-type="cardType"
    :card-context="cardContext"
    :status-icon="null"
    :status-text="statusText"
    :status-badge-classes="statusBadgeClasses"
    :highlighted-doc-id="highlightedDocId"
    :show-tags="showTags"
    :additional-classes="'mb-4'"
    :menu-options="menuOptions"
    :disable-internal-actions="disableInternalActions"
    :document-store="documentStore"
    :user-store="userStore"
    @click="handleCardClick"
    @preview="$emit('preview', $event)"
    @edit="$emit('edit', $event)"
    @refresh="$emit('refresh')"
    @sign="$emit('sign', $event)"
    @view-signatures="$emit('view-signatures', $event)"
    @remove-from-folder="$emit('remove-from-folder', $event)"
  >
    <!-- Custom status badge with SVG icon -->
    <template #status-badge>
      <div 
        class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
        :class="statusBadgeClasses"
      >
        <svg 
          class="h-3.5 w-3.5"
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          stroke-width="2" 
          stroke-linecap="round" 
          stroke-linejoin="round"
        >
          <path v-if="document.state === 'PendingSignatures'" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
          <path v-else d="M20 6L9 17l-5-5"></path>
        </svg>
        <span>{{ statusText }}</span>
      </div>
    </template>
    <!-- Signature progress badge -->
    <template #additional-badges>
      <div class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
        <span>{{ getCompletedSignatures(document) }}/{{ getTotalSignatures(document) }}</span>
      </div>
    </template>

    <!-- Override content to remove description -->
    <template #additional-content>
      <!-- No description for signature documents -->
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

const props = defineProps({
  document: {
    type: Object,
    required: true
  },
  cardType: {
    type: String,
    default: 'signatures'
  },
  cardContext: {
    type: String,
    default: 'list'
  },
  highlightedDocId: {
    type: [String, Number],
    default: null
  },
  showTags: {
    type: Boolean,
    default: true
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
  }
});

const emit = defineEmits([
  'click', 
  'preview', 
  'edit', 
  'refresh', 
  'sign', 
  'view-signatures',
  'remove-from-folder'
]);

// Status icon based on document state
const statusIcon = computed(() => {
  return null; // Will use SVG in template
});

// Status text based on document state
const statusText = computed(() => {
  return props.document.state === 'PendingSignatures' 
    ? 'Pendiente de firmas' 
    : 'Completamente firmado';
});

// Status badge classes based on document state
const statusBadgeClasses = computed(() => {
  return props.document.state === 'PendingSignatures'
    ? 'bg-yellow-100 text-yellow-700 border border-yellow-200'
    : 'bg-green-100 text-green-700 border border-green-200';
});

// Menu options - use prop if provided, otherwise use BaseDocumentCard's internal logic
const menuOptions = computed(() => {
  // If menuOptions prop is explicitly provided, use it
  if (props.menuOptions !== null) {
    return props.menuOptions;
  }
  
  // Otherwise, let BaseDocumentCard handle it internally
  return undefined;
});

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
 * Handle card click - emit preview or just click based on disableInternalActions
 */
const handleCardClick = (document, event) => {
  emit('click', document, event);
  
  if (!props.disableInternalActions) {
    // Only emit preview when internal actions are enabled
    emit('preview', document);
  }
};


</script> 