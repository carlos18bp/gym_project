<template>
  <div class="fixed inset-0 z-50 overflow-y-auto" data-testid="saved-view-modal">
    <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
      <!-- Backdrop -->
      <div
        class="fixed inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity"
        @click="$emit('close')"
      ></div>

      <!-- Modal -->
      <div class="relative transform overflow-hidden rounded-xl bg-white text-left shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
        <div class="px-6 pb-5 pt-6">
          <h3 class="text-lg font-semibold text-primary mb-1" data-testid="saved-view-modal-title">
            Guardar Vista
          </h3>
          <p class="text-sm text-gray-500 mb-5">
            Selecciona los filtros que deseas incluir en esta vista guardada.
          </p>

          <!-- View name -->
          <div class="mb-5">
            <label class="block text-sm font-medium text-gray-700 mb-2">Nombre de la vista</label>
            <input
              v-model="viewName"
              type="text"
              placeholder="Ej: Contratos Bogotá"
              data-testid="saved-view-modal-name"
              class="w-full rounded-lg border-gray-300 text-sm shadow-sm focus:ring-2 focus:ring-secondary focus:border-secondary placeholder:text-gray-400"
              @keyup.enter="handleSave"
            />
          </div>

          <!-- Filter selection -->
          <div class="mb-2">
            <label class="block text-sm font-medium text-gray-700 mb-3">Filtros a incluir</label>

            <div v-if="!availableFilterEntries.length" class="text-sm text-amber-600 bg-amber-50 rounded-lg px-4 py-3">
              No hay filtros activos. Aplica filtros antes de guardar una vista.
            </div>

            <div v-else class="space-y-2 max-h-64 overflow-y-auto pr-1">
              <label
                v-for="entry in availableFilterEntries"
                :key="entry.key"
                :data-testid="`saved-view-filter-${entry.key}`"
                class="flex items-start gap-3 rounded-lg border border-gray-200 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                :class="selectedKeys.has(entry.key) ? 'border-secondary bg-blue-50/50' : ''"
              >
                <input
                  type="checkbox"
                  :checked="selectedKeys.has(entry.key)"
                  @change="toggleFilter(entry.key)"
                  class="mt-0.5 h-4 w-4 rounded border-gray-300 text-secondary focus:ring-secondary"
                />
                <div class="flex-1 min-w-0">
                  <span class="text-sm font-medium text-gray-900">{{ entry.label }}</span>
                  <p class="text-xs text-gray-500 mt-0.5 break-words">{{ entry.displayValue }}</p>
                </div>
              </label>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="border-t border-gray-100 bg-gray-50 px-6 py-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button
            @click="$emit('close')"
            data-testid="saved-view-modal-cancel"
            class="inline-flex justify-center rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            @click="handleSave"
            :disabled="!canSave"
            data-testid="saved-view-modal-save"
            class="inline-flex justify-center rounded-lg bg-secondary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from "vue";

const props = defineProps({
  currentFilters: { type: Object, default: () => ({}) },
});

const emit = defineEmits(["save", "close"]);

const viewName = ref("");
const selectedKeys = ref(new Set());

const filterLabels = {
  search: "Búsqueda",
  department: "Departamento",
  procurement_method: "Modalidad",
  status: "Estado",
  entity_name: "Entidad",
  unspsc_code: "Código UNSPSC",
  keywords: "Palabras clave",
  min_budget: "Presupuesto mínimo",
  max_budget: "Presupuesto máximo",
  publication_date_from: "Publicación desde",
  publication_date_to: "Publicación hasta",
  closing_date_from: "Cierre desde",
  closing_date_to: "Cierre hasta",
};

const availableFilterEntries = computed(() => {
  const entries = [];
  for (const [key, value] of Object.entries(props.currentFilters)) {
    if (!value) continue;
    entries.push({
      key,
      label: filterLabels[key] || key,
      displayValue: String(value),
      value,
    });
  }
  return entries;
});

// Pre-select all active filters on mount
(() => {
  for (const [key, value] of Object.entries(props.currentFilters)) {
    if (value) selectedKeys.value.add(key);
  }
})();

function toggleFilter(key) {
  if (selectedKeys.value.has(key)) {
    selectedKeys.value.delete(key);
  } else {
    selectedKeys.value.add(key);
  }
  // Force reactivity on the Set
  selectedKeys.value = new Set(selectedKeys.value);
}

const canSave = computed(() => {
  return viewName.value.trim() && selectedKeys.value.size > 0;
});

function handleSave() {
  if (!canSave.value) return;
  const selectedFilters = {};
  for (const key of selectedKeys.value) {
    selectedFilters[key] = props.currentFilters[key];
  }
  emit("save", {
    name: viewName.value.trim(),
    filters: selectedFilters,
  });
}
</script>
