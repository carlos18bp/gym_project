<template>
  <BaseDocumentCard
    :document="document"
    :status-icon="null"
    :status-text="statusText"
    :status-badge-classes="statusBadgeClasses"
    :menu-options="menuOptions"
    :menu-position="menuPosition"
    :highlighted-doc-id="highlightedDocId"
    :show-tags="showTags"
    additional-classes="mb-4"
    custom-status-badge
    @click="handleCardClick"
    @menu-action="handleMenuAction"
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
  }
});

const emit = defineEmits(['click', 'menu-action', 'preview']);

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