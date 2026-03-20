<template>
  <div class="min-h-screen bg-gray-50" data-testid="secop-detail-page">
    <!-- Mobile menu button -->
    <div class="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8 lg:hidden">
      <slot></slot>
    </div>

    <!-- Loading skeleton -->
    <div v-if="secopStore.loading" class="animate-pulse" data-testid="detail-loading">
      <div class="bg-gradient-to-r from-[#639CFF] to-[#BEB3FF] px-4 py-8 sm:px-6 lg:px-8">
        <div class="max-w-5xl mx-auto space-y-3">
          <div class="h-6 w-16 rounded bg-white/30"></div>
          <div class="h-7 w-3/4 rounded bg-white/30"></div>
          <div class="h-4 w-1/3 rounded bg-white/20"></div>
        </div>
      </div>
      <div class="py-6 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2 space-y-6">
          <div class="rounded-xl bg-white ring-1 ring-gray-200 p-6 h-48"></div>
          <div class="rounded-xl bg-white ring-1 ring-gray-200 p-6 h-64"></div>
        </div>
        <div class="space-y-6">
          <div class="rounded-xl bg-white ring-1 ring-gray-200 p-6 h-40"></div>
        </div>
      </div>
    </div>

    <!-- Content -->
    <div v-else-if="process">
      <!-- Header -->
      <div class="bg-gradient-to-r from-[#639CFF] to-[#BEB3FF] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div class="max-w-5xl mx-auto">
          <button @click="goBack" data-testid="detail-back" class="inline-flex items-center gap-1.5 text-sm text-white/80 hover:text-white mb-4 transition-colors">
            <ArrowLeftIcon class="h-4 w-4" />
            Volver a la lista
          </button>
          <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div class="flex-1 min-w-0">
              <h1 class="text-xl sm:text-2xl font-bold text-white mb-2" data-testid="detail-title">{{ process.procedure_name || 'Sin nombre' }}</h1>
              <p class="text-sm text-white/70 mb-3">Ref: {{ process.reference }} · ID: {{ process.process_id }}</p>
              <div class="flex flex-wrap gap-2">
                <span :class="[
                  'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset',
                  process.is_open
                    ? 'bg-green-50 text-green-700 ring-green-600/20'
                    : 'bg-white/20 text-white ring-white/30'
                ]">
                  {{ process.status }}
                </span>
                <span v-if="process.procurement_method" class="inline-flex items-center rounded-full bg-white/20 px-2.5 py-1 text-xs font-semibold text-white ring-1 ring-inset ring-white/30">
                  {{ process.procurement_method }}
                </span>
                <span v-if="process.contract_type" class="inline-flex items-center rounded-full bg-white/20 px-2.5 py-1 text-xs font-semibold text-white ring-1 ring-inset ring-white/30">
                  {{ process.contract_type }}
                </span>
              </div>
            </div>
            <a
              v-if="process.process_url"
              :href="process.process_url"
              target="_blank"
              rel="noopener noreferrer"
              data-testid="detail-secop-link"
              class="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-secondary shadow-sm hover:bg-gray-50 transition-colors shrink-0"
            >
              <ArrowTopRightOnSquareIcon class="h-4 w-4" />
              Ver en SECOP
            </a>
          </div>
        </div>
      </div>

      <div class="py-6 px-4 sm:px-6 lg:px-8">
        <div class="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
          <!-- Main Info -->
          <div class="lg:col-span-2 space-y-6">
            <!-- Budget highlight -->
            <div class="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 p-6" data-testid="detail-budget">
              <p class="text-sm font-medium text-gray-500 mb-1">Presupuesto Base</p>
              <p class="text-3xl font-bold text-primary">{{ formatCurrency(process.base_price) }}</p>
            </div>

            <!-- Entity Info -->
            <div class="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 p-6" data-testid="detail-entity">
              <h2 class="text-base font-semibold text-primary mb-4">Entidad Contratante</h2>
              <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                <div>
                  <dt class="text-xs font-medium text-gray-400 uppercase tracking-wide">Nombre</dt>
                  <dd class="mt-1 text-sm text-gray-900">{{ process.entity_name }}</dd>
                </div>
                <div>
                  <dt class="text-xs font-medium text-gray-400 uppercase tracking-wide">NIT</dt>
                  <dd class="mt-1 text-sm text-gray-900">{{ process.entity_nit || '-' }}</dd>
                </div>
                <div>
                  <dt class="text-xs font-medium text-gray-400 uppercase tracking-wide">Departamento</dt>
                  <dd class="mt-1 text-sm text-gray-900">{{ process.department || '-' }}</dd>
                </div>
                <div>
                  <dt class="text-xs font-medium text-gray-400 uppercase tracking-wide">Ciudad</dt>
                  <dd class="mt-1 text-sm text-gray-900">{{ process.city || '-' }}</dd>
                </div>
                <div>
                  <dt class="text-xs font-medium text-gray-400 uppercase tracking-wide">Nivel</dt>
                  <dd class="mt-1 text-sm text-gray-900">{{ process.entity_level || '-' }}</dd>
                </div>
              </dl>
            </div>

            <!-- Process Details -->
            <div class="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 p-6" data-testid="detail-process">
              <h2 class="text-base font-semibold text-primary mb-4">Detalles del Proceso</h2>
              <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                <div class="sm:col-span-2">
                  <dt class="text-xs font-medium text-gray-400 uppercase tracking-wide">Descripción</dt>
                  <dd class="mt-1 text-sm text-gray-900 whitespace-pre-line leading-relaxed">{{ process.description || '-' }}</dd>
                </div>
                <div>
                  <dt class="text-xs font-medium text-gray-400 uppercase tracking-wide">Fase</dt>
                  <dd class="mt-1 text-sm text-gray-900">{{ process.phase || '-' }}</dd>
                </div>
                <div>
                  <dt class="text-xs font-medium text-gray-400 uppercase tracking-wide">Duración</dt>
                  <dd class="mt-1 text-sm text-gray-900">
                    {{ process.duration_value ? `${process.duration_value} ${process.duration_unit || ''}` : '-' }}
                  </dd>
                </div>
                <div>
                  <dt class="text-xs font-medium text-gray-400 uppercase tracking-wide">Código UNSPSC</dt>
                  <dd class="mt-1 text-sm text-gray-900">{{ process.unspsc_code || '-' }}</dd>
                </div>
              </dl>
            </div>

            <!-- Dates -->
            <div class="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 p-6" data-testid="detail-dates">
              <h2 class="text-base font-semibold text-primary mb-4">Fechas</h2>
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div class="rounded-lg bg-terciary p-4">
                  <p class="text-xs font-medium text-gray-400 uppercase tracking-wide">Publicación</p>
                  <p class="mt-1 text-sm font-medium text-gray-900">{{ formatDate(process.publication_date) }}</p>
                </div>
                <div class="rounded-lg bg-terciary p-4">
                  <p class="text-xs font-medium text-gray-400 uppercase tracking-wide">Última Actualización</p>
                  <p class="mt-1 text-sm font-medium text-gray-900">{{ formatDate(process.last_update_date) }}</p>
                </div>
                <div :class="[
                  'rounded-lg p-4',
                  process.days_remaining !== null && process.days_remaining <= 3 ? 'bg-red-50 ring-1 ring-inset ring-red-200' : 'bg-terciary'
                ]">
                  <p class="text-xs font-medium text-gray-400 uppercase tracking-wide">Fecha de Cierre</p>
                  <p :class="['mt-1 text-sm font-semibold', process.days_remaining !== null && process.days_remaining <= 3 ? 'text-red-700' : 'text-gray-900']">
                    {{ formatDateTime(process.closing_date) }}
                  </p>
                  <p v-if="process.days_remaining !== null" :class="[
                    'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium mt-2',
                    process.days_remaining <= 3
                      ? 'bg-red-100 text-red-700'
                      : 'bg-gray-100 text-gray-600'
                  ]">
                    {{ process.days_remaining }} días restantes
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Sidebar -->
          <div class="space-y-6">
            <!-- Classification Panel -->
            <div class="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 p-6" data-testid="detail-classification">
              <h2 class="text-base font-semibold text-primary mb-4">Mi Clasificación</h2>
              <div v-if="myClassification">
                <ClassificationBadge :status="myClassification.status" class="mb-3" />
                <p v-if="myClassification.notes" class="text-sm text-gray-600 mb-4 bg-terciary rounded-lg p-3">{{ myClassification.notes }}</p>
                <div class="flex gap-2">
                  <button
                    @click="openClassifyModal"
                    data-testid="detail-edit-classification"
                    class="flex-1 rounded-lg px-3 py-2 text-sm font-medium text-secondary ring-1 ring-inset ring-secondary/30 hover:bg-blue-50 transition-colors"
                  >
                    Editar
                  </button>
                  <button
                    @click="handleDeleteClassification"
                    data-testid="detail-delete-classification"
                    class="rounded-lg px-3 py-2 text-sm font-medium text-red-600 ring-1 ring-inset ring-red-200 hover:bg-red-50 transition-colors"
                  >
                    Quitar
                  </button>
                </div>
              </div>
              <div v-else>
                <p class="text-sm text-gray-500 mb-3">Aún no has clasificado este proceso.</p>
                <button
                  @click="openClassifyModal"
                  data-testid="detail-classify-btn"
                  class="w-full rounded-lg bg-secondary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
                >
                  Clasificar
                </button>
              </div>
            </div>

            <!-- Team Classifications -->
            <div v-if="process.classifications && process.classifications.length" class="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 p-6" data-testid="detail-team-classifications">
              <h2 class="text-base font-semibold text-primary mb-4">Clasificaciones del Equipo</h2>
              <div class="space-y-3">
                <div v-for="c in process.classifications" :key="c.id" class="flex items-start gap-3 rounded-lg bg-terciary p-3">
                  <div class="flex h-8 w-8 items-center justify-center rounded-full bg-secondary/10 text-secondary text-xs font-semibold shrink-0">
                    {{ (c.user.first_name?.[0] || '') + (c.user.last_name?.[0] || '') }}
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-gray-900">{{ c.user.first_name }} {{ c.user.last_name }}</p>
                    <ClassificationBadge :status="c.status" class="mt-1" />
                    <p v-if="c.notes" class="text-xs text-gray-500 mt-1">{{ c.notes }}</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Sync info -->
            <div class="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 p-4">
              <p class="text-xs text-gray-400">Última sincronización: {{ formatDateTime(process.synced_at) }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Classification Modal -->
      <ClassificationModal
        v-if="showClassifyModal"
        :process="process"
        :current-classification="myClassification"
        @save="handleSaveClassification"
        @delete="handleDeleteClassificationFromModal"
        @close="showClassifyModal = false"
      />
    </div>

    <!-- Not found / Error -->
    <div v-else class="py-16 text-center px-4" data-testid="detail-not-found">
      <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50 mb-4">
        <BuildingLibraryIcon class="h-8 w-8 text-red-400" />
      </div>
      <h3 class="text-base font-semibold text-gray-900">{{ secopStore.error || 'Proceso no encontrado' }}</h3>
      <p class="mt-2 text-sm text-gray-500">El proceso solicitado no existe o no se pudo cargar.</p>
      <button @click="goBack" class="mt-5 inline-flex items-center gap-2 rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors">
        <ArrowLeftIcon class="h-4 w-4" />
        Volver a la lista
      </button>
    </div>
  </div>
</template>

<script setup>
import { ArrowLeftIcon, ArrowTopRightOnSquareIcon, BuildingLibraryIcon } from "@heroicons/vue/24/outline";
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useSecopStore } from "@/stores/secop/index";
import ClassificationBadge from "@/components/secop/ClassificationBadge.vue";
import ClassificationModal from "@/components/secop/ClassificationModal.vue";

const route = useRoute();
const router = useRouter();
const secopStore = useSecopStore();

const showClassifyModal = ref(false);

const process = computed(() => secopStore.currentProcess);

const myClassification = computed(() => {
  if (!process.value || !process.value.classifications) return null;
  // Find the current user's classification from the detail data
  // The list serializer uses my_classification, detail uses classifications array
  // We'll rely on the first classification that matches, or check via store
  return process.value.classifications?.find(c => c.is_mine) || null;
});

onMounted(async () => {
  const id = route.params.id;
  if (id) {
    await secopStore.fetchProcessDetail(id);
  }
});

function goBack() {
  router.push({ name: 'secop_list' });
}

function openClassifyModal() {
  showClassifyModal.value = true;
}

async function handleSaveClassification(data) {
  await secopStore.createClassification(data);
  showClassifyModal.value = false;
}

async function handleDeleteClassification() {
  const classification = myClassification.value;
  if (classification) {
    await secopStore.deleteClassification(classification.id, process.value.id);
  }
}

async function handleDeleteClassificationFromModal(classificationId, processId) {
  await secopStore.deleteClassification(classificationId, processId);
  showClassifyModal.value = false;
}

function formatCurrency(value) {
  if (!value) return '-';
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);
}

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
</script>
