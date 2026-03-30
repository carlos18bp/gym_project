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
      @click.stop="handleTriggerSync"
      :disabled="syncing"
      data-testid="sync-trigger-btn"
      :title="syncing ? 'Sincronizando...' : 'Sincronizar ahora'"
      :class="[
        'ml-1 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium transition-colors',
        syncing
          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
          : 'bg-secondary/10 text-secondary hover:bg-secondary/20'
      ]"
    >
      <ArrowPathIcon :class="['h-3 w-3', syncing ? 'animate-spin' : '']" />
      <span class="hidden sm:inline">{{ syncing ? 'Sincronizando' : 'Sincronizar' }}</span>
    </button>
  </div>
</template>

<script setup>
import { computed, ref } from "vue";
import { ArrowPathIcon } from "@heroicons/vue/24/outline";

const props = defineProps({
  syncStatus: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits(["trigger-sync"]);

const syncing = ref(false);

async function handleTriggerSync() {
  if (syncing.value) return;
  syncing.value = true;
  emit("trigger-sync");
  // Auto-reset after 30s (sync runs in background)
  setTimeout(() => { syncing.value = false; }, 30000);
}

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
