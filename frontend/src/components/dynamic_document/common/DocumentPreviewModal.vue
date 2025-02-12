<template>
  <ModalTransition v-show="isVisible">
    <div class="bg-white rounded-lg shadow-xl p-6 max-w-4xl w-full overflow-auto max-h-[80vh]">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-lg font-bold">Previsualización del Documento: {{ documentData.title }}</h2>
        <button @click="closeModal">
          <XMarkIcon class="size-6 text-gray-500 hover:text-gray-700" />
        </button>
      </div>
      <div class="prose max-w-none" v-html="documentData.content"></div>
    </div>
  </ModalTransition>
</template>

<script setup>
import ModalTransition from "@/components/layouts/animations/ModalTransition.vue";
import { XMarkIcon } from "@heroicons/vue/24/outline";

// Define props for the component
const props = defineProps({
  isVisible: Boolean,
  documentData: {
    type: Object,
    default: () => ({ title: "", content: "" }),
  },
});

// Emit event when closing modal
const emit = defineEmits(["close"]);
const closeModal = () => {
  emit("close");
};
</script>
