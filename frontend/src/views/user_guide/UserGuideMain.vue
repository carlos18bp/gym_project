<template>
  <!-- Menu button -->
  <div
    class="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8"
  >
    <slot></slot>
    <div class="flex-1">
      <h1 class="text-xl font-semibold text-gray-900">Manual de Usuario</h1>
    </div>
  </div>

  <!-- Main content -->
  <div class="flex h-[calc(100vh-4rem)]">
    <!-- Sidebar Navigation -->
    <aside class="hidden lg:block w-80 border-r border-gray-200 bg-gray-50 overflow-y-auto">
      <GuideNavigation
        :current-role="currentUserRole"
        :selected-module="selectedModule"
        :selected-section="selectedSection"
        @module-selected="handleModuleSelected"
        @section-selected="handleSectionSelected"
      />
    </aside>

    <!-- Mobile Navigation -->
    <div class="lg:hidden w-full">
      <div class="p-4 border-b border-gray-200 bg-white">
        <button
          @click="showMobileNav = !showMobileNav"
          class="w-full flex items-center justify-between px-4 py-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <span class="font-medium text-gray-900">
            {{ selectedModule ? getModuleName(selectedModule) : 'Selecciona un módulo' }}
          </span>
          <ChevronDownIcon 
            :class="['h-5 w-5 text-gray-500 transition-transform', showMobileNav ? 'rotate-180' : '']"
          />
        </button>
      </div>
      
      <div v-if="showMobileNav" class="border-b border-gray-200 bg-gray-50">
        <GuideNavigation
          :current-role="currentUserRole"
          :selected-module="selectedModule"
          :selected-section="selectedSection"
          @module-selected="handleModuleSelected"
          @section-selected="handleSectionSelected"
          @close="showMobileNav = false"
        />
      </div>
    </div>

    <!-- Content Area -->
    <main class="flex-1 overflow-y-auto bg-white">
      <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <!-- Search Bar -->
        <div class="mb-6">
          <SearchGuide
            v-model="searchQuery"
            @search="handleSearch"
            @result-selected="handleSearchResult"
          />
        </div>

        <!-- Welcome Screen -->
        <div v-if="!selectedModule" class="text-center py-12">
          <BookOpenIcon class="mx-auto h-16 w-16 text-indigo-500 mb-4" />
          <h2 class="text-2xl font-bold text-gray-900 mb-2">
            Bienvenido al Manual de Usuario
          </h2>
          <p class="text-gray-600 mb-6">
            Selecciona un módulo del menú lateral para comenzar
          </p>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto mt-8">
            <RoleInfoCard :role="currentUserRole" />
            <QuickLinksCard :role="currentUserRole" @navigate="handleQuickLink" />
          </div>
        </div>

        <!-- Module Content -->
        <div v-else>
          <ModuleGuide
            :module="selectedModule"
            :section="selectedSection"
            :role="currentUserRole"
            :search-query="searchQuery"
            @section-selected="handleSectionSelected"
          />
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { BookOpenIcon, ChevronDownIcon } from '@heroicons/vue/24/outline';
import { useUserStore } from '@/stores/auth/user';
import { useAuthStore } from '@/stores/auth/auth';
import { useUserGuideStore } from '@/stores/user_guide';
import GuideNavigation from './components/GuideNavigation.vue';
import ModuleGuide from './components/ModuleGuide.vue';
import SearchGuide from './components/SearchGuide.vue';
import RoleInfoCard from './components/RoleInfoCard.vue';
import QuickLinksCard from './components/QuickLinksCard.vue';

const router = useRouter();
const userStore = useUserStore();
const authStore = useAuthStore();
const guideStore = useUserGuideStore();

// State
const selectedModule = ref(null);
const selectedSection = ref(null);
const searchQuery = ref('');
const showMobileNav = ref(false);

// Computed
const currentUserRole = computed(() => {
  const user = userStore.userById(authStore.userAuth?.id);
  return user?.role || 'client';
});

// Methods
const handleModuleSelected = (module) => {
  selectedModule.value = module;
  selectedSection.value = null;
  showMobileNav.value = false;
  searchQuery.value = '';
};

const handleSectionSelected = (section) => {
  selectedSection.value = section;
  showMobileNav.value = false;
};

const handleSearch = (query) => {
  // Search functionality will filter content in ModuleGuide
  console.log('Searching for:', query);
};

const handleSearchResult = (result) => {
  // Navigate to the module and section from search result
  selectedModule.value = result.moduleId;
  selectedSection.value = result.sectionId;
  searchQuery.value = '';
  showMobileNav.value = false;
};

const handleQuickLink = (module) => {
  selectedModule.value = module;
  selectedSection.value = null;
};

const getModuleName = (moduleId) => {
  const modules = guideStore.getModulesForRole(currentUserRole.value);
  const module = modules.find(m => m.id === moduleId);
  return module?.name || moduleId;
};

// Lifecycle
onMounted(async () => {
  await userStore.init();
  guideStore.initializeGuideContent();
});

// Watch for route changes to reset view when clicking menu again
watch(() => router.currentRoute.value.params.refresh, () => {
  selectedModule.value = null;
  selectedSection.value = null;
  searchQuery.value = '';
});
</script>
