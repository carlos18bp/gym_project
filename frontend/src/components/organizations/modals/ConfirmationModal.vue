<template>
  <TransitionRoot as="template" :show="visible">
    <Dialog class="relative z-50" @close="handleCancel">
      <TransitionChild
        as="template"
        enter="ease-out duration-300"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="ease-in duration-200"
        leave-from="opacity-100"
        leave-to="opacity-0"
      >
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
      </TransitionChild>

      <div class="fixed inset-0 z-10 overflow-y-auto">
        <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
          <TransitionChild
            as="template"
            enter="ease-out duration-300"
            enter-from="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            enter-to="opacity-100 translate-y-0 sm:scale-100"
            leave="ease-in duration-200"
            leave-from="opacity-100 translate-y-0 sm:scale-100"
            leave-to="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
          >
            <DialogPanel class="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
              <div class="sm:flex sm:items-start">
                <!-- Icon -->
                <div 
                  :class="[
                    'mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full sm:mx-0 sm:h-10 sm:w-10',
                    confirmColor === 'red' ? 'bg-red-100' : 'bg-yellow-100'
                  ]"
                >
                  <ExclamationTriangleIcon 
                    :class="[
                      'h-6 w-6',
                      confirmColor === 'red' ? 'text-red-600' : 'text-yellow-600'
                    ]"
                  />
                </div>
                
                <!-- Content -->
                <div class="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
                  <DialogTitle as="h3" class="text-base font-semibold leading-6 text-gray-900">
                    {{ title }}
                  </DialogTitle>
                  <div class="mt-2">
                    <p class="text-sm text-gray-500">
                      {{ message }}
                    </p>
                  </div>
                </div>
              </div>
              
              <!-- Actions -->
              <div class="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  @click="handleConfirm"
                  :disabled="isLoading"
                  :class="[
                    'inline-flex w-full justify-center rounded-md px-3 py-2 text-sm font-semibold text-white shadow-sm sm:ml-3 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed',
                    confirmColor === 'red' 
                      ? 'bg-red-600 hover:bg-red-500 focus-visible:outline-red-600' 
                      : 'bg-yellow-600 hover:bg-yellow-500 focus-visible:outline-yellow-600'
                  ]"
                >
                  <div v-if="isLoading" class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {{ isLoading ? 'Procesando...' : confirmText }}
                </button>
                <button
                  type="button"
                  @click="handleCancel"
                  :disabled="isLoading"
                  class="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {{ cancelText }}
                </button>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

<script setup>
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionChild,
  TransitionRoot,
} from '@headlessui/vue';
import { ExclamationTriangleIcon } from '@heroicons/vue/24/outline';

// Props
const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  confirmText: {
    type: String,
    default: 'Confirmar'
  },
  cancelText: {
    type: String,
    default: 'Cancelar'
  },
  confirmColor: {
    type: String,
    default: 'yellow',
    validator: (value) => ['red', 'yellow'].includes(value)
  },
  isLoading: {
    type: Boolean,
    default: false
  }
});

// Emits
const emit = defineEmits(['confirm', 'cancel']);

// Methods
const handleConfirm = () => {
  if (!props.isLoading) {
    emit('confirm');
  }
};

const handleCancel = () => {
  if (!props.isLoading) {
    emit('cancel');
  }
};
</script>

