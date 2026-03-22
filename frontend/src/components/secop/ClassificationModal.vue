<template>
  <div class="fixed inset-0 z-50 overflow-y-auto" data-testid="classification-modal">
    <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
      <!-- Backdrop -->
      <div
        class="fixed inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity"
        @click="$emit('close')"
      ></div>

      <!-- Modal -->
      <div class="relative transform overflow-hidden rounded-xl bg-white text-left shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
        <div class="px-6 pb-5 pt-6">
          <h3 class="text-lg font-semibold text-primary mb-1" data-testid="classification-modal-title">
            {{ currentClassification ? 'Editar Clasificación' : 'Clasificar Proceso' }}
          </h3>
          <p class="text-sm text-gray-500 mb-5 truncate">{{ process?.procedure_name || process?.entity_name }}</p>

          <!-- Status selection as cards -->
          <div class="mb-5">
            <label class="block text-sm font-medium text-gray-700 mb-2">Estado</label>
            <div class="grid grid-cols-2 gap-3">
              <button
                v-for="option in statusOptions"
                :key="option.value"
                @click="selectedStatus = option.value"
                :data-testid="`classification-status-${option.value}`"
                :class="[
                  'flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium border-2 transition-all',
                  selectedStatus === option.value
                    ? option.activeClass
                    : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                ]"
              >
                <component :is="option.icon" class="h-4 w-4 shrink-0" />
                {{ option.label }}
              </button>
            </div>
          </div>

          <!-- Notes -->
          <div class="mb-2">
            <label class="block text-sm font-medium text-gray-700 mb-2">Notas internas</label>
            <textarea
              v-model="notes"
              rows="3"
              data-testid="classification-notes"
              class="w-full rounded-lg border-gray-300 text-sm shadow-sm focus:ring-2 focus:ring-secondary focus:border-secondary placeholder:text-gray-400"
              placeholder="Agrega notas para el equipo..."
            ></textarea>
          </div>
        </div>

        <!-- Actions -->
        <div class="border-t border-gray-100 bg-gray-50 px-6 py-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button
            @click="$emit('close')"
            data-testid="classification-cancel"
            class="inline-flex justify-center rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            v-if="currentClassification"
            @click="$emit('delete', currentClassification.id, process.id)"
            data-testid="classification-delete"
            class="inline-flex justify-center rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-red-600 shadow-sm ring-1 ring-inset ring-red-200 hover:bg-red-50"
          >
            Eliminar
          </button>
          <button
            @click="handleSave"
            :disabled="!selectedStatus"
            data-testid="classification-save"
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
import { ref } from "vue";
import { StarIcon, EyeIcon, CheckCircleIcon, XCircleIcon } from "@heroicons/vue/20/solid";

const props = defineProps({
  process: { type: Object, required: true },
  currentClassification: { type: Object, default: null },
});

const emit = defineEmits(["save", "delete", "close"]);

const statusOptions = [
  { value: "INTERESTING", label: "Interesante", icon: StarIcon, activeClass: "border-blue-500 bg-blue-50 text-blue-700" },
  { value: "UNDER_REVIEW", label: "En Revisión", icon: EyeIcon, activeClass: "border-amber-500 bg-amber-50 text-amber-700" },
  { value: "APPLIED", label: "Aplicado", icon: CheckCircleIcon, activeClass: "border-green-500 bg-green-50 text-green-700" },
  { value: "DISCARDED", label: "Descartado", icon: XCircleIcon, activeClass: "border-gray-400 bg-gray-50 text-gray-700" },
];

const selectedStatus = ref(props.currentClassification?.status || "INTERESTING");
const notes = ref(props.currentClassification?.notes || "");

function handleSave() {
  emit("save", {
    process: props.process.id,
    status: selectedStatus.value,
    notes: notes.value,
  });
}
</script>
