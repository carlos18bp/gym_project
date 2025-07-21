<template>
  <BaseDocumentCard
    :document="document"
    :card-type="cardType"
    :card-context="cardContext"
    :status-icon="DocumentArrowUpIcon"
    status-text="Disponible"
    status-badge-classes="bg-green-100 text-green-700 border border-green-200"
    :menu-options="cardType === 'folder' ? undefined : []"
    :highlighted-doc-id="null"
    :show-tags="showTags"
    :document-store="documentStore"
    :user-store="userStore"
    additional-classes="group"
    @click="handleCardClick"
    @remove-from-folder="$emit('remove-from-folder', $event)"
  >
    <!-- Custom right action slot with arrow instead of menu (only when NOT in folder context) -->
    <template v-if="cardType !== 'folder'" #right-action>
      <ChevronRightIcon class="w-5 h-5 text-gray-400 group-hover:text-gray-600 transition-colors" />
    </template>

    <!-- Footer with click indicator -->
    <template #footer>
      <div class="mt-3 pt-2 border-t border-gray-100">
        <div class="flex items-center gap-2 text-xs text-gray-500">
          <div class="w-2 h-2 bg-blue-500 rounded-full"></div>
          <span>Hacer clic para usar este documento</span>
        </div>
      </div>
    </template>

    <!-- Pass through additional actions slot -->
    <template #additional-actions>
      <slot name="additional-actions"></slot>
    </template>
  </BaseDocumentCard>
</template>

<script setup>
import BaseDocumentCard from './BaseDocumentCard.vue';
import {
  ChevronRightIcon,
  DocumentArrowUpIcon,
} from "@heroicons/vue/24/outline";

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
  }
});

const emit = defineEmits(['click', 'remove-from-folder']);

/**
 * Handle card click - emit the document for use
 */
const handleCardClick = (document, event) => {
  emit('click', document.id);
};
</script> 