<template>
  <div data-testid="alerts-list">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-base font-semibold text-primary">Mis Alertas</h2>
        <p class="text-sm text-gray-500 mt-0.5">Recibe notificaciones cuando se publiquen procesos que coincidan.</p>
      </div>
      <button
        @click="$emit('create')"
        data-testid="alert-create-btn"
        class="inline-flex items-center gap-2 rounded-lg bg-secondary px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors"
      >
        <PlusIcon class="h-4 w-4" />
        Nueva Alerta
      </button>
    </div>

    <!-- Empty state -->
    <div
      v-if="!alerts.length"
      data-testid="alerts-empty"
      class="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/50 p-12 text-center"
    >
      <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-50">
        <BellIcon class="h-7 w-7 text-secondary" />
      </div>
      <h3 class="mt-4 text-base font-semibold text-gray-900">Sin alertas configuradas</h3>
      <p class="mt-2 text-sm text-gray-500">Crea tu primera alerta para monitorear oportunidades automáticamente.</p>
      <button
        @click="$emit('create')"
        class="mt-5 inline-flex items-center gap-2 rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors"
      >
        <PlusIcon class="h-4 w-4" />
        Crear Alerta
      </button>
    </div>

    <!-- Alerts list -->
    <div v-else class="space-y-3">
      <div
        v-for="alert in alerts"
        :key="alert.id"
        :data-testid="`alert-card-${alert.id}`"
        class="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 p-5 hover:shadow-md transition-shadow"
      >
        <div class="flex items-start justify-between gap-4">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-2 flex-wrap">
              <h3 class="text-sm font-semibold text-primary">{{ alert.name }}</h3>
              <span
                :data-testid="`alert-status-${alert.id}`"
                :class="[
                  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
                  alert.is_active
                    ? 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20'
                    : 'bg-gray-50 text-gray-600 ring-1 ring-inset ring-gray-500/20'
                ]"
              >
                <span :class="['h-1.5 w-1.5 rounded-full', alert.is_active ? 'bg-green-500' : 'bg-gray-400']"></span>
                {{ alert.is_active ? 'Activa' : 'Pausada' }}
              </span>
              <span class="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20">
                {{ frequencyLabel(alert.frequency) }}
              </span>
            </div>

            <!-- Criteria chips -->
            <div class="flex flex-wrap gap-1.5 text-xs">
              <span v-if="alert.keywords" class="rounded-md bg-terciary px-2 py-1 text-gray-600">
                Palabras: {{ alert.keywords }}
              </span>
              <span v-if="alert.departments" class="rounded-md bg-terciary px-2 py-1 text-gray-600">
                Dptos: {{ alert.departments }}
              </span>
              <span v-if="alert.entities" class="rounded-md bg-terciary px-2 py-1 text-gray-600">
                Entidades: {{ truncate(alert.entities, 40) }}
              </span>
              <span v-if="alert.min_budget || alert.max_budget" class="rounded-md bg-terciary px-2 py-1 text-gray-600">
                Presupuesto: {{ budgetRange(alert) }}
              </span>
              <span v-if="alert.procurement_methods" class="rounded-md bg-terciary px-2 py-1 text-gray-600">
                Modalidad: {{ alert.procurement_methods }}
              </span>
            </div>

            <p class="text-xs text-gray-400 mt-2.5">
              {{ alert.notification_count || 0 }} notificaciones generadas
            </p>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-0.5 shrink-0">
            <button
              @click="$emit('toggle', alert.id)"
              :data-testid="`alert-toggle-${alert.id}`"
              :title="alert.is_active ? 'Pausar' : 'Activar'"
              class="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            >
              <component :is="alert.is_active ? PauseIcon : PlayIcon" class="h-4 w-4" />
            </button>
            <button
              @click="$emit('edit', alert)"
              :data-testid="`alert-edit-${alert.id}`"
              title="Editar"
              class="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            >
              <PencilIcon class="h-4 w-4" />
            </button>
            <button
              @click="$emit('delete', alert.id)"
              :data-testid="`alert-delete-${alert.id}`"
              title="Eliminar"
              class="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
            >
              <TrashIcon class="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import {
  PlusIcon,
  BellIcon,
  PencilIcon,
  TrashIcon,
  PauseIcon,
  PlayIcon,
} from "@heroicons/vue/24/outline";

defineProps({
  alerts: { type: Array, default: () => [] },
});

defineEmits(["create", "edit", "toggle", "delete"]);

function frequencyLabel(freq) {
  const labels = { IMMEDIATE: "Inmediata", DAILY: "Diaria", WEEKLY: "Semanal" };
  return labels[freq] || freq;
}

function truncate(str, maxLen) {
  if (!str) return "";
  return str.length > maxLen ? str.substring(0, maxLen) + "..." : str;
}

function budgetRange(alert) {
  const parts = [];
  if (alert.min_budget) parts.push(`Min: $${Number(alert.min_budget).toLocaleString()}`);
  if (alert.max_budget) parts.push(`Max: $${Number(alert.max_budget).toLocaleString()}`);
  return parts.join(" - ");
}
</script>
