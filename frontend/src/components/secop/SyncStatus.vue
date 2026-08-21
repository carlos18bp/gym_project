<template>
  <div
    class="inline-flex items-center gap-2 rounded-lg bg-white/80 px-3 py-1.5 text-xs shadow-sm ring-1 ring-gray-200"
    data-testid="sync-status"
    :title="tooltipText"
  >
    <span
      :class="['h-2 w-2 rounded-full shrink-0', statusColor]"
      data-testid="sync-status-dot"
    ></span>
    <span class="text-gray-600 font-medium" data-testid="sync-status-text">
      {{ syncText }}
    </span>
    <span v-if="relativeTime" class="text-gray-400">·</span>
    <span v-if="relativeTime" class="text-gray-400">{{ relativeTime }}</span>
    <button
      v-if="canTrigger"
      @click.stop="handleTriggerSync"
      :disabled="isSyncing"
      data-testid="sync-trigger-btn"
      :title="isSyncing ? 'Sincronizando...' : 'Sincronizar ahora'"
      :class="[
        'ml-1 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium transition-colors',
        isSyncing
          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
          : 'bg-secondary/10 text-secondary hover:bg-secondary/20'
      ]"
    >
      <ArrowPathIcon :class="['h-3 w-3', isSyncing ? 'animate-spin' : '']" />
      <span class="hidden sm:inline">{{ isSyncing ? 'Sincronizando' : 'Sincronizar' }}</span>
    </button>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { ArrowPathIcon } from "@heroicons/vue/24/outline";

const props = defineProps({
  syncStatus: {
    type: Object,
    default: null,
  },
  syncing: {
    type: Boolean,
    default: false,
  },
  canTrigger: {
    type: Boolean,
    default: true,
  },
});

const emit = defineEmits(["trigger-sync"]);

const latestSync = computed(() => props.syncStatus?.recent?.[0] || null);
const latestStatus = computed(() => latestSync.value?.status || null);
const isSyncing = computed(() => (
  props.syncing || latestStatus.value === "IN_PROGRESS"
));

function handleTriggerSync() {
  if (isSyncing.value) return;
  emit("trigger-sync");
}

const hoursSinceSync = computed(() => {
  if (!props.syncStatus?.last_success?.finished_at) return Infinity;
  const diff = Date.now() - new Date(props.syncStatus.last_success.finished_at).getTime();
  return diff / (1000 * 60 * 60);
});

const statusColor = computed(() => {
  if (isSyncing.value) return "bg-blue-400";
  if (latestStatus.value === "FAILED") return "bg-red-500";
  if (hoursSinceSync.value < 24) return "bg-green-400";
  if (hoursSinceSync.value < 48) return "bg-yellow-400";
  return "bg-red-400";
});

const syncText = computed(() => {
  if (!props.syncStatus) return "Sin sincronización";
  if (isSyncing.value) return "Sincronizando";
  if (latestStatus.value === "FAILED") return "Error de sincronización";
  const total = props.syncStatus.total_processes || 0;
  return `${total} procesos`;
});

const relativeTime = computed(() => {
  if (!props.syncStatus?.last_success?.finished_at) return null;
  const hours = hoursSinceSync.value;
  let relative;
  if (hours < 1) relative = "hace menos de 1h";
  else if (hours < 24) relative = `hace ${Math.floor(hours)}h`;
  else relative = `hace ${Math.floor(hours / 24)}d`;
  return latestStatus.value === "FAILED" ? `último éxito ${relative}` : relative;
});

const tooltipText = computed(() => {
  if (isSyncing.value) return "Sincronización de SECOP en curso";
  if (latestStatus.value === "FAILED") {
    if (!props.syncStatus?.last_success?.finished_at) {
      return "La última sincronización falló; todavía no hay una ejecución exitosa";
    }
    const lastSuccess = new Date(props.syncStatus.last_success.finished_at);
    return `La última sincronización falló. Último éxito: ${lastSuccess.toLocaleString("es-CO")}`;
  }
  if (!props.syncStatus?.last_success) return "No se ha realizado sincronización";
  const dt = new Date(props.syncStatus.last_success.finished_at);
  return `Última sincronización: ${dt.toLocaleString("es-CO")}`;
});
</script>
