<template>
  <div class="document-list-client-table">
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
              placeholder="Buscar..."
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

        <!-- Right side: Sort and Actions -->
        <div class="flex items-center gap-3 w-full lg:w-auto">
          <!-- Results count -->
          <span class="text-sm text-gray-500 whitespace-nowrap">
            {{ filteredAndSortedDocuments.length }} {{ filteredAndSortedDocuments.length === 1 ? 'resultado' : 'resultados' }}
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
    <div class="bg-white rounded-lg shadow-sm border border-gray-200">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Documento
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Estado
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Información clave
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Docs. Asociados
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Etiqueta
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr
              v-for="(document, index) in paginatedDocuments"
              :key="document.id"
              class="hover:bg-gray-50 cursor-pointer transition-colors"
              @click="handleDocumentClick(document)"
            >
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                  <div class="flex-shrink-0 h-10 w-10">
                    <div class="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                      <DocumentTextIcon class="h-5 w-5 text-blue-600" />
                    </div>
                  </div>
                  <div class="ml-4">
                    <div class="text-sm font-medium text-gray-900">{{ document.title }}</div>
                  </div>
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span 
                  class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full"
                  :class="getStatusClasses(document)"
                >
                  {{ getStatusText(document) }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center gap-2">
                  <button
                    v-if="hasSummary(document)"
                    type="button"
                    class="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100"
                    @click.stop="openSummaryModal(document)"
                  >
                    Ver detalle
                  </button>
                  <span v-else class="text-gray-400 text-xs">
                    Sin clasificación
                  </span>
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="relative inline-flex group">
                  <button
                    type="button"
                    :disabled="document.state !== 'Completed' || !document.relationships_count || document.relationships_count === 0"
                    :class="[
                      'inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                      document.state === 'Completed' && document.relationships_count && document.relationships_count > 0
                        ? 'border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 cursor-pointer'
                        : 'border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed opacity-60'
                    ]"
                    @click.stop="document.state === 'Completed' && document.relationships_count > 0 && openModal('relationships', document)"
                  >
                    <span v-if="document.state === 'Completed' && document.relationships_count && document.relationships_count > 0">
                      Ver asociaciones ({{ document.relationships_count }})
                    </span>
                    <span v-else-if="document.state === 'Completed'">
                      Sin asociaciones
                    </span>
                    <span v-else>
                      Ver asociaciones
                    </span>
                  </button>
                  <div
                    v-if="document.state !== 'Completed'"
                    class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-900 text-white text-xs rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50"
                  >
                    Solo puedes administrar asociaciones cuando el documento está completado.
                    <div class="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900"></div>
                  </div>
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex flex-wrap gap-1">
                  <span
                    v-for="tag in document.tags"
                    :key="tag.id"
                    class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full"
                    :class="getTagClasses(tag)"
                  >
                    {{ tag.name }}
                  </span>
                  <span v-if="!document.tags || document.tags.length === 0" class="text-sm text-gray-400">-</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
        <div class="flex flex-1 justify-between sm:hidden">
          <button
            @click="previousPage"
            :disabled="currentPage === 1"
            :class="[
              'relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50',
              currentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''
            ]"
          >
            Anterior
          </button>
          <button
            @click="nextPage"
            :disabled="currentPage === totalPages"
            :class="[
              'relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50',
              currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : ''
            ]"
          >
            Siguiente
          </button>
        </div>
        <div class="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
          <div>
            <p class="text-sm text-gray-700">
              Mostrando
              <span class="font-medium">{{ paginationInfo.start }}</span>
              a
              <span class="font-medium">{{ paginationInfo.end }}</span>
              de
              <span class="font-medium">{{ paginationInfo.total }}</span>
              resultados
            </p>
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
      <div v-if="filteredAndSortedDocuments.length === 0" class="text-center py-12">
        <CubeTransparentIcon class="mx-auto h-12 w-12 text-gray-400" />
        <h3 class="mt-2 text-sm font-medium text-gray-900">No hay documentos</h3>
        <p class="mt-1 text-sm text-gray-500">Los documentos asignados por tu abogado aparecerán aquí.</p>
      </div>
    </div>
  </div>

  <!-- Modals usando Teleport para renderizar en body -->
  <teleport to="body">
    <EditDocumentModal
      v-if="activeModals.edit.isOpen"
      :document="activeModals.edit.document"
      :user-role="activeModals.edit.userRole"
      @close="closeModal('edit')"
      @refresh="emit('refresh')"
    />
    
    <SendDocumentModal
      v-if="activeModals.email.isOpen"
      :document="activeModals.email.document"
      @close="closeModal('email')"
    />
    
    <LetterheadModal
      v-if="activeModals.letterhead.isOpen"
      :is-visible="true"
      :document="activeModals.letterhead.document"
      @close="closeModal('letterhead')"
      @refresh="emit('refresh')"
    />
    
    <DocumentRelationshipsModal
      v-if="activeModals.relationships.isOpen"
      :is-open="true"
      :document="activeModals.relationships.document"
      @close="closeModal('relationships')"
      @refresh="emit('refresh')"
    />
    
    <DocumentActionsModal
      v-if="showActionsModal"
      :is-visible="showActionsModal"
      :document="selectedDocumentForActions"
      card-type="client"
      context="table"
      :user-store="userStore"
      @close="showActionsModal = false"
      @action="handleModalAction"
    />

    <DocumentSummaryModal
      v-if="showSummaryModal"
      :is-visible="showSummaryModal"
      :document="summaryDocument"
      @close="showSummaryModal = false"
    />
  </teleport>
</template>

<script setup>
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/vue";
import { computed, ref, onMounted, watch } from "vue";
import { useRouter } from "vue-router";
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  ChevronDownIcon,
  CubeTransparentIcon,
  XMarkIcon,
  DocumentTextIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from "@heroicons/vue/24/outline";
import { useDynamicDocumentStore } from "@/stores/dynamic_document";
import { useUserStore } from "@/stores/auth/user";
import { useDocumentActions, useCardModals } from "@/components/dynamic_document/cards";
import EditDocumentModal from "@/components/dynamic_document/cards/modals/EditDocumentModal.vue";
import SendDocumentModal from "@/components/dynamic_document/cards/modals/SendDocumentModal.vue";
import LetterheadModal from "@/components/dynamic_document/common/LetterheadModal.vue";
import DocumentRelationshipsModal from "@/components/dynamic_document/modals/DocumentRelationshipsModal.vue";
import DocumentActionsModal from "@/components/dynamic_document/common/DocumentActionsModal.vue";
import DocumentSummaryModal from "@/components/dynamic_document/common/DocumentSummaryModal.vue";
import { useBasicUserRestrictions } from "@/composables/useBasicUserRestrictions";

const documentStore = useDynamicDocumentStore();
const userStore = useUserStore();
const router = useRouter();

const emit = defineEmits([
  'refresh',
  'open-letterhead',
  'open-relationships',
  'open-electronic-signature',
]);

// Basic user restrictions
const { handleFeatureAccess } = useBasicUserRestrictions();

// Setup modals and actions
const { activeModals, openModal, closeModal } = useCardModals(documentStore, userStore);
const {
  handlePreviewDocument,
  deleteDocument,
  downloadPDFDocument,
  downloadWordDocument,
  formalizeDocument,
  signDocument
} = useDocumentActions(documentStore, userStore, emit);

// Summary modal state
const showSummaryModal = ref(false);
const summaryDocument = ref(null);

const openSummaryModal = (document) => {
  summaryDocument.value = document;
  showSummaryModal.value = true;
};

// Watch activeModals changes
watch(activeModals, (newVal) => {
  // Handle activeModals changes
}, { deep: true });

// Initialize component
onMounted(() => {
  documentStore.init();
  userStore.init();
});

const props = defineProps({
  searchQuery: String,
  selectedTags: {
    type: Array,
    default: () => []
  },
});

// Local state
const localSearchQuery = ref("");
const tagSearchQuery = ref("");
const filterByTag = ref(null);
const sortBy = ref('recent');

// Get current user
const currentUser = computed(() => userStore.getCurrentUser);

// Get client documents (Progress and Completed)
const clientDocuments = computed(() => {
  if (!currentUser.value) return [];
  return documentStore.progressAndCompletedDocumentsByClient(currentUser.value.id);
});

// Filtered and sorted documents
const filteredAndSortedDocuments = computed(() => {
  let docs = [...clientDocuments.value];

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
    // Sort by updated_at (most recent first)
    docs.sort((a, b) => {
      const dateA = new Date(a.updated_at || a.created_at);
      const dateB = new Date(b.updated_at || b.created_at);
      return dateB - dateA;
    });
  }

  return docs;
});

// Pagination state
const currentPage = ref(1);
const itemsPerPage = ref(10);

// Paginated documents
const paginatedDocuments = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value;
  const end = start + itemsPerPage.value;
  return filteredAndSortedDocuments.value.slice(start, end);
});

// Total pages
const totalPages = computed(() => {
  return Math.ceil(filteredAndSortedDocuments.value.length / itemsPerPage.value);
});

// Pagination info
const paginationInfo = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value + 1;
  const end = Math.min(currentPage.value * itemsPerPage.value, filteredAndSortedDocuments.value.length);
  return { start, end, total: filteredAndSortedDocuments.value.length };
});

// Reset to first page when filters change
watch([localSearchQuery, filterByTag, sortBy], () => {
  currentPage.value = 1;
});

// Visible pages for pagination (show max 7 pages)
const visiblePages = computed(() => {
  const total = totalPages.value;
  const current = currentPage.value;
  const pages = [];
  
  if (total <= 7) {
    // Show all pages if total is 7 or less
    for (let i = 1; i <= total; i++) {
      pages.push(i);
    }
  } else {
    // Show pages with ellipsis logic
    if (current <= 4) {
      // Show first 5 pages, then ellipsis, then last page
      for (let i = 1; i <= 5; i++) {
        pages.push(i);
      }
      pages.push('...');
      pages.push(total);
    } else if (current >= total - 3) {
      // Show first page, ellipsis, then last 5 pages
      pages.push(1);
      pages.push('...');
      for (let i = total - 4; i <= total; i++) {
        pages.push(i);
      }
    } else {
      // Show first page, ellipsis, current-1, current, current+1, ellipsis, last page
      pages.push(1);
      pages.push('...');
      pages.push(current - 1);
      pages.push(current);
      pages.push(current + 1);
      pages.push('...');
      pages.push(total);
    }
  }
  
  return pages;
});

// Pagination functions
const previousPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--;
  }
};

const nextPage = () => {
  if (currentPage.value < totalPages.value) {
    currentPage.value++;
  }
};

const goToPage = (page) => {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page;
  }
};

// Available tags
const availableTags = computed(() => {
  const tagsMap = new Map();
  clientDocuments.value.forEach(doc => {
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

// Get status text
const getStatusText = (document) => {
  if (document.state === 'Completed') return 'Completado';
  if (document.state === 'Progress') return 'En Progreso';
  return document.state || 'Sin estado';
};

// Get status classes
const getStatusClasses = (document) => {
  if (document.state === 'Completed') {
    return 'bg-green-100 text-green-700 border border-green-200';
  }
  if (document.state === 'Progress') {
    return 'bg-blue-100 text-blue-700 border border-blue-200';
  }
  return 'bg-gray-100 text-gray-700 border border-gray-200';
};

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

// Handle document click - Open actions modal
const showActionsModal = ref(false);
const selectedDocumentForActions = ref(null);

const handleDocumentClick = (document) => {
  // Open actions modal instead of navigating directly
  selectedDocumentForActions.value = document;
  showActionsModal.value = true;
};

const handleModalAction = async (action, document) => {
  showActionsModal.value = false;
  await handleMenuAction(action, document);
};

// Handle menu action - Central handler for all document actions
const handleMenuAction = async (action, document) => {
  try {
    switch (action) {
      case "editForm":
        openModal('edit', document, { userRole: userStore.currentUser?.role || 'client' });
        break;
        
      case "editDocument":
        router.push(`/dynamic_document_dashboard/client/editor/edit/${document.id}`);
        break;
        
      case "preview":
        await handlePreviewDocument(document);
        break;
        
      case "delete":
        await deleteDocument(document);
        break;
        
      case "letterhead":
        handleFeatureAccess('Membrete Individual', () => {
          openModal('letterhead', document);
        });
        break;
        
      case "relationships":
        openModal('relationships', document);
        break;
        
      case "downloadPDF":
        await downloadPDFDocument(document);
        break;
        
      case "downloadWord":
        await downloadWordDocument(document);
        break;
        
      case "email":
        openModal('email', document);
        break;
        
      case "formalize":
        await formalizeDocument(document);
        break;
        
      case "viewSignatures":
        openModal('signatures', document);
        break;
        
      case "sign":
        await signDocument(document, openModal);
        break;
        
      default:
        console.warn("Unknown action:", action);
    }
  } catch (error) {
    console.error(`Error executing action ${action}:`, error);
  }
};

// --- Helpers for summary fields (clasificación) ---
const getSummaryCounterparty = (document) => {
  return document.summary_counterparty || '';
};

const getSummaryValue = (document) => {
  if (!document.summary_value) return '';
  const currency = document.summary_value_currency || '';
  if (currency) {
    return `${currency} ${document.summary_value}`;
  }
  return document.summary_value;
};

const formatDate = (value) => {
  if (!value) return '';
  if (typeof value === 'string') {
    return value.split('T')[0];
  }
  return value;
};

const hasSummary = (document) => {
  return Boolean(
    getSummaryCounterparty(document) ||
    document.summary_object ||
    getSummaryValue(document) ||
    document.summary_term ||
    document.summary_subscription_date ||
    document.summary_start_date ||
    document.summary_end_date
  );
};
</script>
