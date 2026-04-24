<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header azul corporativo -->
    <ModuleHeader 
      title="Servicios y Solicitudes" 
      subtitle="Explora servicios disponibles y consulta el estado de tus solicitudes."
    >
      <template #menu-button><slot></slot></template>
    </ModuleHeader>

    <!-- Main content -->
    <div class="py-6 px-4 sm:px-6 lg:px-8">
      <!-- Tabs Navigation -->
      <div class="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 mb-6">
        <div class="border-b border-gray-200">
          <div class="flex items-center justify-between px-4 sm:px-6">
            <!-- Desktop Tabs -->
            <nav class="-mb-px hidden sm:flex space-x-6">
              <button
                v-for="tab in tabs"
                :key="tab.key"
                @click="activeTab = tab.key"
                :class="[
                  'relative whitespace-nowrap pb-3 pt-4 text-sm font-medium transition-colors',
                  activeTab === tab.key
                    ? 'text-secondary'
                    : 'text-gray-500 hover:text-gray-700'
                ]"
              >
                {{ tab.label }}
                <span
                  v-if="activeTab === tab.key"
                  class="absolute inset-x-0 bottom-0 h-0.5 bg-secondary rounded-full transition-all duration-200"
                ></span>
              </button>
            </nav>

            <!-- Mobile Dropdown -->
            <div class="sm:hidden flex-1 py-3">
              <select 
                v-model="activeTab"
                class="w-full rounded-lg border-gray-300 text-sm shadow-sm focus:ring-2 focus:ring-secondary focus:border-secondary"
              >
                <option v-for="tab in tabs" :key="tab.key" :value="tab.key">
                  {{ tab.label }}
                </option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <!-- Tab Content -->
      <div v-if="activeTab === 'services'">
        <ServicesList :embedded="true" />
      </div>

      <div v-else-if="activeTab === 'my-requests'">
        <MyServiceRequests :embedded="true" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import ModuleHeader from '@/components/layouts/ModuleHeader.vue';
import ServicesList from './ServicesList.vue';
import MyServiceRequests from './MyServiceRequests.vue';

const route = useRoute();

const tabs = [
  { key: 'services', label: 'Servicios' },
  { key: 'my-requests', label: 'Mis Solicitudes' },
];

const activeTab = ref('services');

// Cambiar tab según query param
watch(
  () => route.query.tab,
  (newTab) => {
    if (newTab && tabs.some(t => t.key === newTab)) {
      activeTab.value = newTab;
    }
  },
  { immediate: true }
);
</script>
