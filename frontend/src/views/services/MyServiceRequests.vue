<template>
  <div 
    v-if="!embedded"
    class="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:px-6 lg:px-8 lg:hidden"
  >
    <slot></slot>
  </div>

  <section :class="embedded ? '' : 'px-4 sm:px-6 lg:px-8 py-6'">
    <div class="max-w-7xl mx-auto">
      <div v-if="!embedded" class="mb-6">
        <h1 class="text-2xl font-semibold text-gray-900">Mis Solicitudes</h1>
        <p class="text-sm text-gray-600 mt-1">Consulta el historial y estado de tus tramites.</p>
      </div>

      <div class="bg-white border border-gray-200 rounded-xl p-4 mb-4">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            v-model="filters.tracking"
            type="text"
            placeholder="Buscar por radicado"
            class="rounded-md border border-gray-300 px-3 py-2"
          />

          <select v-model="filters.status" class="rounded-md border border-gray-300 px-3 py-2">
            <option value="">Todos los estados</option>
            <option value="OPEN">Abierto</option>
            <option value="IN_STUDY">En Estudio</option>
            <option value="IN_PROGRESS">En Tramite</option>
            <option value="ANSWERED">Contestado</option>
            <option value="FINALIZED">Finalizado</option>
          </select>

          <select v-model="filters.service" class="rounded-md border border-gray-300 px-3 py-2">
            <option value="">Todos los servicios</option>
            <option v-for="service in services" :key="service.id" :value="service.id">
              {{ service.name }}
            </option>
          </select>

          <button
            type="button"
            class="rounded-md bg-secondary text-white px-3 py-2 hover:bg-secondary/90"
            @click="fetchRequests"
          >
            Filtrar
          </button>
        </div>
      </div>

      <div v-if="loading" class="bg-white border border-gray-200 rounded-xl p-6 text-sm text-gray-600">
        Cargando solicitudes...
      </div>

      <div v-else-if="requests.length === 0" class="bg-white border border-gray-200 rounded-xl p-6 text-sm text-gray-600">
        No hay solicitudes registradas con los filtros actuales.
      </div>

      <div v-else class="space-y-3">
        <button
          v-for="request in requests"
          :key="request.id"
          type="button"
          class="w-full text-left bg-white border border-gray-200 rounded-xl p-4 hover:border-secondary transition-colors"
          @click="goToDetail(request.id)"
        >
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p class="text-sm text-gray-500">{{ request.service_name }}</p>
              <h2 class="text-base font-semibold text-gray-900">
                {{ request.tracking_number || "Sin radicado" }}
              </h2>
              <p class="text-sm text-gray-600 mt-1">
                Creada: {{ formatDate(request.created_at) }}
              </p>
            </div>

            <span class="px-3 py-1 rounded-full text-xs font-medium" :class="statusClass(request.status)">
              {{ request.status_display }}
            </span>
          </div>
        </button>
      </div>
    </div>
  </section>
</template>

<script setup>
import { onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { useServicesTramitesStore } from "@/stores/services_tramites";
import { statusClass, formatDate } from "@/composables/useServiceRequestHelpers";

defineProps({
  embedded: {
    type: Boolean,
    default: false,
  },
});

const router = useRouter();
const store = useServicesTramitesStore();

const loading = ref(false);
const requests = ref([]);
const services = ref([]);
const filters = reactive({
  tracking: "",
  status: "",
  service: "",
});

const fetchCatalog = async () => {
  try {
    services.value = await store.fetchServices();
  } catch (error) {
    console.error("Error loading services catalog:", error);
    services.value = [];
  }
};

const fetchRequests = async () => {
  loading.value = true;
  try {
    const data = await store.fetchMyRequests({
      tracking: filters.tracking,
      status: filters.status,
      service: filters.service,
    });
    requests.value = data.results || data.requests || [];
  } catch (error) {
    console.error("Error loading my requests:", error);
    requests.value = [];
  } finally {
    loading.value = false;
  }
};

const goToDetail = (requestId) => {
  router.push({ name: "service_request_detail", params: { id: requestId } });
};

onMounted(async () => {
  await fetchCatalog();
  await fetchRequests();
});
</script>
