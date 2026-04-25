<template>
  <div class="fixed inset-0 z-50 overflow-y-auto" data-testid="alert-form-modal">
    <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
      <!-- Backdrop -->
      <div
        class="fixed inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity"
        @click="$emit('close')"
      ></div>

      <!-- Modal -->
      <div class="relative transform overflow-hidden rounded-xl bg-white text-left shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-2xl">
        <div class="max-h-[80vh] overflow-y-auto px-4 sm:px-6 pb-5 pt-6">
          <div class="flex items-center gap-3 mb-5">
            <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
              <BellAlertIcon class="h-5 w-5 text-secondary" />
            </div>
            <div>
              <h3 class="text-lg font-semibold text-primary" data-testid="alert-form-title">
                {{ alert ? 'Editar Alerta' : 'Nueva Alerta' }}
              </h3>
              <p class="text-xs text-gray-500">Recibe notificaciones cuando se publiquen procesos que coincidan.</p>
            </div>
          </div>

          <!-- Name -->
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1">Nombre de la alerta <span class="text-red-500">*</span></label>
            <input
              v-model="form.name"
              type="text"
              data-testid="alert-name"
              class="w-full rounded-lg border-gray-300 text-sm shadow-sm focus:ring-2 focus:ring-secondary focus:border-secondary placeholder:text-gray-400"
              placeholder="Ej: Obras civiles en Antioquia"
            />
          </div>

          <!-- Keywords (tag system) -->
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1">Palabras clave</label>
            <input
              v-model="keywordInput"
              type="text"
              data-testid="alert-keywords"
              class="w-full rounded-lg border-gray-300 text-sm shadow-sm focus:ring-2 focus:ring-secondary focus:border-secondary placeholder:text-gray-400"
              placeholder="Escribe y presiona Enter para agregar como etiqueta"
              @keydown.enter.prevent="addKeywordTag"
            />
            <div v-if="keywordTags.length" class="flex flex-wrap gap-1.5 mt-2">
              <span
                v-for="(tag, idx) in keywordTags"
                :key="idx"
                class="inline-flex items-center gap-1 rounded-full bg-secondary/10 px-2.5 py-1 text-xs font-medium text-secondary"
              >
                <TagIcon class="h-3 w-3" />
                {{ tag }}
                <button
                  type="button"
                  class="ml-0.5 rounded-full p-0.5 hover:bg-secondary/20 transition-colors"
                  data-testid="alert-keyword-tag-remove"
                  @click="removeKeywordTag(idx)"
                >
                  <XMarkIcon class="h-3 w-3" />
                </button>
              </span>
            </div>
            <p class="text-xs text-gray-400 mt-1">Se buscará en la descripción y nombre del proceso.</p>
          </div>

          <!-- Multi-select filters -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <!-- Department -->
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1.5">Departamento</label>
              <MultiSelectDropdown
                v-model="localFilters.department"
                :options="availableFilters.departments || []"
                placeholder="Departamento"
                data-testid="alert-departments"
              />
            </div>

            <!-- Procurement method -->
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1.5">Modalidad</label>
              <MultiSelectDropdown
                v-model="localFilters.procurement_method"
                :options="availableFilters.procurement_methods || []"
                placeholder="Modalidad"
                data-testid="alert-procurement-methods"
              />
            </div>

            <!-- Entity -->
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1.5">Entidad</label>
              <MultiSelectDropdown
                v-model="localFilters.entity_name"
                :options="availableFilters.entity_names || []"
                placeholder="Entidad"
                data-testid="alert-entities"
              />
            </div>

            <!-- UNSPSC Code -->
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1.5">Codigo UNSPSC</label>
              <MultiSelectDropdown
                v-model="localFilters.unspsc_code"
                :options="availableFilters.unspsc_codes || []"
                placeholder="Codigo UNSPSC"
                data-testid="alert-unspsc"
              />
            </div>
          </div>

          <!-- Budget range -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1.5">Presupuesto min. (COP)</label>
              <div class="relative">
                <span class="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 text-xs">COP</span>
                <input
                  v-model="form.min_budget"
                  type="number"
                  data-testid="alert-min-budget"
                  class="w-full rounded-lg border-gray-300 pl-11 text-sm shadow-sm focus:ring-2 focus:ring-secondary focus:border-secondary placeholder:text-gray-400"
                  placeholder="0"
                />
              </div>
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1.5">Presupuesto max. (COP)</label>
              <div class="relative">
                <span class="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 text-xs">COP</span>
                <input
                  v-model="form.max_budget"
                  type="number"
                  data-testid="alert-max-budget"
                  class="w-full rounded-lg border-gray-300 pl-11 text-sm shadow-sm focus:ring-2 focus:ring-secondary focus:border-secondary placeholder:text-gray-400"
                  placeholder="Sin limite"
                />
              </div>
            </div>
          </div>

          <!-- Frequency -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Frecuencia de notificacion</label>
            <div class="grid grid-cols-3 gap-2">
              <button
                v-for="option in frequencyOptions"
                :key="option.value"
                @click="form.frequency = option.value"
                :data-testid="`alert-frequency-${option.value}`"
                :class="[
                  'flex flex-col items-center gap-1 rounded-lg px-3 py-3 text-xs font-medium border-2 transition-all',
                  form.frequency === option.value
                    ? 'border-secondary bg-blue-50 text-secondary'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                ]"
              >
                <component :is="option.icon" class="h-5 w-5" />
                {{ option.label }}
              </button>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="border-t border-gray-100 bg-gray-50 px-4 sm:px-6 py-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button
            @click="$emit('close')"
            data-testid="alert-cancel"
            class="inline-flex justify-center rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            @click="handleSave"
            :disabled="!form.name"
            data-testid="alert-save"
            class="inline-flex justify-center rounded-lg bg-secondary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {{ alert ? 'Actualizar' : 'Crear Alerta' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from "vue";
import { BellAlertIcon, BoltIcon, ClockIcon, CalendarDaysIcon, TagIcon, XMarkIcon } from "@heroicons/vue/24/outline";
import MultiSelectDropdown from "@/components/secop/MultiSelectDropdown.vue";

const props = defineProps({
  alert: { type: Object, default: null },
  availableFilters: { type: Object, default: () => ({}) },
  prefillFilters: { type: Object, default: null },
});

const emit = defineEmits(["save", "close"]);

const frequencyOptions = [
  { value: "IMMEDIATE", label: "Inmediata", icon: BoltIcon },
  { value: "DAILY", label: "Diaria", icon: ClockIcon },
  { value: "WEEKLY", label: "Semanal", icon: CalendarDaysIcon },
];

function csvToArray(val) {
  if (!val) return [];
  return String(val).split(',').map(s => s.trim()).filter(Boolean);
}

function arrayToCsv(arr) {
  if (!arr || !arr.length) return '';
  return arr.join(',');
}

// Initialize from existing alert or prefilled saved view filters
const source = props.alert || {};
const prefill = props.prefillFilters || {};

const form = ref({
  name: source.name || prefill.name || "",
  min_budget: source.min_budget || prefill.min_budget || "",
  max_budget: source.max_budget || prefill.max_budget || "",
  frequency: source.frequency || "DAILY",
});

// Keyword tag system
const keywordInput = ref('');
const keywordTags = ref(
  source.keywords
    ? csvToArray(source.keywords)
    : prefill.keywords
      ? String(prefill.keywords).split('|').map(s => s.trim()).filter(Boolean)
      : []
);

function addKeywordTag() {
  const tag = keywordInput.value.trim();
  if (tag && !keywordTags.value.includes(tag)) {
    keywordTags.value.push(tag);
  }
  keywordInput.value = '';
}

function removeKeywordTag(idx) {
  keywordTags.value.splice(idx, 1);
}

// Multi-select filters as arrays
const localFilters = reactive({
  department: csvToArray(source.departments || prefill.department),
  procurement_method: csvToArray(source.procurement_methods || prefill.procurement_method),
  entity_name: csvToArray(source.entities || prefill.entity_name),
  unspsc_code: csvToArray(source.unspsc_code || prefill.unspsc_code),
});

function handleSave() {
  const allKeywords = [...keywordTags.value];
  if (keywordInput.value.trim()) allKeywords.push(keywordInput.value.trim());

  const data = {
    name: form.value.name,
    keywords: allKeywords.join(','),
    departments: arrayToCsv(localFilters.department),
    entities: arrayToCsv(localFilters.entity_name),
    procurement_methods: arrayToCsv(localFilters.procurement_method),
    unspsc_code: arrayToCsv(localFilters.unspsc_code),
    min_budget: form.value.min_budget || null,
    max_budget: form.value.max_budget || null,
    frequency: form.value.frequency,
  };
  emit("save", data);
}
</script>
