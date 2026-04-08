<template>
  <div class="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:px-6 lg:px-8 lg:hidden">
    <slot></slot>
  </div>

  <section class="px-4 sm:px-6 lg:px-8 py-6">
    <div class="max-w-7xl mx-auto">
      <div class="mb-6">
        <h1 class="text-2xl font-semibold text-gray-900">Servicios</h1>
        <p class="text-sm text-gray-600 mt-1">
          Explora todos los servicios y tramites disponibles.
        </p>
      </div>

      <div v-if="loading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div v-for="index in 8" :key="index" class="rounded-xl border border-gray-200 p-4 animate-pulse">
          <div class="aspect-square bg-gray-100 rounded-lg"></div>
          <div class="h-4 bg-gray-100 rounded mt-3"></div>
          <div class="h-3 bg-gray-100 rounded mt-2 w-2/3"></div>
        </div>
      </div>

      <div v-else-if="services.length === 0" class="text-sm text-gray-600 bg-white border border-gray-200 rounded-xl p-6">
        No hay servicios disponibles en este momento.
      </div>

      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          v-for="service in services"
          :key="service.id"
          type="button"
          class="text-left bg-white border border-gray-200 rounded-xl p-4 hover:border-secondary transition-colors"
          @click="goToService(service.id)"
        >
          <div class="aspect-square rounded-lg overflow-hidden bg-gradient-to-br from-blue-50 to-white border border-gray-100 flex items-center justify-center">
            <img
              v-if="service.icon_image_url"
              :src="service.icon_image_url"
              :alt="service.name"
              class="w-full h-full object-cover"
            />
            <span v-else class="text-2xl font-semibold text-secondary">
              {{ service.short_title?.slice(0, 1) || "S" }}
            </span>
          </div>
          <h2 class="mt-3 text-base font-semibold text-gray-900">{{ service.name }}</h2>
          <p class="mt-1 text-sm text-gray-600 line-clamp-2">
            {{ service.description || "Servicio juridico disponible para solicitud en linea." }}
          </p>
        </button>
      </div>
    </div>
  </section>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useServicesTramitesStore } from "@/stores/services_tramites";

const router = useRouter();
const servicesStore = useServicesTramitesStore();

const loading = ref(false);
const services = ref([]);

const fetchServices = async () => {
  loading.value = true;
  try {
    services.value = await servicesStore.fetchServices();
  } catch (error) {
    console.error("Error loading services:", error);
    services.value = [];
  } finally {
    loading.value = false;
  }
};

const goToService = (serviceId) => {
  router.push({ name: "service_detail", params: { id: serviceId } });
};

onMounted(fetchServices);
</script>
