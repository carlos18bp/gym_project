<template>
  <div>
    <!-- Mobile menu button (SlideBar layout slot) -->
    <div class="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:hidden">
      <slot name="menu-button"></slot>
    </div>

    <section class="px-4 sm:px-6 lg:px-8 py-6">
      <div class="max-w-7xl mx-auto space-y-6">
        <!-- Header -->
        <div>
          <h1 class="text-2xl font-semibold text-gray-900">Reasignación de Datos</h1>
          <p class="text-sm text-gray-600 mt-1">
            Transfiere procesos y documentos de un abogado a otro. Los documentos en
            proceso de firma no son transferibles. La acción es atómica y queda registrada.
          </p>
        </div>

        <!-- Card: lawyer selection -->
        <div class="bg-white border border-gray-200 rounded-xl p-4 sm:p-6">
          <h2 class="text-base font-semibold text-gray-900 mb-4">Seleccionar abogados</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1" for="source-lawyer">
                Abogado origen
              </label>
              <select
                id="source-lawyer"
                v-model="sourceLawyerId"
                data-testid="source-lawyer-select"
                class="block w-full rounded-md border-0 py-2 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-secondary sm:text-sm"
                @change="onSourceChange"
              >
                <option value="">Selecciona un abogado</option>
                <option v-for="lawyer in sourceOptions" :key="lawyer.id" :value="lawyer.id">
                  {{ lawyerLabel(lawyer) }}{{ lawyer.is_archived ? ' (archivado)' : '' }}
                </option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1" for="target-lawyer">
                Abogado destino
              </label>
              <select
                id="target-lawyer"
                v-model="targetLawyerId"
                data-testid="target-lawyer-select"
                class="block w-full rounded-md border-0 py-2 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-secondary sm:text-sm"
              >
                <option value="">Selecciona un abogado</option>
                <option v-for="lawyer in targetOptions" :key="lawyer.id" :value="lawyer.id">
                  {{ lawyerLabel(lawyer) }}
                </option>
              </select>
            </div>
          </div>
        </div>

        <!-- Loading -->
        <div v-if="store.loadingSummary" class="text-center py-8 text-gray-500">
          <div class="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-secondary"></div>
          <p class="mt-2 text-sm">Cargando datos del abogado...</p>
        </div>

        <template v-else-if="summary">
          <!-- Card: processes -->
          <div class="bg-white border border-gray-200 rounded-xl p-4 sm:p-6" data-testid="processes-card">
            <div class="flex items-center justify-between mb-3">
              <h2 class="text-base font-semibold text-gray-900">
                Procesos ({{ summary.counts.processes }})
              </h2>
              <label v-if="summary.processes.length" class="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  data-testid="select-all-processes"
                  :checked="allProcessesSelected"
                  @change="toggleAllProcesses"
                  class="rounded border-gray-300 text-secondary focus:ring-secondary"
                />
                Seleccionar todos
              </label>
            </div>
            <ul v-if="summary.processes.length" class="divide-y divide-gray-100">
              <li v-for="p in summary.processes" :key="p.id" class="flex items-center gap-3 py-2">
                <input
                  type="checkbox"
                  :data-testid="`process-checkbox-${p.id}`"
                  :checked="selectedProcessIds.includes(p.id)"
                  @change="toggleProcess(p.id)"
                  class="rounded border-gray-300 text-secondary focus:ring-secondary"
                />
                <div class="min-w-0 text-sm">
                  <span class="font-medium text-gray-900">{{ p.ref }}</span>
                  <span class="text-gray-500"> · {{ p.plaintiff }} vs {{ p.defendant }}</span>
                  <span v-if="p.case_type" class="text-gray-400"> · {{ p.case_type }}</span>
                </div>
              </li>
            </ul>
            <p v-else class="text-sm text-gray-400">Este abogado no tiene procesos asignados.</p>
          </div>

          <!-- Card: documents -->
          <div class="bg-white border border-gray-200 rounded-xl p-4 sm:p-6" data-testid="documents-card">
            <div class="flex items-center justify-between mb-3">
              <h2 class="text-base font-semibold text-gray-900">
                Documentos ({{ summary.counts.eligible_documents }})
              </h2>
              <label v-if="summary.eligible_documents.length" class="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  data-testid="select-all-documents"
                  :checked="allDocumentsSelected"
                  @change="toggleAllDocuments"
                  class="rounded border-gray-300 text-secondary focus:ring-secondary"
                />
                Seleccionar todos
              </label>
            </div>
            <ul v-if="summary.eligible_documents.length" class="divide-y divide-gray-100">
              <li v-for="d in summary.eligible_documents" :key="d.id" class="flex items-center gap-3 py-2">
                <input
                  type="checkbox"
                  :data-testid="`document-checkbox-${d.id}`"
                  :checked="selectedDocumentIds.includes(d.id)"
                  @change="toggleDocument(d.id)"
                  class="rounded border-gray-300 text-secondary focus:ring-secondary"
                />
                <div class="min-w-0 text-sm">
                  <span class="font-medium text-gray-900">{{ d.title }}</span>
                  <span class="text-gray-500"> · {{ d.state }}</span>
                  <span v-if="d.assigned_to_name" class="text-gray-400"> · {{ d.assigned_to_name }}</span>
                </div>
              </li>
            </ul>
            <p v-else class="text-sm text-gray-400">Este abogado no tiene documentos transferibles.</p>

            <!-- Non-eligible documents -->
            <div v-if="summary.ineligible_documents.length" class="mt-4 pt-4 border-t border-gray-100" data-testid="ineligible-documents">
              <p class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                No transferibles ({{ summary.counts.ineligible_documents }})
              </p>
              <ul class="space-y-1.5">
                <li v-for="d in summary.ineligible_documents" :key="d.id" class="flex items-center gap-2 text-sm text-gray-400">
                  <span class="truncate">{{ d.title }}</span>
                  <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                    {{ d.reason }}
                  </span>
                </li>
              </ul>
            </div>
          </div>

          <!-- Card: options -->
          <div class="bg-white border border-gray-200 rounded-xl p-4 sm:p-6">
            <label class="flex items-start gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                v-model="archiveSource"
                data-testid="archive-source-checkbox"
                class="mt-0.5 rounded border-gray-300 text-secondary focus:ring-secondary"
              />
              <span>
                Archivar abogado origen al finalizar.
                <span class="block text-xs text-gray-500 mt-0.5">
                  El abogado archivado no podrá iniciar sesión y no aparecerá en los listados. Esta acción es reversible.
                </span>
              </span>
            </label>
          </div>

          <!-- Footer -->
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p class="text-sm text-gray-600" data-testid="reassignment-summary-line">
              Se transferirán {{ selectedProcessIds.length }} proceso(s) y
              {{ selectedDocumentIds.length }} documento(s){{ targetName ? ` a ${targetName}` : '' }}.
            </p>
            <button
              type="button"
              data-testid="reassign-button"
              :disabled="!canSubmit"
              @click="showConfirm = true"
              class="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-secondary text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Reasignar datos
            </button>
          </div>
        </template>

        <!-- Card: archived lawyers (restore) -->
        <div v-if="archivedLawyers.length" class="bg-white border border-gray-200 rounded-xl p-4 sm:p-6" data-testid="archived-lawyers-card">
          <h2 class="text-base font-semibold text-gray-900 mb-3">Abogados archivados</h2>
          <ul class="divide-y divide-gray-100">
            <li v-for="lawyer in archivedLawyers" :key="lawyer.id" class="flex items-center justify-between py-2">
              <span class="text-sm text-gray-700">{{ lawyerLabel(lawyer) }}</span>
              <button
                type="button"
                :data-testid="`restore-lawyer-${lawyer.id}`"
                @click="restore(lawyer)"
                class="text-sm font-medium text-secondary hover:underline"
              >
                Restaurar
              </button>
            </li>
          </ul>
        </div>
      </div>
    </section>

    <ConfirmationModal
      :visible="showConfirm"
      title="Confirmar reasignación"
      :message="confirmMessage"
      confirm-text="Confirmar"
      :is-loading="store.executing"
      @confirm="onConfirm"
      @cancel="showConfirm = false"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { useUserStore } from "@/stores/auth/user";
import { useAdminReassignmentStore } from "@/stores/admin_reassignment";
import { showNotification } from "@/shared/notification_message";
import ConfirmationModal from "@/components/organizations/modals/ConfirmationModal.vue";

const userStore = useUserStore();
const store = useAdminReassignmentStore();

const sourceLawyerId = ref("");
const targetLawyerId = ref("");
const archiveSource = ref(false);
const selectedProcessIds = ref([]);
const selectedDocumentIds = ref([]);
const showConfirm = ref(false);

onMounted(() => {
  userStore.init();
});

const summary = computed(() => store.summary);
const archivedLawyers = computed(() => userStore.archivedLawyers);

// Source: all lawyers (archived shown so their data can be migrated).
const sourceOptions = computed(() => userStore.allLawyers);
// Target: active lawyers, excluding the selected source.
const targetOptions = computed(() =>
  userStore.lawyers.filter((l) => String(l.id) !== String(sourceLawyerId.value))
);

const targetName = computed(() => {
  const t = userStore.lawyers.find((l) => String(l.id) === String(targetLawyerId.value));
  return t ? lawyerLabel(t) : "";
});

const allProcessesSelected = computed(
  () => summary.value?.processes.length > 0 &&
    selectedProcessIds.value.length === summary.value.processes.length
);
const allDocumentsSelected = computed(
  () => summary.value?.eligible_documents.length > 0 &&
    selectedDocumentIds.value.length === summary.value.eligible_documents.length
);

const canSubmit = computed(() =>
  sourceLawyerId.value &&
  targetLawyerId.value &&
  String(sourceLawyerId.value) !== String(targetLawyerId.value) &&
  (selectedProcessIds.value.length > 0 || selectedDocumentIds.value.length > 0)
);

const confirmMessage = computed(() => {
  let msg = `Se transferirán ${selectedProcessIds.value.length} proceso(s) y ${selectedDocumentIds.value.length} documento(s) a ${targetName.value}.`;
  if (archiveSource.value) {
    msg += " El abogado origen será archivado.";
  }
  return msg;
});

function lawyerLabel(lawyer) {
  return `${lawyer.last_name || ""} ${lawyer.first_name || ""}`.trim() || lawyer.email;
}

async function onSourceChange() {
  selectedProcessIds.value = [];
  selectedDocumentIds.value = [];
  if (String(targetLawyerId.value) === String(sourceLawyerId.value)) {
    targetLawyerId.value = "";
  }
  if (!sourceLawyerId.value) {
    store.summary = null;
    return;
  }
  try {
    await store.fetchSummary(sourceLawyerId.value);
  } catch (error) {
    showNotification(store.error || "No se pudo cargar el resumen.", "error");
  }
}

function toggleProcess(id) {
  const i = selectedProcessIds.value.indexOf(id);
  if (i >= 0) selectedProcessIds.value.splice(i, 1);
  else selectedProcessIds.value.push(id);
}

function toggleAllProcesses() {
  selectedProcessIds.value = allProcessesSelected.value
    ? []
    : summary.value.processes.map((p) => p.id);
}

function toggleDocument(id) {
  const i = selectedDocumentIds.value.indexOf(id);
  if (i >= 0) selectedDocumentIds.value.splice(i, 1);
  else selectedDocumentIds.value.push(id);
}

function toggleAllDocuments() {
  selectedDocumentIds.value = allDocumentsSelected.value
    ? []
    : summary.value.eligible_documents.map((d) => d.id);
}

async function onConfirm() {
  try {
    const result = await store.executeReassignment({
      sourceLawyerId: Number(sourceLawyerId.value),
      targetLawyerId: Number(targetLawyerId.value),
      processIds: selectedProcessIds.value,
      documentIds: selectedDocumentIds.value,
      archiveSource: archiveSource.value,
    });
    showConfirm.value = false;
    let msg = `Se transfirieron ${result.transferred_processes} procesos y ${result.transferred_documents} documentos a ${result.target.full_name}.`;
    if (result.source_archived) {
      msg += ` El abogado ${result.source.full_name} fue archivado.`;
    }
    showNotification(msg, "success");
    // Reset the flow
    selectedProcessIds.value = [];
    selectedDocumentIds.value = [];
    archiveSource.value = false;
    const wasSource = sourceLawyerId.value;
    sourceLawyerId.value = "";
    targetLawyerId.value = "";
    store.summary = null;
    // If the source is now archived it drops out of active lists anyway.
    void wasSource;
  } catch (error) {
    showConfirm.value = false;
    showNotification(store.error || "No se pudo completar la reasignación.", "error");
  }
}

async function restore(lawyer) {
  try {
    await store.unarchiveLawyer(lawyer.id);
    showNotification(`El abogado ${lawyerLabel(lawyer)} fue restaurado.`, "success");
  } catch (error) {
    showNotification("No se pudo restaurar el abogado.", "error");
  }
}
</script>
