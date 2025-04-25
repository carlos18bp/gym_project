<!-- ActivityFeed.vue -->
<!-- 
  Este componente ha sido refactorizado para separarlo en sub-componentes más pequeños
  que se ubican en src/components/dashboard/widgets/
  - FeedWidget.vue - Para la sección de actividad 
  - ContactsWidget.vue - Para la sección de contactos/abogados
  - ReportsWidget.vue - Para una nueva sección de reportes (solo visible para abogados)
-->
<template>
  <div class="bg-white rounded-xl shadow-md border border-gray-200 p-4 h-full flex flex-col">
    <!-- Tabs navigation -->
    <div class="border-b border-gray-200">
      <div class="flex">
        <!-- Feed tab -->
        <div class="mr-8 text-center">
          <button 
            class="inline-block pb-2 font-medium"
            :class="activeTab === 'feed' ? 'text-blue-500' : 'text-gray-500 hover:text-gray-700'"
            @click="activeTab = 'feed'"
          >
            Feed
          </button>
          <div v-if="activeTab === 'feed'" class="h-0.5 bg-blue-500 w-12 mx-auto mt-2"></div>
        </div>
        
        <!-- Contacts tab -->
        <div class="mr-8 text-center">
          <button 
            class="inline-block pb-2 font-medium"
            :class="activeTab === 'contacts' ? 'text-blue-500' : 'text-gray-500 hover:text-gray-700'"
            @click="activeTab = 'contacts'"
          >
            {{ isLawyer ? 'Contactos' : 'Abogados' }}
          </button>
          <div v-if="activeTab === 'contacts'" class="h-0.5 bg-blue-500 w-20 mx-auto mt-2"></div>
        </div>

        <!-- Reports tab - solo visible para abogados -->
        <div v-if="isLawyer" class="text-center">
          <button 
            class="inline-block pb-2 font-medium"
            :class="activeTab === 'reports' ? 'text-blue-500' : 'text-gray-500 hover:text-gray-700'"
            @click="activeTab = 'reports'"
          >
            Reportes
          </button>
          <div v-if="activeTab === 'reports'" class="h-0.5 bg-blue-500 w-20 mx-auto mt-2"></div>
        </div>
      </div>
    </div>

    <!-- Tab content -->
    <div class="mt-4">
      <!-- Feed widget -->
      <FeedWidget v-if="activeTab === 'feed'" :user="user" />
      
      <!-- Contacts widget -->
      <ContactsWidget v-if="activeTab === 'contacts'" :user="user" />
      
      <!-- Reports widget - solo visible para abogados -->
      <ReportsWidget v-if="activeTab === 'reports' && isLawyer" :user="user" />
    </div>
  </div>
</template>

<script setup>
/**
 * Activity Feed Component
 * 
 * This component serves as a container for various dashboard widgets:
 * - Feed: Shows recent user activities
 * - Contacts: Shows contacts or lawyers depending on user role
 * - Reports: Shows various reports and statistics (only available for lawyers)
 */
import { ref, computed, watch } from 'vue';
import FeedWidget from '@/components/dashboard/widgets/FeedWidget.vue';
import ContactsWidget from '@/components/dashboard/widgets/ContactsWidget.vue';
import ReportsWidget from '@/components/dashboard/widgets/ReportsWidget.vue';

const props = defineProps({
  /**
   * Current user object
   */
  user: {
    type: Object,
    required: true
  }
});

// Component state
const activeTab = ref('feed');

// Check if user is a lawyer
const isLawyer = computed(() => props.user?.role === 'lawyer');

// Reset to feed tab if reports tab is active but user is not a lawyer
watch(() => props.user, (newUser) => {
  if (activeTab.value === 'reports' && newUser?.role !== 'lawyer') {
    activeTab.value = 'feed';
  }
}, { deep: true });
</script>

<style scoped>
/* No styles needed here as they're now in the child components */
</style>
