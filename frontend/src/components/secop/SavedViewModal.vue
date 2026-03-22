<template>
  <div class="fixed inset-0 z-50 overflow-y-auto" data-testid="saved-view-modal">
    <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
      <!-- Backdrop -->
      <div
        class="fixed inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity"
        @click="$emit('close')"
      ></div>

      <!-- Modal -->
      <div class="relative transform overflow-hidden rounded-xl bg-white text-left shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-2xl">
        <div class="px-6 pb-5 pt-6 max-h-[80vh] overflow-y-auto">
          <h3 class="text-lg font-semibold text-primary mb-1" data-testid="saved-view-modal-title">
            {{ isEditing ? 'Editar Vista' : 'Guardar Vista' }}
          </h3>
          <p class="text-sm text-gray-500 mb-5">
            {{ isEditing
              ? 'Modifica el nombre y los filtros de esta vista guardada.'
              : 'Define el nombre y selecciona los filtros para esta vista.'
            }}
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
            />
          </div>

          <!-- Filter controls -->
          <div class="mb-2">
            <label class="block text-sm font-medium text-gray-700 mb-3">Filtros</label>

            <!-- Search -->
            <div class="mb-3">
              <label class="block text-xs font-medium text-gray-500 mb-1.5">Búsqueda</label>
              <input
                v-model="localFilters.search"
                type="text"
                placeholder="Término de búsqueda..."
                data-testid="saved-view-filter-search"
                class="w-full rounded-lg border-gray-300 text-sm shadow-sm focus:ring-2 focus:ring-secondary focus:border-secondary placeholder:text-gray-400"
              />
            </div>

            <!-- Keywords -->
            <div class="mb-3">
              <label class="block text-xs font-medium text-gray-500 mb-1.5">Palabras clave</label>
              <input
                v-model="localFilters.keywords"
                type="text"
                placeholder="Ej: prestación servicios enfermería"
                data-testid="saved-view-filter-keywords"
                class="w-full rounded-lg border-gray-300 text-sm shadow-sm focus:ring-2 focus:ring-secondary focus:border-secondary placeholder:text-gray-400"
              />
            </div>

            <!-- Multi-select filters -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label class="block text-xs font-medium text-gray-500 mb-1.5">Departamento</label>
                <MultiSelectDropdown
                  v-model="localFilters.department"
                  :options="availableFilters.departments || []"
                  placeholder="Departamento"
                  data-testid="saved-view-filter-department"
                />
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-500 mb-1.5">Modalidad</label>
                <MultiSelectDropdown
                  v-model="localFilters.procurement_method"
                  :options="availableFilters.procurement_methods || []"
                  placeholder="Modalidad"
                  data-testid="saved-view-filter-procurement"
                />
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-500 mb-1.5">Estado</label>
                <MultiSelectDropdown
                  v-model="localFilters.status"
                  :options="availableFilters.statuses || []"
                  placeholder="Estado"
                  data-testid="saved-view-filter-status"
                />
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-500 mb-1.5">Entidad</label>
                <MultiSelectDropdown
                  v-model="localFilters.entity_name"
                  :options="availableFilters.entity_names || []"
                  placeholder="Entidad"
                  data-testid="saved-view-filter-entity"
                />
              </div>
            </div>

            <!-- UNSPSC -->
            <div class="mb-3">
              <label class="block text-xs font-medium text-gray-500 mb-1.5">Código UNSPSC</label>
              <input
                v-model="localFilters.unspsc_code"
                type="text"
                placeholder="Código UNSPSC"
                data-testid="saved-view-filter-unspsc"
                class="w-full rounded-lg border-gray-300 text-sm shadow-sm focus:ring-2 focus:ring-secondary focus:border-secondary placeholder:text-gray-400"
              />
            </div>

            <!-- Budget range -->
            <div class="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label class="block text-xs font-medium text-gray-500 mb-1.5">Presupuesto mínimo (COP)</label>
                <input
                  v-model="localFilters.min_budget"
                  type="number"
                  placeholder="0"
                  data-testid="saved-view-filter-min-budget"
                  class="w-full rounded-lg border-gray-300 text-sm shadow-sm focus:ring-2 focus:ring-secondary focus:border-secondary placeholder:text-gray-400"
                />
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-500 mb-1.5">Presupuesto máximo (COP)</label>
                <input
                  v-model="localFilters.max_budget"
                  type="number"
                  placeholder="Sin límite"
                  data-testid="saved-view-filter-max-budget"
                  class="w-full rounded-lg border-gray-300 text-sm shadow-sm focus:ring-2 focus:ring-secondary focus:border-secondary placeholder:text-gray-400"
                />
              </div>
            </div>

            <!-- Publication date range -->
            <div class="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label class="block text-xs font-medium text-gray-500 mb-1.5">Publicación desde</label>
                <input
                  v-model="localFilters.publication_date_from"
                  type="date"
                  data-testid="saved-view-filter-pub-from"
                  class="w-full rounded-lg border-gray-300 text-sm shadow-sm focus:ring-2 focus:ring-secondary focus:border-secondary"
                />
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-500 mb-1.5">Publicación hasta</label>
                <input
                  v-model="localFilters.publication_date_to"
                  type="date"
                  data-testid="saved-view-filter-pub-to"
                  class="w-full rounded-lg border-gray-300 text-sm shadow-sm focus:ring-2 focus:ring-secondary focus:border-secondary"
                />
              </div>
            </div>

            <!-- Closing date range -->
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-medium text-gray-500 mb-1.5">Cierre desde</label>
                <input
                  v-model="localFilters.closing_date_from"
                  type="date"
                  data-testid="saved-view-filter-close-from"
                  class="w-full rounded-lg border-gray-300 text-sm shadow-sm focus:ring-2 focus:ring-secondary focus:border-secondary"
                />
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-500 mb-1.5">Cierre hasta</label>
                <input
                  v-model="localFilters.closing_date_to"
                  type="date"
                  data-testid="saved-view-filter-close-to"
                  class="w-full rounded-lg border-gray-300 text-sm shadow-sm focus:ring-2 focus:ring-secondary focus:border-secondary"
                />
              </div>
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
            {{ isEditing ? 'Actualizar' : 'Guardar' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, reactive } from "vue";
import MultiSelectDropdown from "@/components/secop/MultiSelectDropdown.vue";

const props = defineProps({
  currentFilters: { type: Object, default: () => ({}) },
  existingView: { type: Object, default: null },
  availableFilters: { type: Object, default: () => ({}) },
});

const emit = defineEmits(["save", "update", "close"]);

const isEditing = computed(() => !!props.existingView);
const viewName = ref(props.existingView?.name || "");

// Multi-value filter keys stored as CSV strings
const CSV_KEYS = ['department', 'procurement_method', 'status', 'entity_name'];

function csvToArray(val) {
  if (!val) return [];
  return String(val).split(',').map((s) => s.trim()).filter(Boolean);
}

function arrayToCsv(arr) {
  if (!arr || !arr.length) return '';
  return arr.join(',');
}

function initFilters() {
  const source = isEditing.value
    ? { ...props.currentFilters, ...props.existingView.filters }
    : { ...props.currentFilters };

  return reactive({
    search: source.search || '',
    keywords: source.keywords || '',
    department: csvToArray(source.department),
    procurement_method: csvToArray(source.procurement_method),
    status: csvToArray(source.status),
    entity_name: csvToArray(source.entity_name),
    unspsc_code: source.unspsc_code || '',
    min_budget: source.min_budget || '',
    max_budget: source.max_budget || '',
    publication_date_from: source.publication_date_from || '',
    publication_date_to: source.publication_date_to || '',
    closing_date_from: source.closing_date_from || '',
    closing_date_to: source.closing_date_to || '',
  });
}

const localFilters = initFilters();

function buildOutputFilters() {
  const out = {};
  if (localFilters.search) out.search = localFilters.search;
  if (localFilters.keywords) out.keywords = localFilters.keywords;

  for (const key of CSV_KEYS) {
    const csv = arrayToCsv(localFilters[key]);
    if (csv) out[key] = csv;
  }

  if (localFilters.unspsc_code) out.unspsc_code = localFilters.unspsc_code;
  if (localFilters.min_budget) out.min_budget = localFilters.min_budget;
  if (localFilters.max_budget) out.max_budget = localFilters.max_budget;
  if (localFilters.publication_date_from) out.publication_date_from = localFilters.publication_date_from;
  if (localFilters.publication_date_to) out.publication_date_to = localFilters.publication_date_to;
  if (localFilters.closing_date_from) out.closing_date_from = localFilters.closing_date_from;
  if (localFilters.closing_date_to) out.closing_date_to = localFilters.closing_date_to;
  return out;
}

const hasAnyFilter = computed(() => {
  return localFilters.search || localFilters.keywords
    || localFilters.department.length || localFilters.procurement_method.length
    || localFilters.status.length || localFilters.entity_name.length
    || localFilters.unspsc_code || localFilters.min_budget || localFilters.max_budget
    || localFilters.publication_date_from || localFilters.publication_date_to
    || localFilters.closing_date_from || localFilters.closing_date_to;
});

const canSave = computed(() => {
  return viewName.value.trim().length > 0 && hasAnyFilter.value;
});

function handleSave() {
  if (!canSave.value) return;
  const filters = buildOutputFilters();

  if (isEditing.value) {
    emit("update", {
      id: props.existingView.id,
      name: viewName.value.trim(),
      filters,
    });
  } else {
    emit("save", {
      name: viewName.value.trim(),
      filters,
    });
  }
}
</script>
