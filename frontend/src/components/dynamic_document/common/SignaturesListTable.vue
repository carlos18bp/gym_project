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
                Estado Firma
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
                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full" :class="getSignatureStatusClasses(document)">
                  {{ getSignatureStatusText(document) }}
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
                      <MenuItem v-if="state === 'PendingSignatures'" v-slot="{ active }">
                        <a @click="handleSignDocument(document)" :class="[active ? 'bg-gray-100' : '', 'block px-4 py-2 text-sm text-gray-700 cursor-pointer']">
                          Firmar
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
      <div v-if="filteredAndSortedDocuments.length === 0 && !isLoading" class="text-center py-12">
        <CubeTransparentIcon class="mx-auto h-12 w-12 text-gray-400" />
        <h3 class="mt-2 text-sm font-medium text-gray-900">{{ emptyMessage }}</h3>
        <p class="mt-1 text-sm text-gray-500">{{ getDetailedEmptyMessage }}</p>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="text-center py-12">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-secondary"></div>
        <p class="mt-2 text-sm text-gray-500">Cargando documentos...</p>
      </div>
    </div>

    <!-- Preview modal -->
    <DocumentPreviewModal
      :isVisible="showPreviewModal"
      :documentData="previewDocumentData"
      @close="showPreviewModal = false"
    />
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
  DocumentTextIcon
} from "@heroicons/vue/24/outline";
import { useUserStore } from "@/stores/auth/user";
import { useDynamicDocumentStore } from "@/stores/dynamic_document";
import { get_request } from "@/stores/services/request_http";
import { showNotification } from "@/shared/notification_message";
import DocumentPreviewModal from "@/components/dynamic_document/common/DocumentPreviewModal.vue";
import { showPreviewModal, previewDocumentData } from "@/shared/document_utils";

// Props
const props = defineProps({
  state: {
    type: String,
    required: true,
    validator: (value) => ['PendingSignatures', 'FullySigned'].includes(value)
  },
  searchQuery: {
    type: String,
    default: ''
  },
  selectedTags: {
    type: Array,
    default: () => []
  }
});

// Emits
const emit = defineEmits(['refresh']);

// Store instances
const userStore = useUserStore();
const documentStore = useDynamicDocumentStore();
const router = useRouter();

// Reactive state
const documents = ref([]);
const isLoading = ref(false);
const localSearchQuery = ref("");
const tagSearchQuery = ref("");
const filterByTag = ref(null);
const sortBy = ref('recent');
const selectedDocuments = ref([]);

const emptyMessage = computed(() => {
  return props.state === 'PendingSignatures'
    ? 'No tienes documentos pendientes por firmar'
    : 'No tienes documentos firmados';
});

const getDetailedEmptyMessage = computed(() => {
  return props.state === 'PendingSignatures'
    ? 'Cuando tengas documentos que requieran tu firma electrónica aparecerán aquí.'
    : 'Una vez que firmes documentos electrónicamente, aparecerán aquí.';
});

const filteredDocuments = computed(() => {
  const userRole = userStore.currentUser.role;
  const userId = userStore.currentUser.id;
  const userEmail = userStore.currentUser.email;
  
  let storeDocuments = [];
  
  // Role-specific logic
  if (userRole === 'lawyer') {
    if (props.state === 'PendingSignatures') {
      storeDocuments = documentStore.pendingSignatureDocuments.filter(doc => {
        return doc.created_by === userId;
      });
    } else {
      storeDocuments = documentStore.fullySignedDocuments.filter(doc => 
        doc.created_by === userId
      );
    }
  } else {
    if (props.state === 'PendingSignatures') {
      storeDocuments = documentStore.documents.filter(doc => {
        if (doc.state !== 'PendingSignatures') return false;
        const isSigner = doc.signatures?.some(sig => sig.signer_email === userEmail);
        return isSigner;
      });
    } else {
      storeDocuments = documentStore.documents.filter(doc => {
        if (doc.state !== 'FullySigned') return false;
        const isSigner = doc.signatures?.some(sig => 
          sig.signer_email === userEmail && sig.signed
        );
        return isSigner;
      });
    }
  }
  
  return storeDocuments;
});

// Filtered and sorted documents
const filteredAndSortedDocuments = computed(() => {
  let docs = [...filteredDocuments.value];

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
  filteredDocuments.value.forEach(doc => {
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

// Selected tag name for display
const selectedTagName = computed(() => {
  if (!filterByTag.value) return null;
  const tag = availableTags.value.find(t => t.id === filterByTag.value);
  return tag ? tag.name : null;
});

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

// Sort label
const sortLabel = computed(() => {
  switch (sortBy.value) {
    case 'name': return 'Nombre (A-Z)';
    case 'recent':
    default: return 'Más recientes';
  }
});

// Get tag badge classes
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

// Get signature status classes
const getSignatureStatusClasses = (document) => {
  if (props.state === 'FullySigned') {
    return 'bg-green-100 text-green-700 border border-green-200';
  }
  return 'bg-yellow-100 text-yellow-700 border border-yellow-200';
};

// Get signature status text
const getSignatureStatusText = (document) => {
  if (props.state === 'FullySigned') {
    return 'Firmado';
  }
  return 'Pendiente';
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

  const headers = ['Nombre Documento', 'Estado Firma', 'Etiquetas'];
  const rows = documentsToExport.map(doc => [
    doc.title || '',
    getSignatureStatusText(doc),
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
  link.setAttribute('download', `documentos_firmas_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Handle document click
const handleDocumentClick = (document) => {
  router.push({ name: 'dynamic_document_detail', params: { id: document.id } });
};

// Handle sign document
const handleSignDocument = (document) => {
  router.push({ name: 'sign_document', params: { id: document.id } });
};

// Refresh documents
const refreshDocuments = async () => {
  isLoading.value = true;
  try {
    await documentStore.init(true);
  } catch (error) {
    console.error('Error refreshing documents:', error);
    showNotification('Error al actualizar documentos', 'error');
  } finally {
    isLoading.value = false;
  }
};

const handleRefresh = async () => {
  await refreshDocuments();
  emit('refresh');
};

onMounted(async () => {
  await refreshDocuments();
});

// Expose refresh function
defineExpose({
  refresh: handleRefresh
});

// Watch for changes
watch(
  () => userStore.currentUser,
  () => {
    handleRefresh();
  }
);
</script>
