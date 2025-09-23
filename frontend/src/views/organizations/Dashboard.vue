<template>
  <div>
    <!-- Request Detail View -->
    <RequestDetailView v-if="$route.query.tab === 'request-detail'" />

    <!-- Corporate Client Dashboard -->
    <CorporateClientDashboard v-else-if="userRole === 'corporate_client'" />

    <!-- Regular Client View -->
    <ClientOrganizationsView v-else-if="userRole === 'client'" />

    <!-- Access Denied -->
    <div v-else class="px-4 py-6 sm:px-6 lg:px-8">
      <div class="text-center py-12">
        <div class="mx-auto max-w-md">
          <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z"></path>
          </svg>
          <h3 class="mt-2 text-sm font-medium text-gray-900">Acceso Restringido</h3>
          <p class="mt-1 text-sm text-gray-500">
            No tienes permisos para acceder a este módulo.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useUserStore } from '@/stores/auth/user';

// Components
import CorporateClientDashboard from '@/components/organizations/corporate_client/CorporateClientDashboard.vue';
import ClientOrganizationsView from '@/components/organizations/client/ClientOrganizationsView.vue';
import RequestDetailView from '@/components/organizations/shared/RequestDetailView.vue';

// Store instances
const userStore = useUserStore();

// Get the current user role
const userRole = computed(() => {
  return userStore.currentUser?.role || null;
});
</script>
