<template>
  <div>
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
            <MenuItems class="absolute left-0 z-10 mt-2 w-56 origin-top-left rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none max-h-60 overflow-y-auto">
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
            Mostrando {{ filteredAndSortedDocuments.length }} resultados
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

          <!-- Export Button -->
          <button
            @click="exportDocuments"
            class="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <ArrowDownTrayIcon class="h-4 w-4" />
            Exportar
          </button>

          <!-- More options -->
          <Menu as="div" class="relative">
            <MenuButton class="inline-flex items-center justify-center w-10 h-10 rounded-md hover:bg-gray-100">
              <EllipsisVerticalIcon class="h-5 w-5 text-gray-500" />
            </MenuButton>
            <MenuItems class="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
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
      </div>
    </div>

    <!-- Table -->
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div class="overflow-x-auto">
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
                Etiqueta
              </th>
              <th scope="col" class="w-16 px-6 py-3"></th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr
              v-for="document in filteredAndSortedDocuments"
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
                <div class="text-sm text-gray-900">{{ getClientName(document) }}</div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                  En Progreso
                </span>
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
              <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium" @click.stop>
                <Menu as="div" class="relative inline-block text-left">
                  <MenuButton class="inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-gray-100">
                    <EllipsisVerticalIcon class="h-5 w-5 text-gray-500" />
                  </MenuButton>
                  <MenuItems class="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                    <div class="py-1">
                      <MenuItem v-slot="{ active }">
                        <a @click="handleDocumentClick(document)" :class="[active ? 'bg-gray-100' : '', 'block px-4 py-2 text-sm text-gray-700 cursor-pointer']">
                          Ver detalles
                        </a>
                      </MenuItem>
                      <MenuItem v-slot="{ active }">
                        <a @click="handleEditDocument(document)" :class="[active ? 'bg-gray-100' : '', 'block px-4 py-2 text-sm text-gray-700 cursor-pointer']">
                          Editar
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

      <!-- Empty State -->
      <div v-if="filteredAndSortedDocuments.length === 0" class="text-center py-12">
        <CubeTransparentIcon class="mx-auto h-12 w-12 text-gray-400" />
        <h3 class="mt-2 text-sm font-medium text-gray-900">No hay documentos en progreso</h3>
        <p class="mt-1 text-sm text-gray-500">Los documentos en progreso por clientes aparecerán aquí.</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/vue";
import { computed, ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  ChevronDownIcon,
  ArrowDownTrayIcon,
  EllipsisVerticalIcon,
  CubeTransparentIcon,
  XMarkIcon,
  DocumentTextIcon
} from "@heroicons/vue/24/outline";
import { useDynamicDocumentStore } from "@/stores/dynamic_document";
import { useUserStore } from "@/stores/auth/user";

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

// Local state
const localSearchQuery = ref("");
const filterByTag = ref(null);
const sortBy = ref('recent');
const selectedDocuments = ref([]);

onMounted(() => {
  documentStore.init();
  userStore.init();
});

// Filtered progress documents
const filteredProgressDocuments = computed(() => {
  const allProgressDocuments = documentStore.progressDocumentsByClient;
  const selectedTagIds = props.selectedTags ? props.selectedTags.map(tag => tag.id) : [];
  const searchAndTagFiltered = documentStore.filteredDocumentsBySearchAndTags(
    props.searchQuery, 
    userStore, 
    selectedTagIds
  );
  
  return searchAndTagFiltered.filter((doc) =>
    allProgressDocuments.some((progressDoc) => progressDoc.id === doc.id)
  );
});

// Filtered and sorted documents
const filteredAndSortedDocuments = computed(() => {
  let docs = [...filteredProgressDocuments.value];

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
  filteredProgressDocuments.value.forEach(doc => {
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

// Get client name
const getClientName = (document) => {
  if (document.client_name) return document.client_name;
  if (document.client) {
    return `${document.client.first_name || ''} ${document.client.last_name || ''}`.trim();
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

// Export function
const exportDocuments = () => {
  const documentsToExport = selectedDocuments.value.length > 0
    ? filteredAndSortedDocuments.value.filter(d => selectedDocuments.value.includes(d.id))
    : filteredAndSortedDocuments.value;

  const headers = ['Nombre Documento', 'Cliente', 'Estado', 'Etiquetas'];
  const rows = documentsToExport.map(doc => [
    doc.title || '',
    getClientName(doc),
    'En Progreso',
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
  link.setAttribute('download', `documentos_en_progreso_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Handle document click
const handleDocumentClick = (document) => {
  const editRoute = `/dynamic_document_dashboard/document/use/editor/${document.id}/${encodeURIComponent(document.title.trim())}`;
  router.push(editRoute);
};

// Handle edit document
const handleEditDocument = (document) => {
  const editRoute = `/dynamic_document_dashboard/document/use/editor/${document.id}/${encodeURIComponent(document.title.trim())}`;
  router.push(editRoute);
};
</script>
