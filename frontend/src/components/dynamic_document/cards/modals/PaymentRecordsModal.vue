<template>
  <ModalTransition v-show="isVisible">
    <div class="w-full h-full flex items-center justify-center p-4" @click.self="close">
      <div
        class="relative bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        data-testid="payment-records-modal"
      >
        <!-- Header -->
        <div class="px-6 py-4 border-b border-gray-200">
          <h2 class="text-xl font-semibold text-gray-800">Cuentas de Cobro</h2>
          <p class="text-sm text-gray-500 mt-1 break-words">
            {{ document?.title }}
            <span v-if="installmentsLabel"> · Forma de pago: {{ installmentsLabel }}</span>
          </p>
          <button
            @click="close"
            class="absolute top-4 right-4 text-gray-400 hover:text-gray-500"
          >
            <XMarkIcon class="h-6 w-6" />
          </button>
        </div>

        <!-- Body -->
        <div class="p-6 overflow-y-auto flex-grow">
          <!-- Loading -->
          <div v-if="loading" class="text-center py-10">
            <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-secondary"></div>
            <p class="mt-4 text-gray-500">Cargando cuentas de cobro...</p>
          </div>

          <!-- Not configured -->
          <div v-else-if="!paymentsData || !paymentsData.configured" class="text-center py-10 text-gray-500">
            Este documento no tiene una forma de pago configurada.
          </div>

          <template v-else>
            <!-- Progress -->
            <div class="mb-6" data-testid="payment-progress">
              <div class="flex items-center justify-between text-sm mb-1.5">
                <span class="font-medium text-gray-700">
                  {{ paymentsData.accepted_count }}/{{ paymentsData.total_installments }} cuotas aceptadas
                </span>
                <span v-if="totalAcceptedLabel" class="text-gray-500">
                  Total aceptado: {{ totalAcceptedLabel }}
                </span>
              </div>
              <div class="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  class="h-full bg-secondary rounded-full transition-all duration-300"
                  :style="{ width: progressPercent + '%' }"
                ></div>
              </div>
            </div>

            <!-- Slots -->
            <ul class="space-y-3">
              <li
                v-for="slot in paymentsData.slots"
                :key="slot.installment_number"
                class="border border-gray-200 rounded-lg p-4"
                :data-testid="`payment-slot-${slot.installment_number}`"
              >
                <div class="flex items-start justify-between gap-3 flex-wrap">
                  <div class="flex items-center gap-2">
                    <component
                      :is="statusIcon(slot.status)"
                      :class="['size-5 shrink-0', statusIconColor(slot.status)]"
                    />
                    <span class="font-medium text-gray-900">
                      Cuota {{ slot.installment_number }} de {{ paymentsData.total_installments }}
                    </span>
                    <span
                      :class="[
                        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                        statusBadgeClasses(slot.status)
                      ]"
                    >
                      {{ statusLabel(slot.status) }}
                    </span>
                  </div>

                  <!-- Lawyer review panel -->
                  <div
                    v-if="paymentsData.can_review && slot.status === 'uploaded'"
                    class="flex items-center gap-2"
                  >
                    <button
                      @click="accept(slot)"
                      :disabled="actionInProgress"
                      class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                      :data-testid="`accept-payment-${slot.installment_number}`"
                    >
                      <CheckIcon class="size-4" />
                      Aceptar
                    </button>
                    <button
                      @click="toggleRejectPanel(slot.installment_number)"
                      :disabled="actionInProgress"
                      class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-300 text-red-600 text-xs font-medium hover:bg-red-50 disabled:opacity-50 transition-colors"
                      :data-testid="`reject-payment-${slot.installment_number}`"
                    >
                      <XMarkIcon class="size-4" />
                      Rechazar
                    </button>
                  </div>
                </div>

                <!-- Record details -->
                <div v-if="slot.record" class="mt-3 text-sm text-gray-600 space-y-1.5">
                  <div class="flex items-center gap-2 flex-wrap">
                    <button
                      @click="download(slot)"
                      class="inline-flex items-center gap-1 text-secondary hover:underline font-medium"
                      :data-testid="`download-payment-${slot.installment_number}`"
                    >
                      <ArrowDownTrayIcon class="size-4" />
                      {{ slot.record.original_name || 'cuenta_de_cobro' }}
                    </button>
                    <span v-if="slot.record.amount" class="text-gray-900 font-medium">
                      {{ formatAmount(slot.record.amount) }}
                    </span>
                  </div>
                  <p v-if="slot.record.notes" class="whitespace-pre-line">{{ slot.record.notes }}</p>
                  <p class="text-xs text-gray-400">
                    Cargada por {{ slot.record.uploaded_by_name || '—' }} · {{ formatDateTime(slot.record.uploaded_at) }}
                  </p>

                  <!-- Rejection reason (current) -->
                  <div
                    v-if="slot.status === 'rejected' && slot.record.rejection_reason"
                    class="mt-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-red-700"
                    :data-testid="`rejection-reason-${slot.installment_number}`"
                  >
                    <span class="font-medium">Motivo del rechazo:</span>
                    {{ slot.record.rejection_reason }}
                  </div>

                  <!-- Previous rejection hint for the reviewer -->
                  <p
                    v-else-if="slot.status === 'uploaded' && slot.record.rejection_reason"
                    class="text-xs text-amber-600"
                  >
                    Rechazo anterior: {{ slot.record.rejection_reason }}
                  </p>
                </div>
                <p v-else class="mt-2 text-sm text-gray-400">
                  {{ pendingHint(slot) }}
                </p>

                <!-- Reject reason panel -->
                <div
                  v-if="rejectingSlot === slot.installment_number"
                  class="mt-3 space-y-2"
                >
                  <textarea
                    v-model="rejectReason"
                    rows="2"
                    placeholder="Motivo del rechazo (obligatorio)"
                    class="block w-full rounded-lg border-0 py-2 px-3 text-sm text-primary shadow-sm ring-1 ring-inset ring-red-300 focus:ring-2 focus:ring-red-400"
                    data-testid="reject-reason-input"
                  ></textarea>
                  <div class="flex justify-end gap-2">
                    <button
                      @click="toggleRejectPanel(null)"
                      class="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100"
                    >
                      Cancelar
                    </button>
                    <button
                      @click="reject(slot)"
                      :disabled="!rejectReason.trim() || actionInProgress"
                      class="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      data-testid="confirm-reject-payment"
                    >
                      Confirmar rechazo
                    </button>
                  </div>
                </div>
              </li>
            </ul>
          </template>
        </div>

        <!-- Footer -->
        <div class="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-3">
          <button
            v-if="paymentsData?.can_upload"
            @click="requestUpload"
            class="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-secondary bg-secondary text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            data-testid="upload-from-detail"
          >
            <ArrowUpTrayIcon class="size-4" />
            Subir Cuenta de Cobro
          </button>
          <span v-else></span>
          <button
            @click="close"
            class="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            Cerrar
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
import { formatInstallments } from '@/components/dynamic_document/common/formatInstallments';
import {
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  CheckCircleIcon,
  CheckIcon,
  ClockIcon,
  ExclamationCircleIcon,
  MinusCircleIcon,
  XMarkIcon,
} from '@heroicons/vue/24/outline';

const props = defineProps({
  isVisible: {
    type: Boolean,
    default: false,
  },
  document: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits(['close', 'upload-requested', 'updated']);

const store = useDynamicDocumentStore();

const loading = ref(false);
const paymentsData = ref(null);
const rejectingSlot = ref(null);
const rejectReason = ref('');
const actionInProgress = ref(false);

watch(
  () => props.isVisible,
  async (visible) => {
    if (visible && props.document?.id) {
      await load();
    } else {
      rejectingSlot.value = null;
      rejectReason.value = '';
    }
  }
);

async function load() {
  loading.value = true;
  try {
    paymentsData.value = await store.fetchPaymentRecords(props.document.id);
  } catch (error) {
    paymentsData.value = null;
    await showNotification('No se pudieron cargar las cuentas de cobro.', 'error');
  } finally {
    loading.value = false;
  }
}

const installmentsLabel = computed(() =>
  formatInstallments(paymentsData.value?.total_installments)
);

const progressPercent = computed(() => {
  if (!paymentsData.value?.total_installments) return 0;
  return Math.round(
    (paymentsData.value.accepted_count / paymentsData.value.total_installments) * 100
  );
});

const totalAcceptedLabel = computed(() => {
  const total = paymentsData.value?.total_amount_accepted;
  return total ? formatAmount(total) : '';
});

function statusLabel(status) {
  return {
    pending: 'Pendiente',
    uploaded: 'Cargada · En revisión',
    accepted: 'Aceptada',
    rejected: 'Rechazada',
  }[status] || status;
}

function statusBadgeClasses(status) {
  return {
    pending: 'bg-gray-100 text-gray-600',
    uploaded: 'bg-amber-100 text-amber-700',
    accepted: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
  }[status] || 'bg-gray-100 text-gray-600';
}

function statusIcon(status) {
  return {
    pending: MinusCircleIcon,
    uploaded: ClockIcon,
    accepted: CheckCircleIcon,
    rejected: ExclamationCircleIcon,
  }[status] || MinusCircleIcon;
}

function statusIconColor(status) {
  return {
    pending: 'text-gray-400',
    uploaded: 'text-amber-500',
    accepted: 'text-green-500',
    rejected: 'text-red-500',
  }[status] || 'text-gray-400';
}

function pendingHint(slot) {
  if (paymentsData.value?.next_uploadable === slot.installment_number) {
    return 'Disponible para carga.';
  }
  return 'Se habilita cuando la cuota anterior sea aceptada.';
}

function formatAmount(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return value;
  return `$ ${number.toLocaleString('es-CO')}`;
}

function formatDateTime(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString('es-CO', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch (error) {
    return value;
  }
}

function toggleRejectPanel(installmentNumber) {
  rejectingSlot.value =
    rejectingSlot.value === installmentNumber ? null : installmentNumber;
  rejectReason.value = '';
}

async function accept(slot) {
  actionInProgress.value = true;
  try {
    paymentsData.value = await store.acceptPaymentRecord(
      props.document.id,
      slot.record.id
    );
    emit('updated');
    await showNotification('Cuenta de cobro aceptada.', 'success');
  } catch (error) {
    await showNotification(
      error?.response?.data?.detail || 'No se pudo aceptar la cuenta de cobro.',
      'error'
    );
  } finally {
    actionInProgress.value = false;
  }
}

async function reject(slot) {
  const reason = rejectReason.value.trim();
  if (!reason) return;
  actionInProgress.value = true;
  try {
    paymentsData.value = await store.rejectPaymentRecord(
      props.document.id,
      slot.record.id,
      reason
    );
    rejectingSlot.value = null;
    rejectReason.value = '';
    emit('updated');
    await showNotification('Cuenta de cobro rechazada.', 'success');
  } catch (error) {
    await showNotification(
      error?.response?.data?.detail || 'No se pudo rechazar la cuenta de cobro.',
      'error'
    );
  } finally {
    actionInProgress.value = false;
  }
}

function download(slot) {
  store.downloadPaymentRecordFile(
    props.document.id,
    slot.record.id,
    slot.record.original_name
  );
}

function requestUpload() {
  emit('upload-requested', paymentsData.value?.next_uploadable ?? null);
}

function close() {
  emit('close');
}

defineExpose({ load });
</script>
