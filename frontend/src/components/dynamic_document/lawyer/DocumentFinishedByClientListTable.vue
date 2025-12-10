<template>
  <div>
    <!-- Filter Bar -->
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4 mb-6">
      <!-- Search Bar -->
      <div class="mb-4">
        <div class="relative w-full">
          <MagnifyingGlassIcon class="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            v-model="localSearchQuery"
            type="text"
            placeholder="Buscar..."
            class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-secondary focus:border-transparent text-sm"
          />
        </div>
      </div>

      <!-- Filters Section -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
        <Menu as="div" class="relative">
          <MenuButton class="w-full inline-flex items-center justify-between gap-2 px-3 py-2 border border-gray-300 rounded-md bg-white text-sm font-medium text-gray-700 hover:bg-gray-50">
            <div class="flex items-center gap-2 min-w-0">
              <FunnelIcon class="h-4 w-4 flex-shrink-0" />
              <span class="truncate">{{ selectedTagName || 'Etiqueta' }}</span>
            </div>
            <ChevronDownIcon class="h-4 w-4 flex-shrink-0" />
          </MenuButton>
          <MenuItems class="absolute left-0 z-10 mt-2 w-full min-w-[16rem] origin-top-left rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none max-h-60 overflow-y-auto">
            <div class="py-1">
              <MenuItem v-slot="{ active }">
                <a @click="filterByTag = null" :class="[active ? 'bg-gray-100' : '', 'block px-4 py-2 text-sm text-gray-700 cursor-pointer']">
                  Todos
                </a>
              </MenuItem>
              <MenuItem v-for="tag in availableTags" :key="tag.id" v-slot="{ active }">
                <a @click="filterByTag = tag.id" :class="[active ? 'bg-gray-100' : '', 'block px-4 py-2 text-sm text-gray-700 cursor-pointer']">
                  {{ tag.name }}
                </a>
              </MenuItem>
            </div>
          </MenuItems>
        </Menu>

        <div class="flex items-center justify-stretch">
          <button
            v-if="filterByTag"
            @click="clearFilters"
            class="w-full inline-flex items-center justify-center gap-2 px-3 py-2 border border-gray-300 rounded-md bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
            title="Limpiar filtros"
          >
            <XMarkIcon class="h-4 w-4 flex-shrink-0" />
            <span>Limpiar</span>
          </button>
        </div>
      </div>

      <!-- Actions Section -->
      <div class="flex flex-col gap-3 pt-4 border-t border-gray-200">
        <!-- Top row: Results count and Sort -->
        <div class="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <!-- Bottom row: Action buttons -->
          <div class="flex items-center gap-2">
            <!-- Export Button -->
            <button
              @click="exportDocuments"
              class="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <ArrowDownTrayIcon class="h-4 w-4" />
              <span class="hidden sm:inline">Exportar</span>
            </button>

            <!-- More options -->
            <Menu as="div" class="relative">
              <MenuButton class="inline-flex items-center justify-center w-10 h-10 rounded-md hover:bg-gray-100">
                <EllipsisVerticalIcon class="h-5 w-5 text-gray-500" />
              </MenuButton>
              <MenuItems class="absolute left-0 sm:left-auto sm:right-0 z-10 mt-2 w-48 origin-top-left sm:origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                <div class="py-1">
                  <MenuItem v-slot="{ active }">
                    <a @click="selectAll" :class="[active ? 'bg-gray-100' : '', 'block px-4 py-2 text-sm text-gray-700 cursor-pointer']">
                      Seleccionar todo
                    </a>
                  </MenuItem>
                  <MenuItem v-slot="{ active }">
                    <a @click="deselectAll" :class="[active ? 'bg-gray-100' : '', 'block px-4 py-2 text-sm text-gray-700 cursor-pointer']">
                      Deseleccionar todo
                    </a>
                  </MenuItem>
                </div>
              </MenuItems>
            </Menu>
          </div>

          <!-- Right side: Sort -->
          <Menu as="div" class="relative">
            <MenuButton class="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md bg-white text-sm font-medium text-gray-700 hover:bg-gray-50">
              <span class="hidden sm:inline">Ordenar:</span> {{ sortLabel }}
              <ChevronDownIcon class="h-4 w-4" />
            </MenuButton>
            <MenuItems class="absolute left-0 sm:left-auto sm:right-0 z-10 mt-2 w-48 origin-top-left sm:origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
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
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden" style="overflow-x: visible; overflow-y: hidden;">
      <div class="overflow-x-auto" style="overflow-y: visible;">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th scope="col" class="w-12 px-6 py-3">
                <input
                  type="checkbox"
                  :checked="allSelected"
                  @change="toggleSelectAll"
                  class="h-4 w-4 text-secondary border-gray-300 rounded focus:ring-secondary cursor-pointer"
                />
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Nombre Documento
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Cliente
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Estado
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
              <td class="px-6 py-4 whitespace-nowrap" @click.stop>
                <input
                  type="checkbox"
                  :checked="selectedDocuments.includes(document.id)"
                  @change="toggleDocumentSelection(document.id)"
                  class="h-4 w-4 text-secondary border-gray-300 rounded focus:ring-secondary cursor-pointer"
                />
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                  <div class="flex-shrink-0 h-10 w-10">
                    <div class="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                      <DocumentTextIcon class="h-5 w-5 text-green-600" />
                    </div>
                  </div>
                  <div class="ml-4">
                    <div class="text-sm font-medium text-gray-900">{{ document.title }}</div>
                  </div>
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-900">{{ getClientName(document) }}</div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-700 border border-green-200">
                  Completado
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <button
                  type="button"
                  class="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100"
                  @click.stop="openModal('relationships', document)"
                >
                  Ver asociaciones
                </button>
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
    </div>

    <!-- Empty State -->
    <div v-if="filteredAndSortedDocuments.length === 0" class="text-center py-12">
      <CubeTransparentIcon class="mx-auto h-12 w-12 text-gray-400" />
      <h3 class="mt-2 text-sm font-medium text-gray-900">No hay documentos completados</h3>
      <p class="mt-1 text-sm text-gray-500">Los documentos completados por clientes aparecerán aquí.</p>
    </div>

    <!-- Modals using centralized system -->
    <teleport to="body">
      <EditDocumentModal
        v-if="activeModals.edit.isOpen"
        :document="activeModals.edit.document"
        :user-role="getUserRole()"
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
        :is-visible="activeModals.letterhead.isOpen"
        :document="activeModals.letterhead.document"
        @close="closeModal('letterhead')"
        @uploaded="emit('refresh')"
        @deleted="emit('refresh')"
      />
      
      <DocumentRelationshipsModal
        v-if="activeModals.relationships.isOpen"
        :is-open="activeModals.relationships.isOpen"
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
    </teleport>
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
  ArrowDownTrayIcon,
  EllipsisVerticalIcon,
  CubeTransparentIcon,
  XMarkIcon,
  DocumentTextIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from "@heroicons/vue/24/outline";
import { useDynamicDocumentStore } from "@/stores/dynamic_document";
import { useUserStore } from "@/stores/auth/user";
import { getMenuOptionsForCardType } from "@/components/dynamic_document/cards/menuOptionsHelper";
import { useCardModals, useDocumentActions, EditDocumentModal, SendDocumentModal } from "@/components/dynamic_document/cards";
import LetterheadModal from "@/components/dynamic_document/common/LetterheadModal.vue";
import DocumentRelationshipsModal from "@/components/dynamic_document/modals/DocumentRelationshipsModal.vue";
import DocumentActionsModal from "@/components/dynamic_document/common/DocumentActionsModal.vue";

const documentStore = useDynamicDocumentStore();
const userStore = useUserStore();
const router = useRouter();

const props = defineProps({
  searchQuery: String,
  selectedTags: {
    type: Array,
    default: () => []
  },
});

const emit = defineEmits(['refresh']);

// Initialize centralized modal and actions system
const { activeModals, openModal, closeModal, getUserRole } = useCardModals(documentStore, userStore);
const {
  handlePreviewDocument,
  deleteDocument,
  downloadPDFDocument,
  downloadWordDocument
} = useDocumentActions(documentStore, userStore, emit);

// Local state
const localSearchQuery = ref("");
const filterByTag = ref(null);
const sortBy = ref('recent');
const selectedDocuments = ref([]);

// Pagination state
const currentPage = ref(1);
const itemsPerPage = ref(10);

onMounted(() => {
  documentStore.init();
  userStore.init();
});

// Filtered completed documents
const filteredCompletedDocuments = computed(() => {
  const allCompletedDocuments = documentStore.completedDocumentsByClient;
  const selectedTagIds = props.selectedTags ? props.selectedTags.map(tag => tag.id) : [];
  const searchAndTagFiltered = documentStore.filteredDocumentsBySearchAndTags(
    props.searchQuery, 
    userStore, 
    selectedTagIds
  );
  
  return searchAndTagFiltered.filter((doc) =>
    allCompletedDocuments.some((progressDoc) => progressDoc.id === doc.id)
  );
});

// Filtered and sorted documents
const filteredAndSortedDocuments = computed(() => {
  let docs = [...filteredCompletedDocuments.value];

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
watch([localSearchQuery, filterByTag], () => {
  currentPage.value = 1;
});

// Available tags
const availableTags = computed(() => {
  const tagsMap = new Map();
  filteredCompletedDocuments.value.forEach(doc => {
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

// Get client name (use backend summary field which already resolves full name/email del cliente)
const getClientName = (document) => {
  if (document.summary_counterparty) {
    return document.summary_counterparty;
  }
  return 'Cliente';
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

// Selection functions
const allSelected = computed(() => {
  return filteredAndSortedDocuments.value.length > 0 &&
    selectedDocuments.value.length === filteredAndSortedDocuments.value.length;
});

const toggleSelectAll = () => {
  if (allSelected.value) {
    selectedDocuments.value = [];
  } else {
    selectedDocuments.value = filteredAndSortedDocuments.value.map(doc => doc.id);
  }
};

const toggleDocumentSelection = (documentId) => {
  const index = selectedDocuments.value.indexOf(documentId);
  if (index > -1) {
    selectedDocuments.value.splice(index, 1);
  } else {
    selectedDocuments.value.push(documentId);
  }
};

const selectAll = () => {
  selectedDocuments.value = filteredAndSortedDocuments.value.map(doc => doc.id);
};

const deselectAll = () => {
  selectedDocuments.value = [];
};

// Clear filters
const clearFilters = () => {
  filterByTag.value = null;
};

// Pagination methods
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

// Export function
const exportDocuments = () => {
  const documentsToExport = selectedDocuments.value.length > 0
    ? filteredAndSortedDocuments.value.filter(d => selectedDocuments.value.includes(d.id))
    : filteredAndSortedDocuments.value;

  const headers = ['Nombre Documento', 'Cliente', 'Estado', 'Etiquetas'];
  const rows = documentsToExport.map(doc => [
    doc.title || '',
    getClientName(doc),
    'Completado',
    doc.tags ? doc.tags.map(t => t.name).join(', ') : ''
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `documentos_completados_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Handle document click
// Get menu options for a document
const getMenuOptionsForDocument = (document) => {
  return getMenuOptionsForCardType('client', document, 'list', userStore);
};

// Handle menu action
const handleMenuAction = async (action, document) => {
  try {
    switch (action) {
      case "editForm":
        openModal('edit', document, { userRole: getUserRole() });
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
        openModal('letterhead', document);
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
        
      default:
        console.warn("Unknown action:", action);
    }
  } catch (error) {
    console.error(`Error executing action ${action}:`, error);
  }
};

const showActionsModal = ref(false);
const selectedDocumentForActions = ref(null);

const handleDocumentClick = (document) => {
  // Open actions modal instead of navigating
  selectedDocumentForActions.value = document;
  showActionsModal.value = true;
};

const handleModalAction = async (action, document) => {
  showActionsModal.value = false;
  await handleMenuAction(action, document);
};

// Handle edit document
const handleEditDocument = (document) => {
  const editRoute = `/dynamic_document_dashboard/document/use/editor/${document.id}/${encodeURIComponent(document.title.trim())}`;
  router.push(editRoute);
};
</script>
