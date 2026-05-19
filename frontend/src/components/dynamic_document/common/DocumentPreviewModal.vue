<template>
  <ModalTransition v-show="isVisible">
    <div class="w-full h-full flex items-center justify-center p-4" @click.self="closeModal">
    <div
      class="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col"
      data-testid="document-preview-modal"
    >
      <div class="flex justify-between items-center px-6 pt-6 pb-4 flex-shrink-0">
        <h2 class="text-lg font-bold" data-testid="document-preview-heading">
          Previsualización del Documento: {{ documentData.title }}
        </h2>
        <button @click="closeModal" data-testid="document-preview-close" aria-label="Cerrar previsualización del documento">
          <XMarkIcon class="size-6 text-gray-500 hover:text-gray-700" />
        </button>
      </div>
      <div
        class="px-6 pb-6 overflow-y-auto flex-1 prose max-w-none"
        data-testid="document-preview-content"
        v-html="sanitizedContent"
      ></div>
    </div>
    </div>
  </ModalTransition>
</template>

<script setup>
import { computed } from "vue";
import ModalTransition from "@/components/layouts/animations/ModalTransition.vue";
import { XMarkIcon } from "@heroicons/vue/24/outline";
import { sanitizeHtml } from "@/composables/useSafeHtml.js";

// Define props for the component
const props = defineProps({
  isVisible: Boolean,
  documentData: {
    type: Object,
    default: () => ({ title: "", content: "" }),
  },
});

const sanitizedContent = computed(() => sanitizeHtml(props.documentData?.content));

// Emit event when closing modal
const emit = defineEmits(["close"]);
const closeModal = () => {
  emit("close");
};
</script>
