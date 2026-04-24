<template>
  <div class="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:px-6 lg:px-8 lg:hidden">
    <slot></slot>
  </div>

  <section class="px-4 sm:px-6 lg:px-8 py-6">
    <div class="max-w-7xl mx-auto">
      <div class="mb-6">
        <h1 class="text-2xl font-semibold text-gray-900">Bandeja de Solicitudes</h1>
        <p class="text-sm text-gray-600 mt-1">Gestiona tramites recibidos por servicio, estado y fecha.</p>
      </div>

      <div class="bg-white border border-gray-200 rounded-xl p-4 mb-4">
        <div class="grid grid-cols-1 md:grid-cols-6 gap-3">
          <input
            v-model="filters.search"
            type="text"
            placeholder="Buscar solicitante / radicado"
            class="rounded-md border border-gray-300 px-3 py-2 md:col-span-2"
          />

          <select v-model="filters.status" class="rounded-md border border-gray-300 px-3 py-2">
            <option value="">Estado</option>
            <option value="OPEN">Abierto</option>
            <option value="IN_STUDY">En Estudio</option>
            <option value="IN_PROGRESS">En Tramite</option>
            <option value="ANSWERED">Contestado</option>
            <option value="FINALIZED">Finalizado</option>
          </select>

          <select v-model="filters.service" class="rounded-md border border-gray-300 px-3 py-2">
            <option value="">Servicio</option>
            <option v-for="service in services" :key="service.id" :value="service.id">
              {{ service.name }}
            </option>
          </select>

          <input v-model="filters.date_from" type="date" class="rounded-md border border-gray-300 px-3 py-2" />
          <input v-model="filters.date_to" type="date" class="rounded-md border border-gray-300 px-3 py-2" />
        </div>

        <div class="flex justify-end mt-3">
          <button
            type="button"
            class="rounded-md bg-secondary text-white px-3 py-2 hover:bg-secondary/90"
            @click="fetchInbox"
          >
            Aplicar filtros
          </button>
        </div>
      </div>

      <div v-if="loading" class="bg-white border border-gray-200 rounded-xl p-6 text-sm text-gray-600">
        Cargando solicitudes...
      </div>

      <div v-else-if="requests.length === 0" class="bg-white border border-gray-200 rounded-xl p-6 text-sm text-gray-600">
        No hay solicitudes para los filtros actuales.
      </div>

      <div v-else class="overflow-x-auto bg-white border border-gray-200 rounded-xl">
        <table class="min-w-full text-sm">
          <thead class="bg-gray-50 text-gray-700">
            <tr>
              <th class="text-left px-4 py-3">Radicado</th>
              <th class="text-left px-4 py-3">Servicio</th>
              <th class="text-left px-4 py-3">Estado</th>
              <th class="text-left px-4 py-3">Fecha</th>
              <th class="text-left px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="request in requests" :key="request.id" class="border-t border-gray-100">
              <td class="px-4 py-3 font-medium text-gray-900">{{ request.tracking_number }}</td>
              <td class="px-4 py-3">{{ request.service_name }}</td>
              <td class="px-4 py-3">
                <span class="px-2 py-1 rounded-full text-xs font-medium" :class="statusClass(request.status)">
                  {{ request.status_display }}
                </span>
              </td>
              <td class="px-4 py-3">{{ formatDate(request.created_at) }}</td>
              <td class="px-4 py-3 text-right">
                <button
                  type="button"
                  class="text-secondary hover:text-secondary/80"
                  @click="goToDetail(request.id)"
                >
                  Ver detalle
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>

<script setup>
import { onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { useServicesTramitesStore } from "@/stores/services_tramites";
import { statusClass, formatDate } from "@/composables/useServiceRequestHelpers";

const router = useRouter();
const store = useServicesTramitesStore();

const loading = ref(false);
const requests = ref([]);
const services = ref([]);
const filters = reactive({
  search: "",
  status: "",
  service: "",
  date_from: "",
  date_to: "",
});

const fetchCatalog = async () => {
  try {
    services.value = await store.fetchServices({ include_inactive: true });
  } catch (error) {
    console.error("Error loading service catalog:", error);
    services.value = [];
  }
};

const fetchInbox = async () => {
  loading.value = true;
  try {
    const data = await store.fetchInboxRequests(filters);
    requests.value = data.results || data.requests || [];
  } catch (error) {
    console.error("Error loading inbox requests:", error);
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
  await fetchInbox();
});
</script>
