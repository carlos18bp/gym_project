<template>
  <div>
    <!-- Back Button -->
    <div class="mb-4">
      <button
        @click="goBack"
        class="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition-colors border border-gray-300"
      >
        <ArrowLeftIcon class="h-4 w-4" />
        Volver a Mis Documentos
      </button>
    </div>

    <!-- Filter Bar -->
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
      <div class="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <!-- Left side: Search and Filters -->
        <div class="flex flex-col sm:flex-row gap-3 flex-1 w-full lg:w-auto">
          <!-- Search -->
          <div class="relative flex-1 min-w-[200px]">
            <MagnifyingGlassIcon class="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              v-model="localSearchQuery"
              type="text"
              placeholder="Buscar plantillas..."
              class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-secondary focus:border-transparent"
            />
          </div>

          <!-- Filter by Tag -->
          <Menu as="div" class="relative">
            <MenuButton class="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md bg-white text-sm font-medium text-gray-700 hover:bg-gray-50">
              <FunnelIcon class="h-4 w-4" />
              <span class="max-w-[120px] truncate">{{ selectedTagName || 'Etiqueta' }}</span>
              <ChevronDownIcon class="h-4 w-4" />
            </MenuButton>
            <MenuItems class="absolute left-0 z-10 mt-2 w-64 origin-top-left rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
              <div class="p-2">
                <!-- Search input -->
                <div class="relative mb-2">
                  <MagnifyingGlassIcon class="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    v-model="tagSearchQuery"
                    type="text"
                    placeholder="Buscar etiquetas..."
                    class="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-secondary focus:border-transparent"
                    @click.stop
                  />
                </div>
                <!-- Tags list -->
                <div class="max-h-60 overflow-y-auto">
                  <MenuItem v-slot="{ active }">
                    <a @click="filterByTag = null" :class="[active ? 'bg-gray-100' : '', 'block px-3 py-2 text-sm text-gray-700 cursor-pointer rounded-md']">
                      Todos
                    </a>
                  </MenuItem>
                  <MenuItem v-for="tag in filteredAvailableTags" :key="tag.id" v-slot="{ active }">
                    <a @click="filterByTag = tag.id" :class="[active ? 'bg-gray-100' : '', 'flex items-center gap-2 px-3 py-2 text-sm cursor-pointer rounded-md']">
                      <span class="w-3 h-3 rounded-full flex-shrink-0" :class="getTagColorClass(tag)"></span>
                      <span class="truncate">{{ tag.name }}</span>
                    </a>
                  </MenuItem>
                  <div v-if="filteredAvailableTags.length === 0" class="px-3 py-2 text-sm text-gray-500 text-center">
                    No se encontraron etiquetas
                  </div>
                </div>
              </div>
            </MenuItems>
          </Menu>

          <!-- Clear filters button -->
          <button
            v-if="filterByTag"
            @click="clearFilters"
            class="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
            title="Limpiar filtros"
          >
            <XMarkIcon class="h-4 w-4" />
            Limpiar
          </button>
        </div>

        <!-- Right side: Sort and Results -->
        <div class="flex items-center gap-3 w-full lg:w-auto">
          <!-- Results count -->
          <span class="text-sm text-gray-500 whitespace-nowrap">
            Mostrando {{ filteredAndSortedDocuments.length }} plantillas
          </span>

          <!-- Sort -->
          <Menu as="div" class="relative">
            <MenuButton class="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md bg-white text-sm font-medium text-gray-700 hover:bg-gray-50">
              Ordenar: {{ sortLabel }}
              <ChevronDownIcon class="h-4 w-4" />
            </MenuButton>
            <MenuItems class="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
              <div class="py-1">
                <MenuItem v-slot="{ active }">
                  <a @click="sortBy = 'recent'" :class="[active ? 'bg-gray-100' : '', 'block px-4 py-2 text-sm text-gray-700 cursor-pointer']">
                    Más recientes
                  </a>
                </MenuItem>
                <MenuItem v-slot="{ active }">
                  <a @click="sortBy = 'name'" :class="[active ? 'bg-gray-100' : '', 'block px-4 py-2 text-sm text-gray-700 cursor-pointer']">
                    Nombre (A-Z)
                  </a>
                </MenuItem>
              </div>
            </MenuItems>
          </Menu>
        </div>
      </div>
    </div>

    <!-- Table -->
    <div v-if="filteredAndSortedDocuments.length > 0" class="bg-white rounded-lg shadow-sm border border-gray-200">
      <div class="overflow-x-auto" :style="{ minHeight: getMinHeight() }">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Plantilla
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Estado
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Etiquetas
              </th>
              <th scope="col" class="w-16 px-6 py-3"></th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr
              v-for="(document, index) in filteredAndSortedDocuments"
              :key="document.id"
              class="hover:bg-gray-50 cursor-pointer transition-colors"
              @click="handleDocumentClick(document)"
            >
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                  <div class="flex-shrink-0 h-10 w-10">
                    <div class="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
                      <DocumentTextIcon class="h-5 w-5 text-purple-600" />
                    </div>
                  </div>
                  <div class="ml-4">
                    <div class="text-sm font-medium text-gray-900">{{ document.title }}</div>
                  </div>
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-700 border border-purple-200">
                  Disponible
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex flex-wrap gap-1">
                  <span
                    v-for="tag in document.tags?.slice(0, 2)"
                    :key="tag.id"
                    class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full"
                    :class="getTagClasses(tag)"
                  >
                    {{ tag.name }}
                  </span>
                  <span
                    v-if="document.tags && document.tags.length > 2"
                    class="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-600"
                  >
                    +{{ document.tags.length - 2 }}
                  </span>
                  <span v-if="!document.tags || document.tags.length === 0" class="text-sm text-gray-400">-</span>
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium" @click.stop>
                <Menu as="div" class="relative inline-block text-left" v-slot="{ open }">
                  <MenuButton 
                    :ref="el => setMenuButtonRef(el, index)"
                    @click="handleMenuOpen(index, open)"
                    class="inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-gray-100"
                  >
                    <EllipsisVerticalIcon class="h-5 w-5 text-gray-500" />
                  </MenuButton>
                  <MenuItems 
                    :ref="el => setMenuItemsRef(el, index)"
                    :class="[
                      filteredAndSortedDocuments.length > 2 && index > 0 && index >= filteredAndSortedDocuments.length - 3
                        ? 'absolute right-0 z-[9999] bottom-full mb-2 w-48 origin-bottom-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none'
                        : 'absolute right-0 z-[9999] mt-2 w-48 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none'
                    ]"
                  >
                    <div class="py-1">
                      <MenuItem v-slot="{ active }">
                        <a @click="handleDocumentClick(document)" :class="[active ? 'bg-gray-100' : '', 'block px-4 py-2 text-sm text-gray-700 cursor-pointer']">
                          Usar plantilla
                        </a>
                      </MenuItem>
                    </div>
                  </MenuItems>
                </Menu>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="bg-white rounded-b-lg border-t border-gray-200 px-4 py-3 sm:px-6">
      <div class="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div class="text-sm text-gray-700">
          Mostrando <span class="font-medium">{{ paginationInfo.start }}</span> a
          <span class="font-medium">{{ paginationInfo.end }}</span> de
          <span class="font-medium">{{ paginationInfo.total }}</span> plantillas
        </div>
        <div>
          <nav class="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
            <button
              @click="previousPage"
              :disabled="currentPage === 1"
              :class="[
                'relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0',
                currentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''
              ]"
            >
              <span class="sr-only">Anterior</span>
              <ChevronLeftIcon class="h-5 w-5" aria-hidden="true" />
            </button>
            <template v-for="page in visiblePages" :key="page">
              <button
                v-if="page !== '...'"
                @click="goToPage(page)"
                :class="[
                  'relative inline-flex items-center px-4 py-2 text-sm font-semibold focus:z-20 focus:outline-offset-0',
                  currentPage === page
                    ? 'z-10 bg-secondary text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary'
                    : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50'
                ]"
              >
                {{ page }}
              </button>
              <span
                v-else
                class="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700"
              >
                ...
              </span>
            </template>
            <button
              @click="nextPage"
              :disabled="currentPage === totalPages"
              :class="[
                'relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0',
                currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : ''
              ]"
            >
              <span class="sr-only">Siguiente</span>
              <ChevronRightIcon class="h-5 w-5" aria-hidden="true" />
            </button>
          </nav>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="filteredAndSortedDocuments.length === 0 && !isLoading" class="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
      <CubeTransparentIcon class="mx-auto h-12 w-12 text-gray-400" />
      <h3 class="mt-2 text-sm font-medium text-gray-900">No hay plantillas disponibles</h3>
      <p class="mt-1 text-sm text-gray-500">{{ getEmptyStateMessage }}</p>
      <div class="mt-4">
        <div class="text-xs text-gray-400 bg-gray-100 px-3 py-2 rounded-lg inline-block">
          💡 <strong>Tip:</strong> Las plantillas son creadas por los abogados
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="text-center py-12">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-secondary"></div>
      <p class="mt-2 text-sm text-gray-500">Cargando plantillas...</p>
    </div>

    <!-- Modal para nombrar el documento antes de usar la plantilla -->
    <ModalTransition v-show="showUseModal">
      <UseDocumentByClient
        v-if="selectedTemplateId !== null"
        :document-id="selectedTemplateId"
        @close="handleUseModalClose"
      />
    </ModalTransition>
  </div>
</template>

<script setup>
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/vue";
import { computed, ref, onMounted, watch } from "vue";
import { useRouter } from "vue-router";
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  ChevronDownIcon,
  EllipsisVerticalIcon,
  CubeTransparentIcon,
  XMarkIcon,
  DocumentTextIcon,
  ArrowLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from "@heroicons/vue/24/outline";
import { useDynamicDocumentStore } from "@/stores/dynamic_document";
import UseDocumentByClient from "@/components/dynamic_document/client/modals/UseDocumentByClient.vue";
import ModalTransition from "@/components/layouts/animations/ModalTransition.vue";

const documentStore = useDynamicDocumentStore();
const router = useRouter();

const props = defineProps({
  searchQuery: String,
  selectedTags: {
    type: Array,
    default: () => []
  },
});

const emit = defineEmits(["go-back"]);

// Local state
const localSearchQuery = ref("");
const tagSearchQuery = ref("");
const filterByTag = ref(null);
const sortBy = ref("recent");
const isLoading = ref(false);

// Modal state for naming document before use
const showUseModal = ref(false);
const selectedTemplateId = ref(null);

// Menu refs for scroll handling
const menuButtonRefs = ref({});
const menuItemsRefs = ref({});
const isAnyMenuOpen = ref(false);
const openMenuIndex = ref(-1);

// Per-tab pagination state (independent of shared store)
const tabDocuments = ref([]);
const tabPagination = ref({ totalItems: 0, totalPages: 0, currentPage: 1 });
const currentPage = ref(1);
const itemsPerPage = ref(10);

/**
 * Fetch Published templates from the backend.
 * Uses unassigned=true to get only templates (no assigned_to).
 */
const fetchTabData = async (page = 1) => {
  isLoading.value = true;
  try {
    const data = await documentStore.fetchDocumentsForTab({
      states: ['Published'],
      unassigned: true,
      page,
      limit: itemsPerPage.value
    });
    tabDocuments.value = data.items || [];
    tabPagination.value = {
      totalItems: data.totalItems || 0,
      totalPages: data.totalPages || 0,
      currentPage: data.currentPage || page
    };
  } catch (error) {
    console.error('Error fetching published templates:', error);
    tabDocuments.value = [];
  } finally {
    isLoading.value = false;
  }
};

// Documents come directly from the backend via fetchTabData
const publishedDocuments = computed(() => {
  return tabDocuments.value;
});

// Filtered and sorted documents
const filteredAndSortedDocuments = computed(() => {
  let docs = [...publishedDocuments.value];

  // Apply search filter
  const query = localSearchQuery.value.toLowerCase();
  if (query) {
    docs = docs.filter(doc =>
      doc.title?.toLowerCase().includes(query) ||
      doc.tags?.some(tag => tag.name?.toLowerCase().includes(query))
    );
  }

  // Apply tag filter
  if (filterByTag.value) {
    docs = docs.filter(doc =>
      doc.tags && doc.tags.some(tag => tag.id === filterByTag.value)
    );
  }

  // Apply sorting
  if (sortBy.value === 'name') {
    docs.sort((a, b) => {
      const nameA = (a.title || '').toLowerCase();
      const nameB = (b.title || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });
  } else if (sortBy.value === 'recent') {
    docs.sort((a, b) => b.id - a.id);
  }

  return docs;
});

// Available tags
const availableTags = computed(() => {
  const tagsMap = new Map();
  publishedDocuments.value.forEach(doc => {
    if (doc.tags && doc.tags.length > 0) {
      doc.tags.forEach(tag => {
        if (!tagsMap.has(tag.id)) {
          tagsMap.set(tag.id, tag);
        }
      });
    }
  });
  return Array.from(tagsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
});

// Filtered available tags based on search
const filteredAvailableTags = computed(() => {
  if (!tagSearchQuery.value) return availableTags.value;
  const query = tagSearchQuery.value.toLowerCase();
  return availableTags.value.filter(tag => 
    tag.name.toLowerCase().includes(query)
  );
});

// Selected tag name
const selectedTagName = computed(() => {
  if (!filterByTag.value) return null;
  const tag = availableTags.value.find(t => t.id === filterByTag.value);
  return tag ? tag.name : null;
});

// Sort label
const sortLabel = computed(() => {
  switch (sortBy.value) {
    case 'name': return 'Nombre (A-Z)';
    case 'recent':
    default: return 'Más recientes';
  }
});

// Empty state message
const getEmptyStateMessage = computed(() => {
  const hasSearchQuery = localSearchQuery.value && localSearchQuery.value.trim().length > 0;
  const hasTagFilters = filterByTag.value !== null;
  
  if (hasSearchQuery && hasTagFilters) {
    return 'No se encontraron plantillas que coincidan con tu búsqueda y filtros';
  } else if (hasSearchQuery) {
    return 'No se encontraron plantillas que coincidan con tu búsqueda';
  } else if (hasTagFilters) {
    return 'No se encontraron plantillas con la etiqueta seleccionada';
  }
  return 'Aún no hay plantillas disponibles para usar';
});

// Get tag classes
const getTagClasses = (tag) => {
  const colors = [
    'bg-blue-100 text-blue-700',
    'bg-purple-100 text-purple-700',
    'bg-pink-100 text-pink-700',
    'bg-yellow-100 text-yellow-700',
    'bg-green-100 text-green-700'
  ];
  const index = tag.id % colors.length;
  return colors[index];
};

// Get tag color class for the dot indicator
const getTagColorClass = (tag) => {
  const colors = [
    'bg-blue-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-yellow-500',
    'bg-green-500',
    'bg-red-500',
    'bg-indigo-500',
    'bg-orange-500'
  ];
  const index = tag.id % colors.length;
  return colors[index];
};

// Clear filters
const clearFilters = () => {
  filterByTag.value = null;
};

// Modal helpers
const openUseModal = (templateId) => {
  if (templateId) {
    // Ensure we are in create-from-template mode (no selectedDocument)
    documentStore.selectedDocument = null;
    selectedTemplateId.value = templateId;
    showUseModal.value = true;
  }
};

const handleUseModalClose = () => {
  showUseModal.value = false;
  selectedTemplateId.value = null;
};

// Handle document click
const handleDocumentClick = (document) => {
  // All documents in this table are published templates, but keep a safety check
  const isTemplate = document.state === "Published" && !document.assigned_to;

  if (isTemplate) {
    // Open naming modal so user can assign a custom title before generating
    openUseModal(document.id);
  } else {
    // Fallback: direct navigation for non-template documents
    const editRoute = `/dynamic_document_dashboard/document/use/editor/${document.id}/${encodeURIComponent(
      document.title.trim()
    )}`;
    router.push(editRoute);
  }
};

// Go back to Mis Documentos
const goBack = () => {
  emit('go-back');
};

// Pagination computeds
const totalPages = computed(() => {
  return tabPagination.value.totalPages || 1;
});

const paginationInfo = computed(() => {
  const total = tabPagination.value.totalItems || 0;
  const start = total > 0 ? (currentPage.value - 1) * itemsPerPage.value + 1 : 0;
  const end = Math.min(currentPage.value * itemsPerPage.value, total);
  return { start, end, total };
});

const visiblePages = computed(() => {
  const pages = [];
  const total = totalPages.value;
  const current = currentPage.value;
  if (total <= 7) {
    for (let i = 1; i <= total; i++) pages.push(i);
  } else {
    pages.push(1);
    if (current > 3) pages.push('...');
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (current < total - 2) pages.push('...');
    pages.push(total);
  }
  return pages;
});

// Pagination methods
const goToPage = (page) => {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page;
  }
};

const previousPage = () => {
  if (currentPage.value > 1) currentPage.value--;
};

const nextPage = () => {
  if (currentPage.value < totalPages.value) currentPage.value++;
};

// Watch for page changes — fetch the new page from the server
watch(currentPage, (newPage) => {
  fetchTabData(newPage);
});

// Initialize: fetch first page on mount
onMounted(async () => {
  await fetchTabData(1);
});

// Get dynamic minHeight based on open menu index
const getMinHeight = () => {
  if (!isAnyMenuOpen.value) return 'auto';
  
  // Si hay 1 elemento, siempre 280px
  if (filteredAndSortedDocuments.value.length === 1) return '280px';
  
  // Si hay 2 elementos
  if (filteredAndSortedDocuments.value.length === 2) {
    // Si es el segundo elemento (índice 1), necesita más espacio
    return openMenuIndex.value === 1 ? '340px' : '280px';
  }
  
  // Para 3 o más elementos, usar el estándar
  return '280px';
};

// Menu refs handlers
const setMenuButtonRef = (el, index) => {
  if (el) {
    menuButtonRefs.value[index] = el;
  }
};

const setMenuItemsRef = (el, index) => {
  if (el) {
    menuItemsRefs.value[index] = el;
  }
};

// Handle menu open and scroll into view if needed
const handleMenuOpen = (index, wasOpen) => {
  // Track if menu is being opened or closed
  isAnyMenuOpen.value = !wasOpen;
  openMenuIndex.value = wasOpen ? -1 : index;
  
  // Use setTimeout to ensure the menu is rendered before checking position
  if (!wasOpen) {
    setTimeout(() => {
      const menuItems = menuItemsRefs.value[index];
      
      if (menuItems) {
        // Get the actual DOM element (Headless UI components wrap the element)
        const menuElement = menuItems.$el || menuItems;
        
        if (menuElement && menuElement.getBoundingClientRect) {
          const rect = menuElement.getBoundingClientRect();
          const viewportHeight = window.innerHeight;
          
          // Special handling for first row (index 0) - always ensure it's fully visible
          if (index === 0) {
            // Check if menu extends below viewport
            if (rect.bottom > viewportHeight - 20) {
              const scrollAmount = rect.bottom - viewportHeight + 40;
              window.scrollBy({ 
                top: scrollAmount, 
                behavior: 'smooth'
              });
            }
          } else {
            // For other rows, use standard logic
            
            // Check if menu is cut off at the bottom of viewport
            if (rect.bottom > viewportHeight - 10) {
              const scrollAmount = rect.bottom - viewportHeight + 30;
              window.scrollBy({ 
                top: scrollAmount, 
                behavior: 'smooth'
              });
            }
            // Check if menu is cut off at the top of viewport
            else if (rect.top < 80) {
              const scrollAmount = rect.top - 100;
              window.scrollBy({ 
                top: scrollAmount, 
                behavior: 'smooth'
              });
            }
          }
        }
      }
    }, 100);
  }
};

</script>
