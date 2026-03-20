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
  </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  syncStatus: {
    type: Object,
    default: null,
  },
});

const hoursSinceSync = computed(() => {
  if (!props.syncStatus?.last_success?.finished_at) return Infinity;
  const diff = Date.now() - new Date(props.syncStatus.last_success.finished_at).getTime();
  return diff / (1000 * 60 * 60);
});

const statusColor = computed(() => {
  if (hoursSinceSync.value < 24) return "bg-green-400";
  if (hoursSinceSync.value < 48) return "bg-yellow-400";
  return "bg-red-400";
});

const syncText = computed(() => {
  if (!props.syncStatus) return "Sin sincronización";
  const total = props.syncStatus.total_processes || 0;
  return `${total} procesos`;
});

const relativeTime = computed(() => {
  if (!props.syncStatus?.last_success?.finished_at) return null;
  const hours = hoursSinceSync.value;
  if (hours < 1) return "hace menos de 1h";
  if (hours < 24) return `hace ${Math.floor(hours)}h`;
  const days = Math.floor(hours / 24);
  return `hace ${days}d`;
});

const tooltipText = computed(() => {
  if (!props.syncStatus?.last_success) return "No se ha realizado sincronización";
  const dt = new Date(props.syncStatus.last_success.finished_at);
  return `Última sincronización: ${dt.toLocaleString("es-CO")}`;
});
</script>
