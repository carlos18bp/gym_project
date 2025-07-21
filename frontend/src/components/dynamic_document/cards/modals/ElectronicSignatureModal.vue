<template>
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div class="bg-white rounded-lg p-6 max-w-2xl w-full mx-auto shadow-xl">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-lg font-medium text-primary">Firma Electrónica</h2>
        <button 
          @click="closeModal" 
          class="text-gray-400 hover:text-gray-500"
        >
          <XMarkIcon class="h-6 w-6" />
        </button>
      </div>
      <ElectronicSignature 
        :initialShowOptions="true"
        :user-id="userStore.currentUser.id"
        @signatureSaved="handleSignatureSaved" 
        @cancel="closeModal"
      />
    </div>
  </div>
</template>

<script setup>
import { XMarkIcon } from "@heroicons/vue/24/outline";
import ElectronicSignature from "@/components/electronic_signature/ElectronicSignature.vue";
import { useUserStore } from "@/stores/user";
import { showNotification } from "@/shared/notification_message";

const userStore = useUserStore();

const emit = defineEmits(['close']);

/**
 * Close the modal
 */
const closeModal = () => {
  emit('close');
};

/**
 * Handle signature saved event
 */
const handleSignatureSaved = async (signatureData) => {
  // Update user store to reflect they now have a signature
  if (userStore.currentUser) {
    userStore.currentUser.has_signature = true;
  }
  
  showNotification("Firma electrónica guardada correctamente", "success");
  
  // Close the modal after a small delay
  setTimeout(() => {
    closeModal();
  }, 500);
};
</script> 