<template>
  <div data-testid="saved-views-list">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-base font-semibold text-primary">Vistas Guardadas</h2>
        <p class="text-sm text-gray-500">Guarda combinaciones de filtros para acceso rápido.</p>
      </div>
      <button
        @click="showSaveForm = true"
        data-testid="saved-views-create-btn"
        class="inline-flex items-center gap-2 rounded-lg bg-secondary px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors"
      >
        <PlusIcon class="h-4 w-4" />
        Guardar Vista Actual
      </button>
    </div>

    <!-- Save form -->
    <div v-if="showSaveForm" class="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 p-5 mb-6" data-testid="saved-views-form">
      <h3 class="text-sm font-semibold text-gray-900 mb-3">Nueva Vista Guardada</h3>
      <div class="flex flex-col sm:flex-row gap-3">
        <input
          v-model="newViewName"
          type="text"
          placeholder="Nombre de la vista (ej: Contratos Bogotá)"
          data-testid="saved-views-name-input"
          class="flex-1 rounded-lg border-gray-300 text-sm shadow-sm focus:ring-2 focus:ring-secondary focus:border-secondary placeholder:text-gray-400"
          @keyup.enter="handleSave"
        />
        <div class="flex gap-2">
          <button
            @click="handleSave"
            :disabled="!newViewName.trim()"
            :class="[
              'px-4 py-2 rounded-lg text-sm font-medium',
              newViewName.trim()
                ? 'bg-secondary text-white hover:bg-blue-700 transition-colors'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            ]"
          >
            Guardar
          </button>
          <button
            @click="showSaveForm = false; newViewName = ''"
            class="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
      <p v-if="hasActiveFilters" class="text-xs text-gray-500 mt-2">
        Se guardarán los filtros actuales aplicados.
      </p>
      <p v-else class="text-xs text-amber-600 mt-2">
        No hay filtros aplicados. Aplica filtros antes de guardar una vista.
      </p>
    </div>

    <!-- Empty state -->
    <div
      v-if="!savedViews.length"
      data-testid="saved-views-empty"
      class="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/50 p-12 text-center"
    >
      <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-50">
        <BookmarkIcon class="h-7 w-7 text-secondary" />
      </div>
      <h3 class="mt-4 text-base font-semibold text-gray-900">Sin vistas guardadas</h3>
      <p class="mt-2 text-sm text-gray-500">Aplica filtros y guárdalos como una vista para acceder rápidamente.</p>
    </div>

    <!-- Saved views list -->
    <div v-else class="space-y-3">
      <div
        v-for="view in savedViews"
        :key="view.id"
        :data-testid="`saved-view-card-${view.id}`"
        class="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 p-4 hover:shadow-md transition-shadow"
      >
        <div class="flex items-start justify-between">
          <div class="flex-1 min-w-0">
            <h3 class="text-sm font-semibold text-gray-900 mb-1">{{ view.name }}</h3>

            <!-- Filters summary -->
            <div class="flex flex-wrap gap-2 text-xs text-gray-600">
              <span v-if="view.filters.department" class="rounded-md bg-terciary px-2 py-1">
                Dpto: {{ view.filters.department }}
              </span>
              <span v-if="view.filters.procurement_method" class="rounded-md bg-terciary px-2 py-1">
                Modalidad: {{ view.filters.procurement_method }}
              </span>
              <span v-if="view.filters.status" class="rounded-md bg-terciary px-2 py-1">
                Estado: {{ view.filters.status }}
              </span>
              <span v-if="view.filters.search" class="rounded-md bg-terciary px-2 py-1">
                Búsqueda: "{{ view.filters.search }}"
              </span>
              <span v-if="view.filters.entity_name" class="rounded-md bg-terciary px-2 py-1">
                Entidad: {{ view.filters.entity_name }}
              </span>
              <span v-if="view.filters.unspsc_code" class="rounded-md bg-terciary px-2 py-1">
                UNSPSC: {{ view.filters.unspsc_code }}
              </span>
              <span v-if="view.filters.min_budget || view.filters.max_budget" class="rounded-md bg-terciary px-2 py-1">
                Presupuesto: {{ budgetLabel(view.filters) }}
              </span>
              <span v-if="view.filters.publication_date_from || view.filters.publication_date_to" class="rounded-md bg-terciary px-2 py-1">
                Publicación: {{ view.filters.publication_date_from || '...' }} — {{ view.filters.publication_date_to || '...' }}
              </span>
              <span v-if="view.filters.closing_date_from || view.filters.closing_date_to" class="rounded-md bg-terciary px-2 py-1">
                Cierre: {{ view.filters.closing_date_from || '...' }} — {{ view.filters.closing_date_to || '...' }}
              </span>
            </div>

            <p class="text-xs text-gray-400 mt-2">
              Creada {{ formatDate(view.created_at) }}
            </p>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-1 ml-4">
            <button
              @click="$emit('apply', view)"
              :data-testid="`saved-view-apply-${view.id}`"
              title="Aplicar filtros"
              class="inline-flex items-center gap-1 rounded-lg bg-secondary/10 px-3 py-1.5 text-xs font-medium text-secondary hover:bg-secondary/20 transition-colors"
            >
              <FunnelIcon class="h-3.5 w-3.5" />
              Aplicar
            </button>
            <button
              @click="$emit('delete', view.id)"
              :data-testid="`saved-view-delete-${view.id}`"
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
  BookmarkIcon,
  FunnelIcon,
  TrashIcon,
} from "@heroicons/vue/24/outline";
import { ref } from "vue";

const props = defineProps({
  savedViews: { type: Array, default: () => [] },
  currentFilters: { type: Object, default: () => ({}) },
  hasActiveFilters: { type: Boolean, default: false },
});

const emit = defineEmits(["save", "apply", "delete"]);

const showSaveForm = ref(false);
const newViewName = ref("");

function handleSave() {
  if (!newViewName.value.trim()) return;
  emit("save", {
    name: newViewName.value.trim(),
    filters: { ...props.currentFilters },
  });
  newViewName.value = "";
  showSaveForm.value = false;
}

function budgetLabel(filters) {
  const parts = [];
  if (filters.min_budget) parts.push(`Min: $${Number(filters.min_budget).toLocaleString()}`);
  if (filters.max_budget) parts.push(`Max: $${Number(filters.max_budget).toLocaleString()}`);
  return parts.join(" - ");
}

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("es-CO", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
</script>
