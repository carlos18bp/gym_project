<template>
  <div class="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:px-6 lg:px-8 lg:hidden">
    <slot></slot>
  </div>

  <section class="px-4 sm:px-6 lg:px-8 py-6">
    <div class="max-w-5xl mx-auto">
      <div class="flex items-center justify-between gap-4 mb-6">
        <div>
          <button
            type="button"
            class="text-sm text-secondary hover:text-secondary/80 mb-2"
            @click="goBack"
          >
            Volver a Servicios
          </button>
          <h1 class="text-2xl font-semibold text-gray-900">{{ service?.name || "Servicio" }}</h1>
          <p class="text-sm text-gray-600 mt-1">{{ service?.description }}</p>
        </div>
      </div>

      <div v-if="loading" class="bg-white border border-gray-200 rounded-xl p-6 animate-pulse">
        <div class="h-5 bg-gray-100 rounded w-1/2 mb-4"></div>
        <div class="h-4 bg-gray-100 rounded mb-2"></div>
        <div class="h-4 bg-gray-100 rounded mb-2"></div>
        <div class="h-4 bg-gray-100 rounded w-3/4"></div>
      </div>

      <div v-else-if="!service" class="bg-white border border-gray-200 rounded-xl p-6 text-sm text-gray-600">
        No se pudo cargar el servicio.
      </div>

      <div v-else>
        <div
          v-if="submissionSuccess"
          class="bg-emerald-50 border border-emerald-200 rounded-xl p-6"
        >
          <h2 class="text-lg font-semibold text-emerald-900">Solicitud enviada con exito</h2>
          <p class="text-sm text-emerald-800 mt-1">
            Radicado generado: <strong>{{ submissionSuccess.tracking_number }}</strong>
          </p>
          <div class="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              class="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
              @click="downloadGeneratedDocument"
            >
              Descargar PDF
            </button>
            <router-link
              :to="{ name: 'services_hub', query: { tab: 'my-requests' } }"
              class="px-4 py-2 rounded-lg bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-100"
            >
              Ver Mis Solicitudes
            </router-link>
          </div>
        </div>

        <div v-if="!submissionSuccess" class="bg-white border border-gray-200 rounded-xl p-6">
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <button
              v-for="(stage, index) in orderedStages"
              :key="stage.id"
              type="button"
              class="rounded-lg border px-3 py-2 text-left transition-colors"
              :class="index === activeStageIndex ? 'border-secondary bg-blue-50' : 'border-gray-200 bg-white'"
              @click="goToStage(index)"
            >
              <p class="text-xs text-gray-500">Fase {{ stage.order }}</p>
              <p class="text-sm font-medium text-gray-900 line-clamp-1">{{ stage.title }}</p>
            </button>
          </div>

          <div v-if="currentStage">
            <h2 class="text-lg font-semibold text-gray-900">{{ currentStage.title }}</h2>
            <p class="text-sm text-gray-600 mt-1 mb-4">{{ currentStage.description }}</p>

            <div class="space-y-4">
              <div
                v-for="field in orderedFields(currentStage)"
                :key="field.id"
                class="border border-gray-100 rounded-lg p-4"
              >
                <label class="block text-sm font-medium text-gray-800 mb-2">
                  {{ field.label }}
                  <span v-if="field.is_required" class="text-red-500">*</span>
                </label>

                <p v-if="field.help_text" class="text-xs text-gray-600 mb-3">
                  {{ field.help_text }}
                </p>

                <input
                  v-if="field.field_type === 'input' || field.field_type === 'email' || field.field_type === 'number' || field.field_type === 'date'"
                  v-model="fieldState(field).value_text"
                  :type="inputType(field.field_type)"
                  :placeholder="field.placeholder || ''"
                  class="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-secondary focus:border-secondary"
                />

                <textarea
                  v-else-if="field.field_type === 'text_area'"
                  v-model="fieldState(field).value_text"
                  rows="4"
                  :placeholder="field.placeholder || ''"
                  class="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-secondary focus:border-secondary"
                ></textarea>

                <select
                  v-else-if="field.field_type === 'select_single'"
                  v-model="fieldState(field).value_text"
                  class="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-secondary focus:border-secondary"
                >
                  <option value="">Selecciona una opcion</option>
                  <option
                    v-for="option in field.options || []"
                    :key="option"
                    :value="option"
                  >
                    {{ option }}
                  </option>
                </select>

                <div v-else-if="field.field_type === 'select_multiple'" class="space-y-2">
                  <label
                    v-for="option in field.options || []"
                    :key="option"
                    class="flex items-center gap-2 text-sm text-gray-700"
                  >
                    <input
                      type="checkbox"
                      :checked="fieldState(field).value_json.includes(option)"
                      @change="toggleMultiOption(field, option)"
                    />
                    <span>{{ option }}</span>
                  </label>
                </div>

                <div v-else-if="field.field_type === 'file'" class="space-y-3">
                  <input
                    type="file"
                    :multiple="field.allow_multiple_files"
                    :accept="acceptString(field.allowed_extensions)"
                    :data-field-id="field.id"
                    :disabled="fieldState(field).new_files.length >= maxFilesForField(field)"
                    @change="onFileSelected(field, $event)"
                    :class="[
                      'w-full rounded-md border px-3 py-2 transition-colors',
                      fieldState(field).new_files.length >= maxFilesForField(field)
                        ? 'border-gray-200 bg-gray-100 cursor-not-allowed'
                        : 'border-gray-300 hover:border-gray-400'
                    ]"
                  />

                  <p v-if="field.allow_multiple_files" class="text-xs text-gray-500">
                    Puedes seleccionar hasta {{ maxFilesForField(field) }} archivos
                  </p>

                  <p v-if="fieldState(field).new_files.length >= maxFilesForField(field)" class="text-xs text-orange-600">
                    Has alcanzado el límite de {{ maxFilesForField(field) }} archivos
                  </p>

                  <div v-if="fieldState(field).existing_files.length" class="space-y-2">
                    <p class="text-sm font-medium text-gray-800">Archivos guardados:</p>
                    <div
                      v-for="file in fieldState(field).existing_files"
                      :key="file.id"
                      class="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded-lg"
                    >
                      <svg class="w-5 h-5 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span class="text-sm text-gray-900 flex-1 truncate">{{ file.file_name }}</span>
                    </div>
                  </div>

                  <div v-if="fieldState(field).new_files.length" class="space-y-2">
                    <p class="text-sm font-medium text-gray-800">
                      Archivos seleccionados ({{ fieldState(field).new_files.length }}/{{ maxFilesForField(field) }})
                    </p>
                    <div
                      v-for="(file, idx) in fieldState(field).new_files"
                      :key="`${file.name}-${idx}`"
                      class="flex items-center justify-between p-2 bg-gray-50 border border-gray-200 rounded-lg group hover:bg-gray-100 transition-colors"
                    >
                      <div class="flex items-center gap-2 flex-1 min-w-0">
                        <svg class="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <div class="min-w-0 flex-1">
                          <p class="text-sm text-gray-900 truncate">{{ file.name }}</p>
                          <p class="text-xs text-gray-500">{{ formatFileSize(file.size) }}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        @click="removeFile(field, idx)"
                        class="ml-2 p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                        title="Eliminar archivo"
                      >
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>

                <p v-if="validationErrors[field.id]" class="text-xs text-red-600 mt-2">
                  {{ validationErrors[field.id] }}
                </p>
              </div>
            </div>
          </div>

          <div class="mt-6 flex flex-wrap gap-3 justify-between">
            <div class="flex gap-3">
              <button
                type="button"
                class="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                :disabled="activeStageIndex === 0"
                @click="previousStage"
              >
                Anterior
              </button>
              <button
                type="button"
                class="px-4 py-2 rounded-lg border border-blue-300 text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                :disabled="submitting"
                @click="saveDraft"
              >
                {{ submitting ? "Guardando..." : "Guardar borrador" }}
              </button>
            </div>

            <button
              v-if="!isLastStage"
              type="button"
              class="px-4 py-2 rounded-lg bg-secondary text-white hover:bg-secondary/90 disabled:opacity-50"
              :disabled="submitting"
              @click="nextStage"
            >
              Siguiente
            </button>

            <button
              v-else
              type="button"
              class="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
              :disabled="submitting"
              @click="submitRequest"
            >
              {{ submitting ? "Enviando..." : "Enviar solicitud" }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { onBeforeRouteLeave, useRoute, useRouter } from "vue-router";
import { showNotification } from "@/shared/notification_message";
import { useServicesTramitesStore } from "@/stores/services_tramites";

const route = useRoute();
const router = useRouter();
const store = useServicesTramitesStore();

const loading = ref(false);
const submitting = ref(false);
const service = ref(null);
const requestId = ref(null);
const activeStageIndex = ref(0);
const fieldValues = reactive({});
const validationErrors = reactive({});
const submissionSuccess = ref(null);
const initialSnapshot = ref(null);

const orderedStages = computed(() => {
  const stages = service.value?.stages || [];
  return [...stages].sort((a, b) => a.order - b.order);
});

const currentStage = computed(() => orderedStages.value[activeStageIndex.value] || null);
const isLastStage = computed(() => activeStageIndex.value === orderedStages.value.length - 1);

const orderedFields = (stage) => {
  const fields = stage?.fields || [];
  return [...fields].sort((a, b) => a.order - b.order);
};

const fieldState = (field) => {
  if (!fieldValues[field.id]) {
    fieldValues[field.id] = {
      value_text: "",
      value_json: [],
      existing_files: [],
      new_files: [],
    };
  }
  return fieldValues[field.id];
};

const inputType = (fieldType) => {
  if (fieldType === "email") return "email";
  if (fieldType === "number") return "number";
  if (fieldType === "date") return "date";
  return "text";
};

const acceptString = (allowedExtensions) => {
  if (!allowedExtensions || !allowedExtensions.length) return ".jpg,.jpeg,.png,.pdf,.doc,.docx";
  return allowedExtensions.join(",");
};

const toggleMultiOption = (field, option) => {
  const state = fieldState(field);
  const exists = state.value_json.includes(option);
  state.value_json = exists
    ? state.value_json.filter((item) => item !== option)
    : [...state.value_json, option];
};

const MAX_FILE_SIZE_MB = 30;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const MAX_FILES_LIMIT = 10;

const maxFilesForField = (field) => {
  return field.allow_multiple_files ? MAX_FILES_LIMIT : 1;
};

const formatFileSize = (bytes) => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

const removeFile = (field, index) => {
  const state = fieldState(field);
  state.new_files = state.new_files.filter((_, idx) => idx !== index);
  
  // Limpiar validación de error si existía
  delete validationErrors[field.id];
  
  // Limpiar el input para permitir volver a seleccionar archivos
  const fileInput = document.querySelector(`input[type="file"][data-field-id="${field.id}"]`);
  if (fileInput) {
    fileInput.value = "";
  }
};

const onFileSelected = (field, event) => {
  const selectedFiles = Array.from(event.target.files || []);
  const maxFiles = maxFilesForField(field);
  
  // Validar límite de archivos
  const currentCount = fieldState(field).new_files.length;
  const availableSlots = maxFiles - currentCount;
  
  if (selectedFiles.length > availableSlots) {
    validationErrors[field.id] = `Puedes agregar máximo ${maxFiles} archivos. Ya tienes ${currentCount} archivo(s) seleccionado(s).`;
    event.target.value = "";
    return;
  }
  
  // Validar tamaño de archivos
  const oversized = selectedFiles.filter((f) => f.size > MAX_FILE_SIZE_BYTES);
  if (oversized.length) {
    validationErrors[field.id] = `El archivo ${oversized[0].name} excede ${MAX_FILE_SIZE_MB}MB.`;
    event.target.value = "";
    return;
  }
  
  delete validationErrors[field.id];
  
  // Agregar archivos a los existentes en lugar de reemplazar
  fieldState(field).new_files = [
    ...fieldState(field).new_files,
    ...selectedFiles
  ];
  
  event.target.value = ""; // Limpiar input para permitir agregar más
};

const applyDraftToForm = (draft) => {
  if (!draft) return;

  requestId.value = draft.id;
  if (draft.current_stage && draft.current_stage > 0) {
    const targetIndex = Math.max(0, Math.min(orderedStages.value.length - 1, draft.current_stage - 1));
    activeStageIndex.value = targetIndex;
  }

  (draft.answers || []).forEach((answer) => {
    if (!answer.field) return;
    const state = fieldState({ id: answer.field });
    state.value_text = answer.value_text || "";
    state.value_json = Array.isArray(answer.value_json) ? answer.value_json : [];
    state.existing_files = answer.files || [];
    state.new_files = [];
  });

  captureSnapshot();
};

const clearValidationErrors = () => {
  Object.keys(validationErrors).forEach((key) => {
    delete validationErrors[key];
  });
};

const validateFields = (fields, strictRequired = true) => {
  clearValidationErrors();
  let isValid = true;

  fields.forEach((field) => {
    const state = fieldState(field);
    const textValue = (state.value_text || "").toString().trim();
    const hasFiles = state.existing_files.length > 0 || state.new_files.length > 0;

    if (strictRequired && field.is_required) {
      if (field.field_type === "select_multiple" && (!state.value_json || !state.value_json.length)) {
        validationErrors[field.id] = "Este campo es obligatorio.";
        isValid = false;
      } else if (field.field_type === "file" && !hasFiles) {
        validationErrors[field.id] = "Debes cargar al menos un archivo.";
        isValid = false;
      } else if (!["select_multiple", "file"].includes(field.field_type) && !textValue) {
        validationErrors[field.id] = "Este campo es obligatorio.";
        isValid = false;
      }
    }

    if (field.field_type === "email" && textValue) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(textValue)) {
        validationErrors[field.id] = "Ingresa un correo valido.";
        isValid = false;
      }
    }
  });

  return isValid;
};

const buildAnswersPayload = () => {
  const answers = [];

  orderedStages.value.forEach((stage) => {
    orderedFields(stage).forEach((field) => {
      const state = fieldState(field);
      answers.push({
        field_id: field.id,
        value_text: ["select_multiple", "file"].includes(field.field_type) ? null : state.value_text,
        value_json: field.field_type === "select_multiple" ? state.value_json : null,
      });
    });
  });

  return answers;
};

const buildFilesPayload = () => {
  const filesByField = {};
  orderedStages.value.forEach((stage) => {
    orderedFields(stage).forEach((field) => {
      if (field.field_type !== "file") return;
      const state = fieldState(field);
      if (state.new_files.length) {
        filesByField[field.id] = state.new_files;
      }
    });
  });
  return filesByField;
};

const refreshFromResponse = (responseData) => {
  requestId.value = responseData.id;
  applyDraftToForm(responseData);
};

const saveDraft = async () => {
  if (submitting.value) return;
  submitting.value = true;
  try {
    const data = await store.saveServiceRequest({
      serviceId: Number(route.params.id),
      requestId: requestId.value,
      answers: buildAnswersPayload(),
      currentStage: activeStageIndex.value + 1,
      isSubmit: false,
      filesByField: buildFilesPayload(),
    });

    refreshFromResponse(data);
    captureSnapshot();
    showNotification("Borrador guardado correctamente", "success");
  } catch (error) {
    console.error("Error saving draft:", error);
    showNotification("No fue posible guardar el borrador", "warning");
  } finally {
    submitting.value = false;
  }
};

const downloadGeneratedDocument = async () => {
  if (!requestId.value) return;
  try {
    const response = await store.downloadRequestDocument(requestId.value);
    const blob = new Blob([response.data], { type: "application/pdf" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${submissionSuccess.value?.tracking_number || "solicitud"}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Error downloading generated document:", error);
    showNotification("No fue posible descargar el PDF", "warning");
  }
};

const nextStage = async () => {
  if (!currentStage.value) return;
  const isValid = validateFields(orderedFields(currentStage.value), true);
  if (!isValid) return;
  if (activeStageIndex.value < orderedStages.value.length - 1) {
    activeStageIndex.value += 1;
  }
};

const previousStage = () => {
  if (activeStageIndex.value > 0) {
    activeStageIndex.value -= 1;
  }
};

const goToStage = (index) => {
  if (index === activeStageIndex.value) return;
  if (index > activeStageIndex.value) {
    const valid = validateFields(orderedFields(currentStage.value), true);
    if (!valid) return;
  }
  activeStageIndex.value = index;
};

const submitRequest = async () => {
  if (submitting.value) return;
  const allFields = orderedStages.value.flatMap((stage) => orderedFields(stage));
  const isValid = validateFields(allFields, true);
  if (!isValid) return;

  submitting.value = true;
  try {
    const data = await store.saveServiceRequest({
      serviceId: Number(route.params.id),
      requestId: requestId.value,
      answers: buildAnswersPayload(),
      currentStage: activeStageIndex.value + 1,
      isSubmit: true,
      filesByField: buildFilesPayload(),
    });

    refreshFromResponse(data);
    submissionSuccess.value = data;
    showNotification("Solicitud enviada exitosamente", "success");
  } catch (error) {
    console.error("Error submitting request:", error);
    showNotification("No fue posible enviar la solicitud", "warning");
  } finally {
    submitting.value = false;
  }
};

const loadService = async () => {
  loading.value = true;
  try {
    const data = await store.fetchServiceDetail(Number(route.params.id));
    service.value = data.service;
    applyDraftToForm(data.draft);
    if (!data.draft) captureSnapshot();
  } catch (error) {
    console.error("Error loading service detail:", error);
    service.value = null;
  } finally {
    loading.value = false;
  }
};

const goBack = () => {
  router.push({ name: "services_list" });
};

const captureSnapshot = () => {
  const snap = {};
  for (const [id, state] of Object.entries(fieldValues)) {
    snap[id] = {
      value_text: state.value_text || "",
      value_json: JSON.stringify(state.value_json || []),
    };
  }
  initialSnapshot.value = snap;
};

const isFormDirty = computed(() => {
  if (submissionSuccess.value) return false;
  const snap = initialSnapshot.value || {};
  return Object.entries(fieldValues).some(([id, state]) => {
    const base = snap[id];
    const curText = (state.value_text || "").toString().trim();
    const curJson = JSON.stringify(state.value_json || []);
    const hasNewFiles = state.new_files && state.new_files.length > 0;
    if (hasNewFiles) return true;
    if (!base) return !!(curText || state.value_json?.length);
    return curText !== (base.value_text || "").toString().trim() || curJson !== base.value_json;
  });
});

onBeforeRouteLeave((_to, _from, next) => {
  if (isFormDirty.value) {
    const leave = window.confirm("Tienes cambios sin guardar. ¿Deseas salir de esta pagina?");
    next(leave);
  } else {
    next();
  }
});

onMounted(loadService);
</script>
