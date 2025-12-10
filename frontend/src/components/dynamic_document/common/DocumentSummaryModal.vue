<template>
  <div
    v-if="isVisible && document"
    class="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm"
    @click.self="$emit('close')"
  >
    <div class="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4">
      <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h2 class="text-sm font-semibold text-gray-900">
          Información clave del documento
        </h2>
        <button
          type="button"
          class="p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          @click="$emit('close')"
        >
          <svg class="h-5 w-5" viewBox="0 0 20 20" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M6 6l8 8M6 14L14 6" />
          </svg>
        </button>
      </div>

      <div class="px-4 py-4 space-y-4 text-sm text-gray-800 max-h-[70vh] overflow-y-auto">
        <!-- Usuario / Contraparte -->
        <div v-if="summaryCounterparty">
          <div class="text-[11px] font-medium uppercase tracking-wide text-gray-400 mb-0.5">
            Usuario / Contraparte
          </div>
          <div class="text-gray-900 break-words">
            {{ summaryCounterparty }}
          </div>
        </div>

        <!-- Objeto -->
        <div v-if="document.summary_object">
          <div class="text-[11px] font-medium uppercase tracking-wide text-gray-400 mb-0.5">
            Objeto
          </div>
          <div class="text-gray-900 whitespace-pre-line">
            {{ document.summary_object }}
          </div>
        </div>

        <!-- Valor -->
        <div v-if="summaryValue">
          <div class="text-[11px] font-medium uppercase tracking-wide text-gray-400 mb-0.5">
            Valor
          </div>
          <div class="text-gray-900 font-medium text-base">
            {{ summaryValue }}
          </div>
        </div>

        <!-- Plazo -->
        <div v-if="document.summary_term">
          <div class="text-[11px] font-medium uppercase tracking-wide text-gray-400 mb-0.5">
            Plazo
          </div>
          <div class="text-gray-900">
            {{ document.summary_term }}
          </div>
        </div>

        <!-- Fechas -->
        <div v-if="hasAnyDate">
          <div class="text-[11px] font-medium uppercase tracking-wide text-gray-400 mb-0.5">
            Fechas
          </div>
          <div class="space-y-1 text-gray-900">
            <div v-if="document.summary_subscription_date">
              <span class="font-medium">Suscripción:</span>
              <span class="ml-1">{{ formatDate(document.summary_subscription_date) }}</span>
            </div>
            <div v-if="document.summary_start_date || document.summary_end_date">
              <span class="font-medium">Vigencia:</span>
              <span class="ml-1">
                <span v-if="document.summary_start_date">{{ formatDate(document.summary_start_date) }}</span>
                <span v-if="document.summary_start_date && document.summary_end_date"> → </span>
                <span v-if="document.summary_end_date">{{ formatDate(document.summary_end_date) }}</span>
              </span>
            </div>
          </div>
        </div>

        <div v-if="!hasAnySummary" class="text-gray-400 text-sm">
          Este documento aún no tiene campos clasificados para mostrar.
        </div>
      </div>

      <div class="px-4 py-3 border-t border-gray-100 flex justify-end">
        <button
          type="button"
          class="inline-flex items-center px-3 py-1.5 rounded-md text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200"
          @click="$emit('close')"
        >
          Cerrar
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

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

const emit = defineEmits(['close']);

const summaryCounterparty = computed(() => {
  if (!props.document) return '';
  return props.document.summary_counterparty || '';
});

const summaryValue = computed(() => {
  if (!props.document || !props.document.summary_value) return '';
  
  const value = props.document.summary_value;
  const currency = props.document.summary_value_currency || '';
  
  // Format number with thousand separators
  const formattedNumber = new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
  
  // Add currency symbol
  if (currency === 'USD') {
    return `USD $${formattedNumber}`;
  } else if (currency === 'EUR') {
    return `€${formattedNumber}`;
  } else if (currency === 'COP') {
    return `$${formattedNumber} COP`;
  } else if (currency) {
    return `${currency} ${formattedNumber}`;
  }
  
  return `$${formattedNumber}`;
});

const hasAnyDate = computed(() => {
  if (!props.document) return false;
  return Boolean(
    props.document.summary_subscription_date ||
    props.document.summary_start_date ||
    props.document.summary_end_date
  );
});

const hasAnySummary = computed(() => {
  if (!props.document) return false;
  return Boolean(
    summaryCounterparty.value ||
    props.document.summary_object ||
    summaryValue.value ||
    props.document.summary_term ||
    hasAnyDate.value
  );
});

const formatDate = (value) => {
  if (!value) return '';
  if (typeof value === 'string') {
    return value.split('T')[0];
  }
  return value;
};
</script>
