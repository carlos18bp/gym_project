<template>
  <section class="bg-white rounded-xl border border-gray-200 p-5">
    <div class="flex items-center justify-between mb-4">
      <div>
        <h2 class="text-lg font-semibold text-gray-900">Servicios Destacados</h2>
      </div>
      <router-link
        :to="{ name: 'services_list' }"
        class="text-sm font-medium text-secondary hover:text-secondary/80"
      >
        Ver todos
      </router-link>
    </div>

    <div v-if="loading" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      <div v-for="index in 6" :key="index" class="animate-pulse">
        <div class="aspect-square bg-gray-100 rounded-lg"></div>
        <div class="h-3 bg-gray-100 rounded mt-2"></div>
      </div>
    </div>

    <div v-else-if="featuredServices.length === 0" class="text-sm text-gray-600">
      No hay servicios destacados disponibles.
    </div>

    <div v-else class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      <button
        v-for="service in featuredServices.slice(0, 6)"
        :key="service.id"
        type="button"
        class="text-left group"
        @click="goToService(service.id)"
      >
        <div
          class="aspect-square rounded-lg border border-gray-200 bg-gradient-to-br from-blue-50 to-white overflow-hidden flex items-center justify-center group-hover:border-secondary transition-colors"
        >
          <img
            v-if="service.icon_image_url"
            :src="service.icon_image_url"
            :alt="service.name"
            class="w-full h-full object-cover"
          />
          <span v-else class="text-2xl font-semibold text-secondary">
            {{ service.short_title?.slice(0, 1) || 'S' }}
          </span>
        </div>
        <p class="mt-2 text-sm font-medium text-gray-900 truncate">
          {{ service.short_title || service.name }}
        </p>
      </button>
    </div>
  </section>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useServicesTramitesStore } from "@/stores/services_tramites";

const servicesStore = useServicesTramitesStore();
const router = useRouter();

const loading = ref(false);
const featuredServices = ref([]);

const fetchFeatured = async () => {
  loading.value = true;
  try {
    featuredServices.value = await servicesStore.fetchFeaturedServices();
  } catch (error) {
    console.error("Error loading featured services:", error);
    featuredServices.value = [];
  } finally {
    loading.value = false;
  }
};

const goToService = (serviceId) => {
  router.push({ name: "service_detail", params: { id: serviceId } });
};

onMounted(fetchFeatured);
</script>
