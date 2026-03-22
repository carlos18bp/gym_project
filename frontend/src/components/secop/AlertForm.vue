<template>
  <div class="fixed inset-0 z-50 overflow-y-auto" data-testid="alert-form-modal">
    <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
      <!-- Backdrop -->
      <div
        class="fixed inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity"
        @click="$emit('close')"
      ></div>

      <!-- Modal -->
      <div class="relative transform overflow-hidden rounded-xl bg-white text-left shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
        <div class="max-h-[80vh] overflow-y-auto px-6 pb-5 pt-6">
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
            <label class="block text-sm font-medium text-gray-700 mb-1">Nombre de la alerta</label>
            <input
              v-model="form.name"
              type="text"
              data-testid="alert-name"
              class="w-full rounded-lg border-gray-300 text-sm shadow-sm focus:ring-2 focus:ring-secondary focus:border-secondary placeholder:text-gray-400"
              placeholder="Ej: Obras civiles en Antioquia"
            />
          </div>

          <!-- Keywords -->
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1">Palabras clave</label>
            <input
              v-model="form.keywords"
              type="text"
              data-testid="alert-keywords"
              class="w-full rounded-lg border-gray-300 text-sm shadow-sm focus:ring-2 focus:ring-secondary focus:border-secondary placeholder:text-gray-400"
              placeholder="consultoría, interventoría, asesoría (separadas por coma)"
            />
            <p class="text-xs text-gray-400 mt-1">Se buscará en la descripción del proceso.</p>
          </div>

          <!-- Departments -->
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1">Departamentos</label>
            <input
              v-model="form.departments"
              type="text"
              data-testid="alert-departments"
              class="w-full rounded-lg border-gray-300 text-sm shadow-sm focus:ring-2 focus:ring-secondary focus:border-secondary placeholder:text-gray-400"
              placeholder="Antioquia, Cundinamarca, Bogotá D.C."
            />
          </div>

          <!-- Entities -->
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1">Entidades</label>
            <input
              v-model="form.entities"
              type="text"
              data-testid="alert-entities"
              class="w-full rounded-lg border-gray-300 text-sm shadow-sm focus:ring-2 focus:ring-secondary focus:border-secondary placeholder:text-gray-400"
              placeholder="Nombre parcial de entidades (separadas por coma)"
            />
          </div>

          <!-- Budget range -->
          <div class="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Presupuesto mín.</label>
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
              <label class="block text-sm font-medium text-gray-700 mb-1">Presupuesto máx.</label>
              <div class="relative">
                <span class="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 text-xs">COP</span>
                <input
                  v-model="form.max_budget"
                  type="number"
                  data-testid="alert-max-budget"
                  class="w-full rounded-lg border-gray-300 pl-11 text-sm shadow-sm focus:ring-2 focus:ring-secondary focus:border-secondary placeholder:text-gray-400"
                  placeholder="Sin límite"
                />
              </div>
            </div>
          </div>

          <!-- Procurement methods -->
          <div class="mb-5">
            <label class="block text-sm font-medium text-gray-700 mb-1">Modalidades</label>
            <input
              v-model="form.procurement_methods"
              type="text"
              data-testid="alert-procurement-methods"
              class="w-full rounded-lg border-gray-300 text-sm shadow-sm focus:ring-2 focus:ring-secondary focus:border-secondary placeholder:text-gray-400"
              placeholder="Licitación pública, Concurso de méritos"
            />
          </div>

          <!-- Frequency -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Frecuencia de notificación</label>
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
        <div class="border-t border-gray-100 bg-gray-50 px-6 py-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
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
import { ref } from "vue";
import { BellAlertIcon, BoltIcon, ClockIcon, CalendarDaysIcon } from "@heroicons/vue/24/outline";

const props = defineProps({
  alert: { type: Object, default: null },
  availableFilters: { type: Object, default: () => ({}) },
});

const emit = defineEmits(["save", "close"]);

const frequencyOptions = [
  { value: "IMMEDIATE", label: "Inmediata", icon: BoltIcon },
  { value: "DAILY", label: "Diaria", icon: ClockIcon },
  { value: "WEEKLY", label: "Semanal", icon: CalendarDaysIcon },
];

const form = ref({
  name: props.alert?.name || "",
  keywords: props.alert?.keywords || "",
  entities: props.alert?.entities || "",
  departments: props.alert?.departments || "",
  min_budget: props.alert?.min_budget || "",
  max_budget: props.alert?.max_budget || "",
  procurement_methods: props.alert?.procurement_methods || "",
  frequency: props.alert?.frequency || "DAILY",
});

function handleSave() {
  const data = { ...form.value };
  if (!data.min_budget) data.min_budget = null;
  if (!data.max_budget) data.max_budget = null;
  emit("save", data);
}
</script>
