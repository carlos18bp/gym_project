<template>
  <ModalTransition v-show="isVisible">
    <div class="w-full h-full flex items-center justify-center p-4" @click.self="close">
      <div
        class="relative bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col"
        data-testid="upload-payment-modal"
      >
        <!-- Header -->
        <div class="px-6 py-4 border-b border-gray-200">
          <h2 class="text-xl font-semibold text-gray-800">Subir Cuenta de Cobro</h2>
          <p class="text-sm text-gray-500 mt-1 break-words">
            {{ document?.title }} ·
            <span class="font-medium text-gray-700">
              Cuota {{ slotNumber }} de {{ totalInstallments }}
            </span>
          </p>
          <button
            @click="close"
            class="absolute top-4 right-4 text-gray-400 hover:text-gray-500"
          >
            <XMarkIcon class="h-6 w-6" />
          </button>
        </div>

        <!-- Body -->
        <div class="p-6 overflow-y-auto flex-grow space-y-4">
          <!-- Dropzone -->
          <div
            @dragover.prevent
            @drop.prevent="handleDrop"
            :class="[
              'border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer',
              selectedFile ? 'border-secondary bg-blue-50/40' : 'border-gray-300 hover:border-secondary'
            ]"
            data-testid="payment-dropzone"
            @click="fileInput?.click()"
          >
            <input
              ref="fileInput"
              type="file"
              class="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.docx"
              data-testid="payment-file-input"
              @change="handleFileChange"
            />
            <template v-if="!selectedFile">
              <ArrowUpTrayIcon class="mx-auto size-8 text-gray-400" />
              <p class="mt-2 text-sm text-gray-600">
                Arrastra el archivo aquí o <span class="text-secondary font-medium">haz clic para seleccionarlo</span>
              </p>
              <p class="mt-1 text-xs text-gray-400">PDF, JPG, PNG o DOCX · máx. 20 MB</p>
            </template>
            <div v-else class="flex items-center justify-between gap-3 text-left">
              <div class="flex items-center gap-2 min-w-0">
                <DocumentTextIcon class="size-6 text-secondary shrink-0" />
                <div class="min-w-0">
                  <p class="text-sm font-medium text-gray-800 truncate">{{ selectedFile.name }}</p>
                  <p class="text-xs text-gray-400">{{ formatFileSize(selectedFile.size) }}</p>
                </div>
              </div>
              <button
                @click.stop="selectedFile = null"
                class="p-1 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50"
                data-testid="remove-payment-file"
              >
                <XMarkIcon class="size-5" />
              </button>
            </div>
          </div>
          <p v-if="fileError" class="text-sm text-red-600" data-testid="payment-file-error">
            {{ fileError }}
          </p>

          <!-- Amount (optional) -->
          <div>
            <label class="block text-sm font-medium text-primary mb-1" for="payment-amount">
              Monto de la cuota <span class="text-gray-400 font-normal">(opcional)</span>
            </label>
            <div class="relative">
              <span class="absolute inset-y-0 left-3 flex items-center text-gray-500 text-sm">$</span>
              <input
                id="payment-amount"
                v-model="amount"
                type="number"
                min="0"
                step="0.01"
                placeholder="0"
                class="block w-full rounded-lg border-0 py-2 pl-7 pr-3 text-sm text-primary shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-secondary"
                data-testid="payment-amount-input"
              />
            </div>
          </div>

          <!-- Notes (optional) -->
          <div>
            <label class="block text-sm font-medium text-primary mb-1" for="payment-notes">
              Notas adicionales <span class="text-gray-400 font-normal">(opcional)</span>
            </label>
            <textarea
              id="payment-notes"
              v-model="notes"
              rows="3"
              placeholder="Observaciones sobre esta cuenta de cobro..."
              class="block w-full rounded-lg border-0 py-2 px-3 text-sm text-primary shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-secondary"
              data-testid="payment-notes-input"
            ></textarea>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button
            @click="close"
            class="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            Cancelar
          </button>
          <button
            @click="submit"
            :disabled="!selectedFile || uploading"
            class="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-secondary bg-secondary text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            data-testid="payment-submit"
          >
            <span v-if="uploading" class="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
            {{ uploading ? 'Subiendo...' : 'Subir Cuenta de Cobro' }}
          </button>
        </div>
      </div>
    </div>
  </ModalTransition>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import ModalTransition from '@/components/layouts/animations/ModalTransition.vue';
import { useDynamicDocumentStore } from '@/stores/dynamic_document';
import { showNotification } from '@/shared/notification_message';
import {
  ArrowUpTrayIcon,
  DocumentTextIcon,
  XMarkIcon,
} from '@heroicons/vue/24/outline';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB (mirror of the backend cap)
const ALLOWED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'docx'];

const props = defineProps({
  isVisible: {
    type: Boolean,
    default: false,
  },
  document: {
    type: Object,
    default: null,
  },
  slotNumber: {
    type: Number,
    default: null,
  },
});

const emit = defineEmits(['close', 'uploaded']);

const store = useDynamicDocumentStore();

const fileInput = ref(null);
const selectedFile = ref(null);
const fileError = ref('');
const amount = ref('');
const notes = ref('');
const uploading = ref(false);

const totalInstallments = computed(
  () => props.document?.summary_payment_installments ?? '—'
);

watch(
  () => props.isVisible,
  (visible) => {
    if (!visible) {
      selectedFile.value = null;
      fileError.value = '';
      amount.value = '';
      notes.value = '';
    }
  }
);

function validateAndSet(file) {
  fileError.value = '';
  if (!file) return;

  const extension = (file.name || '').split('.').pop().toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    fileError.value = 'Formato no permitido. Usa PDF, JPG, PNG o DOCX.';
    return;
  }
  if (file.size > MAX_FILE_SIZE) {
    fileError.value = 'El archivo supera el tamaño máximo de 20 MB.';
    return;
  }
  selectedFile.value = file;
}

function handleFileChange(event) {
  validateAndSet(event.target.files?.[0]);
  event.target.value = '';
}

function handleDrop(event) {
  validateAndSet(event.dataTransfer?.files?.[0]);
}

function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function submit() {
  if (!selectedFile.value || uploading.value) return;
  uploading.value = true;
  try {
    const data = await store.uploadPaymentRecord(props.document.id, {
      file: selectedFile.value,
      installmentNumber: props.slotNumber,
      amount: amount.value,
      notes: notes.value.trim(),
    });
    await showNotification('Cuenta de cobro cargada correctamente.', 'success');
    emit('uploaded', data);
  } catch (error) {
    await showNotification(
      error?.response?.data?.detail || 'No se pudo cargar la cuenta de cobro.',
      'error'
    );
  } finally {
    uploading.value = false;
  }
}

function close() {
  emit('close');
}
</script>
