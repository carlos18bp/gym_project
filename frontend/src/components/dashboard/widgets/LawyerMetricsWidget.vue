<template>
  <div class="grid grid-cols-2 gap-4" data-testid="lawyer-metrics-widget">
    <div class="bg-white border border-gray-200 rounded-xl p-5">
      <div class="flex items-center gap-3">
        <div class="rounded-full bg-emerald-100 p-2.5">
          <UserGroupIcon class="size-6 text-emerald-600" />
        </div>
        <div>
          <p class="text-2xl font-semibold text-gray-900" data-testid="active-lawyers-count">
            {{ activeCount }}
          </p>
          <p class="text-sm text-gray-500">Abogados activos</p>
        </div>
      </div>
    </div>
    <div class="bg-white border border-gray-200 rounded-xl p-5">
      <div class="flex items-center gap-3">
        <div class="rounded-full bg-gray-100 p-2.5">
          <ArchiveBoxIcon class="size-6 text-gray-500" />
        </div>
        <div>
          <p class="text-2xl font-semibold text-gray-900" data-testid="archived-lawyers-count">
            {{ archivedCount }}
          </p>
          <p class="text-sm text-gray-500">Abogados archivados</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * Admin dashboard widget showing active vs archived lawyer counts,
 * derived from the shared user store.
 */
import { computed } from 'vue';
import { UserGroupIcon, ArchiveBoxIcon } from '@heroicons/vue/24/outline';
import { useUserStore } from '@/stores/auth/user';

const userStore = useUserStore();

const activeCount = computed(() => userStore.lawyers.length);
const archivedCount = computed(() => userStore.archivedLawyers.length);
</script>
