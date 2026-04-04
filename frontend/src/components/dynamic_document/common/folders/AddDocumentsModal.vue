<template>
  <ModalTransition v-if="isVisible && folder">
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" @click.self="handleClose">
      <div class="bg-white rounded-xl shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden">
        <!-- Header - Responsive -->
        <div class="border-b">
          <!-- Desktop Header -->
          <div class="hidden sm:flex justify-between items-center p-6">
            <div>
              <h3 class="text-lg font-semibold text-gray-900">Agregar Documentos</h3>
              <p class="text-sm text-gray-600">Selecciona documentos para agregar a "{{ folder.name }}"</p>
            </div>
            <button @click="handleClose" class="text-gray-400 hover:text-gray-500 hover:bg-gray-100 p-2 rounded-lg transition-colors">
              <XMarkIcon class="w-5 h-5" />
            </button>
          </div>

          <!-- Mobile Header -->
          <div class="sm:hidden p-4">
            <div class="flex justify-between items-start mb-2">
              <div class="flex-1 min-w-0 mr-3">
                <h3 class="text-lg font-semibold text-gray-900">Agregar Documentos</h3>
                <p class="text-sm text-gray-600 truncate">Para "{{ folder.name }}"</p>
              </div>
              <button @click="handleClose" class="text-gray-400 hover:text-gray-500 hover:bg-gray-100 p-2 rounded-lg transition-colors flex-shrink-0">
                <XMarkIcon class="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        <!-- Document Categories - Responsive -->
        <div class="border-b">
          <!-- Desktop Tabs -->
          <nav class="hidden sm:flex space-x-8 px-6" aria-label="Tabs">
            <button
              v-for="category in documentCategories"
              :key="category.name"
              @click="activeDocumentCategory = category.name"
              :class="[
                activeDocumentCategory === category.name
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
                'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm'
              ]"
            >
              {{ category.label }}
              <span class="ml-2 bg-gray-100 text-gray-600 py-0.5 px-2 rounded-full text-xs">
                {{ activeDocumentCategory === category.name ? categoryTotalItems : '-' }}
              </span>
            </button>
          </nav>

          <!-- Mobile Dropdown -->
          <div class="sm:hidden relative px-4 py-3">
            <button
              @click="showCategoryDropdown = !showCategoryDropdown"
              class="w-full flex items-center justify-between py-3 px-4 bg-white border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
            >
              <div class="flex items-center">
                <span>{{ documentCategories.find(cat => cat.name === activeDocumentCategory)?.label || 'Seleccionar categoría' }}</span>
                <span class="ml-2 bg-gray-100 text-gray-600 py-0.5 px-2 rounded-full text-xs">
                  {{ categoryTotalItems }}
                </span>
              </div>
              <svg
                :class="['ml-2 h-5 w-5 transition-transform duration-200', showCategoryDropdown ? 'transform rotate-180' : '']"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
              </svg>
            </button>

            <!-- Dropdown Menu -->
            <div
              v-show="showCategoryDropdown"
              class="absolute top-full left-4 right-4 z-50 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg overflow-hidden"
            >
              <button
                v-for="category in documentCategories"
                :key="category.name"
                @click="selectCategory(category.name)"
                :class="[
                  'w-full text-left px-4 py-3 text-sm transition-colors duration-150 flex items-center justify-between',
                  activeDocumentCategory === category.name
                    ? 'bg-primary text-white'
                    : 'text-gray-700 hover:bg-gray-50'
                ]"
              >
                <span>{{ category.label }}</span>
                <span :class="[
                  'py-0.5 px-2 rounded-full text-xs',
                  activeDocumentCategory === category.name
                    ? 'bg-white/20 text-white'
                    : 'bg-gray-100 text-gray-600'
                ]">
                  {{ activeDocumentCategory === category.name ? categoryTotalItems : '-' }}
                </span>
              </button>
            </div>
          </div>
        </div>

        <!-- Filters Section -->
        <div class="border-b bg-gray-50 p-4 sm:p-6">
          <div class="flex flex-col sm:flex-row sm:items-center gap-3">
            <!-- Text search -->
            <div class="relative">
              <MagnifyingGlassIcon class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <input
                v-model="searchQuery"
                type="text"
                placeholder="Buscar por nombre..."
                class="pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary w-full sm:w-64"
              />
            </div>

            <!-- Tag Filter -->
            <div class="flex-1">
              <TagFilter
                v-model="selectedTags"
              />
            </div>

            <!-- Item count -->
            <div v-if="categoryTotalItems > 0" class="text-sm text-gray-600 whitespace-nowrap">
              {{ categoryTotalItems }} disponible(s)
            </div>
          </div>
        </div>

        <!-- Documents Content -->
        <div class="p-4 sm:p-6 overflow-y-auto max-h-[calc(90vh-320px)]">
          <!-- Loading state -->
          <div v-if="isCategoryLoading" class="text-center py-10">
            <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p class="mt-3 text-sm text-gray-500">Cargando documentos...</p>
          </div>

          <!-- Table -->
          <div v-else-if="getFilteredDocumentsByCategory(activeDocumentCategory).length > 0" class="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        :checked="areAllFilteredSelected"
                        @change="toggleSelectAllFiltered"
                        class="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded cursor-pointer"
                      />
                    </th>
                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Documento
                    </th>
                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estado
                    </th>
                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Etiquetas
                    </th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                  <tr
                    v-for="document in getFilteredDocumentsByCategory(activeDocumentCategory)"
                    :key="document.id"
                    @click="toggleDocumentSelection(document.id)"
                    :class="[
                      'hover:bg-gray-50 cursor-pointer transition-colors duration-150',
                      selectedDocuments.includes(document.id) ? 'bg-primary/5' : ''
                    ]"
                  >
                    <td class="px-4 py-4" @click.stop="toggleDocumentSelection(document.id)">
                      <input
                        type="checkbox"
                        :checked="selectedDocuments.includes(document.id)"
                        class="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded cursor-pointer"
                      />
                    </td>
                    <td class="px-6 py-4">
                      <div class="flex items-center gap-3">
                        <DocumentTextIcon class="h-5 w-5 text-gray-400 flex-shrink-0" />
                        <span class="text-sm font-medium text-gray-900 line-clamp-2 max-w-xs">
                          {{ document.title || 'Sin título' }}
                        </span>
                      </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <span
                        :class="getStatusBadgeClass(document)"
                        class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full"
                      >
                        {{ getStatusText(document) }}
                      </span>
                    </td>
                    <td class="px-6 py-4">
                      <div class="flex flex-wrap gap-1">
                        <span
                          v-for="tag in (document.tags || []).slice(0, 2)"
                          :key="tag.id"
                          :class="getTagClasses(tag)"
                          class="px-2 py-0.5 text-xs rounded-full"
                        >
                          {{ tag.name }}
                        </span>
                        <span
                          v-if="(document.tags || []).length > 2"
                          class="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600"
                        >
                          +{{ document.tags.length - 2 }}
                        </span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Pagination controls -->
          <div v-if="categoryTotalPages > 1" class="flex items-center justify-between mt-4 pt-3 border-t border-gray-200">
            <p class="text-sm text-gray-700">
              Página <span class="font-medium">{{ categoryPage }}</span> de <span class="font-medium">{{ categoryTotalPages }}</span>
            </p>
            <nav class="flex items-center gap-2">
              <button
                @click="categoryPage > 1 && fetchCategoryDocuments(activeDocumentCategory, categoryPage - 1)"
                :disabled="categoryPage <= 1 || isCategoryLoading"
                class="px-3 py-1.5 text-sm font-medium rounded-md border transition-colors disabled:opacity-50 disabled:cursor-not-allowed border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Anterior
              </button>
              <button
                @click="categoryPage < categoryTotalPages && fetchCategoryDocuments(activeDocumentCategory, categoryPage + 1)"
                :disabled="categoryPage >= categoryTotalPages || isCategoryLoading"
                class="px-3 py-1.5 text-sm font-medium rounded-md border transition-colors disabled:opacity-50 disabled:cursor-not-allowed border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Siguiente
              </button>
            </nav>
          </div>

          <!-- No documents available message -->
          <div v-if="getFilteredDocumentsByCategory(activeDocumentCategory).length === 0 && !isCategoryLoading" class="text-center py-8 sm:py-12">
            <DocumentIcon class="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-4" />
            <h4 class="text-lg font-medium text-gray-900 mb-2">
              {{ (selectedTags.length > 0 || searchQuery.trim()) ? 'No hay documentos que coincidan con los filtros' : 'No hay documentos disponibles' }}
            </h4>
            <p class="text-gray-600 text-sm sm:text-base">
              {{ (selectedTags.length > 0 || searchQuery.trim())
                ? 'Intenta ajustar los filtros o selecciona otra categoría'
                : 'No tienes documentos de esta categoría que no estén ya en la carpeta'
              }}
            </p>
          </div>
        </div>

        <!-- Footer with actions - Responsive -->
        <div class="border-t bg-gray-50">
          <!-- Desktop Footer -->
          <div class="hidden sm:flex justify-between items-center p-6">
            <div class="text-sm text-gray-600">
              {{ selectedDocuments.length }} documento(s) seleccionado(s)
            </div>
            <div class="flex gap-3">
              <button
                @click="handleClose"
                class="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                @click="handleAddSelectedDocuments"
                :disabled="selectedDocuments.length === 0 || isSubmitting"
                class="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {{ isSubmitting ? 'Agregando...' : `Agregar ${selectedDocuments.length} documento(s)` }}
              </button>
            </div>
          </div>

          <!-- Mobile Footer -->
          <div class="sm:hidden p-4 space-y-3">
            <div class="text-center text-sm text-gray-600">
              {{ selectedDocuments.length }} documento(s) seleccionado(s)
            </div>
            <div class="flex gap-3">
              <button
                @click="handleClose"
                class="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-center font-medium"
              >
                Cancelar
              </button>
              <button
                @click="handleAddSelectedDocuments"
                :disabled="selectedDocuments.length === 0 || isSubmitting"
                class="flex-1 px-4 py-3 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-center font-medium"
              >
                {{ isSubmitting ? 'Agregando...' : 'Agregar' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </ModalTransition>
</template>

<script setup>
import { computed, ref, watch, onMounted, onUnmounted } from 'vue';
import { XMarkIcon, DocumentIcon, MagnifyingGlassIcon, DocumentTextIcon } from '@heroicons/vue/24/outline';
import ModalTransition from '@/components/layouts/animations/ModalTransition.vue';
import TagFilter from '@/components/dynamic_document/common/TagFilter.vue';
import { useDynamicDocumentStore } from '@/stores/dynamic_document';
import { useUserStore } from '@/stores/auth/user';

// Props
const props = defineProps({
  isVisible: {
    type: Boolean,
    required: true
  },
  folder: {
    type: Object,
    default: null
  }
});

// Emits
const emit = defineEmits(['close', 'add-documents']);

// Stores
const documentStore = useDynamicDocumentStore();
const userStore = useUserStore();

// Reactive data
const selectedDocuments = ref([]);
const selectedTags = ref([]);
const searchQuery = ref('');
const activeDocumentCategory = ref('my-documents');
const isSubmitting = ref(false);
const showCategoryDropdown = ref(false);
const categoryDocuments = ref([]);
const isCategoryLoading = ref(false);
const categoryPage = ref(1);
const categoryTotalPages = ref(0);
const categoryTotalItems = ref(0);

// Document categories for the add documents modal - matching Dashboard.vue tabs
const documentCategories = [
  { name: 'my-documents', label: 'Mis Documentos' },
  { name: 'use-documents', label: 'Minutas' },
  { name: 'pending-signatures', label: 'Firmas Pendientes' },
  { name: 'signed-documents', label: 'Documentos Firmados' }
];

// Computed
const currentUser = computed(() => userStore.currentUser);

/**
 * Fetch documents for the active category from the backend.
 */
const fetchCategoryDocuments = async (category, page = 1) => {
  isCategoryLoading.value = true;
  try {
    let options = { limit: 10, page };

    switch (category) {
      case 'my-documents':
        options.states = ['Progress', 'Completed'];
        if (currentUser.value?.id) {
          options.clientId = currentUser.value.id;
        }
        break;
      case 'use-documents':
        options.states = ['Published'];
        options.unassigned = true;
        break;
      case 'pending-signatures':
        options.state = 'PendingSignatures';
        options.userRelated = true;
        break;
      case 'signed-documents':
        options.state = 'FullySigned';
        options.userRelated = true;
        options.signerSigned = true;
        break;
      default:
        categoryDocuments.value = [];
        return;
    }

    const data = await documentStore.fetchDocumentsForTab(options);
    categoryDocuments.value = data.items || [];
    categoryTotalItems.value = data.totalItems || 0;
    categoryTotalPages.value = data.totalPages || 0;
    categoryPage.value = data.currentPage || page;
  } catch (error) {
    console.error('Error fetching documents for category:', error);
    categoryDocuments.value = [];
    categoryTotalItems.value = 0;
    categoryTotalPages.value = 0;
  } finally {
    isCategoryLoading.value = false;
  }
};

// Watch for visibility changes
watch(() => props.isVisible, (isVisible) => {
  if (isVisible) {
    selectedDocuments.value = [];
    selectedTags.value = [];
    searchQuery.value = '';
    activeDocumentCategory.value = 'my-documents';
    categoryPage.value = 1;
    fetchCategoryDocuments('my-documents', 1);
  }
});

// Watch for category changes to clear selections and fetch new data
watch(activeDocumentCategory, (newCategory) => {
  selectedDocuments.value = [];
  searchQuery.value = '';
  categoryPage.value = 1;
  fetchCategoryDocuments(newCategory, 1);
});

// Watch for tag filter changes to clear selections
watch(selectedTags, () => {
  selectedDocuments.value = [];
}, { deep: true });

// Computed to check if all filtered documents are selected
const areAllFilteredSelected = computed(() => {
  const filteredDocs = getFilteredDocumentsByCategory(activeDocumentCategory.value);
  if (filteredDocs.length === 0) return false;
  return filteredDocs.every(doc => selectedDocuments.value.includes(doc.id));
});

// Returns documents not already in the folder
const getAvailableDocumentsByCategory = () => {
  if (!props.folder) return [];
  const folderDocumentIds = props.folder.documents.map(doc => doc.id);
  return categoryDocuments.value.filter(doc => !folderDocumentIds.includes(doc.id));
};

// Applies tag and text filters
const getFilteredDocumentsByCategory = () => {
  let result = getAvailableDocumentsByCategory();

  if (selectedTags.value && selectedTags.value.length > 0) {
    const selectedTagIds = selectedTags.value.map(tag => tag.id);
    result = result.filter(doc => {
      if (!doc.tags || doc.tags.length === 0) return false;
      return doc.tags.some(tag => selectedTagIds.includes(tag.id));
    });
  }

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase();
    result = result.filter(doc => (doc.title || '').toLowerCase().includes(q));
  }

  return result;
};

const toggleDocumentSelection = (documentId) => {
  const index = selectedDocuments.value.indexOf(documentId);
  if (index > -1) {
    selectedDocuments.value.splice(index, 1);
  } else {
    selectedDocuments.value.push(documentId);
  }
};

const toggleSelectAllFiltered = () => {
  const filteredDocs = getFilteredDocumentsByCategory();
  const filteredDocIds = filteredDocs.map(doc => doc.id);

  if (areAllFilteredSelected.value) {
    selectedDocuments.value = selectedDocuments.value.filter(id => !filteredDocIds.includes(id));
  } else {
    const newSelections = filteredDocIds.filter(id => !selectedDocuments.value.includes(id));
    selectedDocuments.value.push(...newSelections);
  }
};

const handleClose = () => {
  emit('close');
};

const handleAddSelectedDocuments = async () => {
  if (selectedDocuments.value.length === 0) return;
  isSubmitting.value = true;
  try {
    await emit('add-documents', selectedDocuments.value);
  } finally {
    isSubmitting.value = false;
  }
};

const selectCategory = (categoryName) => {
  activeDocumentCategory.value = categoryName;
  showCategoryDropdown.value = false;
};

const handleClickOutside = (event) => {
  if (!event.target.closest('.relative')) {
    showCategoryDropdown.value = false;
  }
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});

// Status helpers
const getStatusText = (document) => {
  const map = {
    Draft: 'Borrador',
    Published: 'Publicado',
    Progress: 'En Progreso',
    Completed: 'Completado',
    PendingSignatures: 'Firma Pendiente',
    FullySigned: 'Firmado',
    Rejected: 'Rechazado',
    Expired: 'Expirado',
  };
  return map[document.state] || document.state;
};

const getStatusBadgeClass = (document) => {
  const map = {
    Draft: 'bg-gray-100 text-gray-800',
    Published: 'bg-blue-100 text-blue-800',
    Progress: 'bg-yellow-100 text-yellow-800',
    Completed: 'bg-green-100 text-green-800',
    PendingSignatures: 'bg-orange-100 text-orange-800',
    FullySigned: 'bg-purple-100 text-purple-800',
    Rejected: 'bg-red-100 text-red-800',
    Expired: 'bg-gray-100 text-gray-500',
  };
  return map[document.state] || 'bg-gray-100 text-gray-800';
};

const getTagClasses = (tag) => {
  const colors = [
    'bg-blue-100 text-blue-700',
    'bg-purple-100 text-purple-700',
    'bg-pink-100 text-pink-700',
    'bg-yellow-100 text-yellow-700',
    'bg-green-100 text-green-700'
  ];
  return colors[tag.id % colors.length];
};
</script>
