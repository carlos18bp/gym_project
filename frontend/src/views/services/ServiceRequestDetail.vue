<template>
  <div class="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:px-6 lg:px-8 lg:hidden">
    <slot></slot>
  </div>

  <section class="px-4 sm:px-6 lg:px-8 py-6">
    <div class="max-w-6xl mx-auto">
      <button
        type="button"
        class="text-sm text-secondary hover:text-secondary/80 mb-3"
        @click="goBack"
      >
        Volver
      </button>

      <div v-if="loading" class="bg-white border border-gray-200 rounded-xl p-6 text-sm text-gray-600">
        Cargando solicitud...
      </div>

      <div v-else-if="!requestDetail" class="bg-white border border-gray-200 rounded-xl p-6 text-sm text-gray-600">
        No fue posible cargar la solicitud.
      </div>

      <div v-else class="space-y-4">
        <div
          class="bg-white border rounded-xl p-6 transition-all duration-500"
          :class="isHighlighted ? 'border-blue-400 ring-2 ring-blue-200 animate-pulse' : 'border-gray-200'"
        >
          <div class="flex flex-wrap justify-between gap-3">
            <div>
              <p class="text-sm text-gray-500">{{ requestDetail.service?.name }}</p>
              <h1 class="text-2xl font-semibold text-gray-900">
                {{ requestDetail.tracking_number || `Solicitud #${requestDetail.id}` }}
              </h1>
              <p class="text-sm text-gray-600 mt-1">
                Solicitante: {{ requestDetail.requester_name }}
              </p>
            </div>

            <div class="text-right">
              <span class="px-3 py-1 rounded-full text-xs font-medium" :class="statusClass(requestDetail.status)">
                {{ requestDetail.status_display }}
              </span>
              <p class="text-xs text-gray-500 mt-2">
                Fecha: {{ formatDate(requestDetail.created_at) }}
              </p>
            </div>
          </div>

          <div class="mt-4 flex flex-wrap gap-3">
            <button
              v-if="requestDetail.document_url"
              type="button"
              class="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
              @click="downloadDocument"
            >
              Descargar documento PDF
            </button>
          </div>
        </div>

        <div class="bg-white border border-gray-200 rounded-xl p-6">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">Respuestas del formulario</h2>

          <div v-if="groupedAnswers.length === 0" class="text-sm text-gray-600">
            No hay respuestas registradas.
          </div>

          <div v-else class="space-y-4">
            <div v-for="stage in groupedAnswers" :key="stage.order" class="border border-gray-100 rounded-lg p-4">
              <h3 class="text-sm font-semibold text-gray-900 mb-3">
                Fase {{ stage.order }} - {{ stage.title }}
              </h3>
              <div class="space-y-3">
                <div v-for="answer in stage.items" :key="answer.id">
                  <p class="text-sm font-medium text-gray-800">{{ answer.field_label }}</p>
                  <p v-if="answer.field_type !== 'file'" class="text-sm text-gray-600 mt-1">
                    {{ formattedAnswerValue(answer) }}
                  </p>
                  <div v-else class="mt-2">
                    <button
                      v-for="file in answer.files || []"
                      :key="file.id"
                      type="button"
                      class="inline-flex items-center mr-2 mb-2 px-3 py-1 rounded-md bg-blue-50 text-blue-700 text-xs hover:bg-blue-100"
                      @click="downloadFieldFile(file)"
                    >
                      {{ file.file_name }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="bg-white border border-gray-200 rounded-xl p-6">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">Respuestas del abogado</h2>

          <div v-if="!requestDetail.lawyer_responses?.length" class="text-sm text-gray-600">
            Aun no hay respuestas registradas.
          </div>

          <div v-else class="space-y-3">
            <div
              v-for="response in requestDetail.lawyer_responses"
              :key="response.id"
              class="border border-gray-100 rounded-lg p-4"
            >
              <div class="flex flex-wrap items-center justify-between gap-2">
                <p class="text-sm font-medium text-gray-900">
                  {{ response.responder_name || "Equipo juridico" }}
                </p>
                <p class="text-xs text-gray-500">{{ formatDate(response.created_at) }}</p>
              </div>
              <p class="text-sm text-gray-700 mt-2">{{ response.message || "Sin mensaje" }}</p>
              <div class="mt-2">
                <button
                  v-for="file in response.files || []"
                  :key="file.id"
                  type="button"
                  class="inline-flex items-center mr-2 mb-2 px-3 py-1 rounded-md bg-indigo-50 text-indigo-700 text-xs hover:bg-indigo-100"
                  @click="downloadResponseFile(response, file)"
                >
                  {{ file.file_name }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div
          v-if="isManager"
          class="bg-white border border-gray-200 rounded-xl p-6"
        >
          <h2 class="text-lg font-semibold text-gray-900 mb-4">Gestionar solicitud</h2>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <select v-model="manageForm.status" class="rounded-md border border-gray-300 px-3 py-2">
              <option value="OPEN">Abierto</option>
              <option value="IN_STUDY">En Estudio</option>
              <option value="IN_PROGRESS">En Tramite</option>
              <option value="ANSWERED">Contestado</option>
              <option value="FINALIZED">Finalizado</option>
            </select>

            <input
              type="file"
              class="rounded-md border border-gray-300 px-3 py-2"
              @change="onResponseFileSelected"
            />

            <button
              type="button"
              class="rounded-md bg-secondary text-white px-3 py-2 hover:bg-secondary/90"
              @click="submitManagement"
            >
              Guardar actualizacion
            </button>
          </div>

          <textarea
            v-model="manageForm.message"
            rows="4"
            class="w-full mt-3 rounded-md border border-gray-300 px-3 py-2"
            placeholder="Mensaje visible para el usuario"
          ></textarea>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { showConfirmationAlert } from "@/shared/confirmation_alert";
import { showNotification } from "@/shared/notification_message";
import { useServicesTramitesStore } from "@/stores/services_tramites";
import { useUserStore } from "@/stores/auth/user";
import { statusClass, formatDate } from "@/composables/useServiceRequestHelpers";

const route = useRoute();
const router = useRouter();
const store = useServicesTramitesStore();
const userStore = useUserStore();

const loading = ref(false);
const requestDetail = ref(null);
const responseFile = ref(null);
const isHighlighted = ref(false);
let highlightTimer = null;
const manageForm = reactive({
  status: "OPEN",
  message: "",
});

const isManager = computed(() => {
  const current = userStore.currentUser || {};
  return (
    current.role === "lawyer" ||
    current.role === "admin" ||
    current.is_staff === true ||
    current.is_superuser === true
  );
});

const groupedAnswers = computed(() => {
  const answers = requestDetail.value?.answers || [];
  const groupMap = new Map();

  answers.forEach((answer) => {
    if (!groupMap.has(answer.stage_order)) {
      groupMap.set(answer.stage_order, {
        order: answer.stage_order,
        title: answer.stage_title,
        items: [],
      });
    }
    groupMap.get(answer.stage_order).items.push(answer);
  });

  return [...groupMap.values()].sort((a, b) => a.order - b.order);
});

const loadDetail = async () => {
  loading.value = true;
  try {
    await userStore.init();
    requestDetail.value = await store.fetchRequestDetail(Number(route.params.id));
    manageForm.status = requestDetail.value.status;
  } catch (error) {
    console.error("Error loading service request detail:", error);
    requestDetail.value = null;
  } finally {
    loading.value = false;
  }
};

const formattedAnswerValue = (answer) => {
  if (answer.field_type === "select_multiple") {
    return Array.isArray(answer.value_json) ? answer.value_json.join(", ") : "-";
  }
  if (answer.value_text) return answer.value_text;
  if (Array.isArray(answer.value_json)) return answer.value_json.join(", ");
  if (answer.value_json) return `${answer.value_json}`;
  return "-";
};

const saveBlob = (response, fallbackName) => {
  const contentType = response.headers["content-type"] || "application/octet-stream";
  const blob = new Blob([response.data], { type: contentType });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fallbackName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

const downloadDocument = async () => {
  try {
    const response = await store.downloadRequestDocument(requestDetail.value.id);
    saveBlob(response, `${requestDetail.value.tracking_number || "solicitud"}.pdf`);
  } catch (error) {
    console.error("Error downloading request document:", error);
    showNotification("No fue posible descargar el documento", "warning");
  }
};

const downloadFieldFile = async (file) => {
  try {
    const response = await store.downloadFieldFile(requestDetail.value.id, file.id);
    saveBlob(response, file.file_name || "archivo");
  } catch (error) {
    console.error("Error downloading field file:", error);
    showNotification("No fue posible descargar el archivo", "warning");
  }
};

const downloadResponseFile = async (responseItem, file) => {
  try {
    const response = await store.downloadResponseFile(requestDetail.value.id, responseItem.id, file.id);
    saveBlob(response, file.file_name || "archivo");
  } catch (error) {
    console.error("Error downloading response file:", error);
    showNotification("No fue posible descargar el archivo adjunto", "warning");
  }
};

const onResponseFileSelected = (event) => {
  responseFile.value = event.target.files?.[0] || null;
};

const submitManagement = async () => {
  const confirmed = await showConfirmationAlert("¿Deseas guardar esta actualizacion?");
  if (!confirmed) return;

  try {
    requestDetail.value = await store.manageRequest(requestDetail.value.id, {
      status: manageForm.status,
      message: manageForm.message,
      file: responseFile.value,
    });
    manageForm.message = "";
    responseFile.value = null;
    showNotification("Solicitud actualizada correctamente", "success");
  } catch (error) {
    console.error("Error managing service request:", error);
    showNotification("No fue posible actualizar la solicitud", "warning");
  }
};

const goBack = () => {
  if (isManager.value) {
    router.push({ name: "service_requests_inbox" });
  } else {
    router.push({ name: "services_hub", query: { tab: "my-requests" } });
  }
};

onMounted(async () => {
  await loadDetail();
  if (route.query.highlight) {
    isHighlighted.value = true;
    highlightTimer = setTimeout(() => {
      isHighlighted.value = false;
      router.replace({ ...route, query: { ...route.query, highlight: undefined } });
      highlightTimer = null;
    }, 5000);
  }
});

onUnmounted(() => {
  if (highlightTimer) {
    clearTimeout(highlightTimer);
    highlightTimer = null;
  }
});
</script>
