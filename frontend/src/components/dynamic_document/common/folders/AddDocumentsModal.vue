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
                {{ getFilteredDocumentsByCategory(category.name).length }}
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
                  {{ getFilteredDocumentsByCategory(activeDocumentCategory).length }}
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
                  {{ getFilteredDocumentsByCategory(category.name).length }}
                </span>
              </button>
            </div>
          </div>
        </div>

        <!-- Filters Section -->
        <div class="border-b bg-gray-50 p-4 sm:p-6">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <!-- Tag Filter -->
            <div class="flex-1">
              <TagFilter 
                v-model="selectedTags"
                class="max-w-md"
              />
            </div>
            
            <!-- Select All Button -->
            <div v-if="getFilteredDocumentsByCategory(activeDocumentCategory).length > 0" class="flex items-center gap-3">
              <span class="text-sm text-gray-600">
                {{ getFilteredDocumentsByCategory(activeDocumentCategory).length }} documento(s) disponible(s)
              </span>
              <button
                @click="toggleSelectAllFiltered"
                :class="[
                  'px-4 py-2 rounded-lg border font-medium text-sm transition-colors',
                  areAllFilteredSelected 
                    ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100' 
                    : 'bg-primary text-white border-primary hover:bg-primary-dark'
                ]"
              >
                {{ areAllFilteredSelected ? 'Deseleccionar todos' : 'Seleccionar todos' }}
              </button>
            </div>
          </div>
        </div>

        <!-- Documents Content -->
        <div class="p-4 sm:p-6 overflow-y-auto max-h-[calc(90vh-350px)]">
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <template v-for="document in getFilteredDocumentsByCategory(activeDocumentCategory)" :key="document.id">
              <div class="relative">
                <!-- My Documents -->
                <DocumentCard
                  v-if="activeDocumentCategory === 'my-documents'"
                  :document="document"
                  :highlighted-doc-id="null"
                  :show-tags="false"
                  :show-client-name="false"
                  :menu-options="[]"
                  :disable-internal-actions="true"
                  :additional-classes="selectedDocuments.includes(document.id) ? 'ring-2 ring-primary bg-primary-50' : ''"
                  @click="toggleDocumentSelection(document.id)"
                />

                <!-- Use Documents (Minutas) -->
                <UseDocumentCard
                  v-if="activeDocumentCategory === 'use-documents'"
                  :document="document"
                  :show-tags="false"
                  :menu-options="[]"
                  :show-menu-options="false"
                  :disable-internal-actions="true"
                  :additional-classes="selectedDocuments.includes(document.id) ? 'ring-2 ring-primary bg-primary-50' : ''"
                  @click="toggleDocumentSelection(document.id)"
                />

                <!-- Pending Signatures Documents -->
                <SignatureDocumentCard
                  v-if="activeDocumentCategory === 'pending-signatures'"
                  :document="document"
                  :highlighted-doc-id="null"
                  :show-tags="false"
                  :menu-options="[]"
                  :disable-internal-actions="true"
                  :additional-classes="selectedDocuments.includes(document.id) ? 'ring-2 ring-primary bg-primary-50' : ''"
                  @click="toggleDocumentSelection(document.id)"
                />

                <!-- Signed Documents -->
                <SignatureDocumentCard
                  v-if="activeDocumentCategory === 'signed-documents'"
                  :document="document"
                  :highlighted-doc-id="null"
                  :show-tags="false"
                  :menu-options="[]"
                  :disable-internal-actions="true"
                  :additional-classes="selectedDocuments.includes(document.id) ? 'ring-2 ring-primary bg-primary-50' : ''"
                  @click="toggleDocumentSelection(document.id)"
                />

                <!-- Etiquetas button -->
                <button
                  v-if="document.tags && document.tags.length > 0"
                  type="button"
                  class="absolute bottom-2 right-2 px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 inline-flex items-center gap-1"
                  @click.stop="openTagsModal(document)"
                >
                  <span>Etiquetas</span>
                </button>

                <!-- Selection indicator -->
                <div
                  v-if="selectedDocuments.includes(document.id)"
                  class="absolute top-2 left-2 w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center shadow-sm"
                >
                  <CheckIcon class="w-4 h-4" />
                </div>
              </div>
            </template>
          </div>

          <!-- No documents available message -->
          <div v-if="getFilteredDocumentsByCategory(activeDocumentCategory).length === 0" class="text-center py-8 sm:py-12">
            <DocumentIcon class="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-4" />
            <h4 class="text-lg font-medium text-gray-900 mb-2">
              {{ selectedTags.length > 0 ? 'No hay documentos que coincidan con el filtro' : 'No hay documentos disponibles' }}
            </h4>
            <p class="text-gray-600 text-sm sm:text-base">
              {{ selectedTags.length > 0 
                ? 'Intenta ajustar los filtros de etiquetas o selecciona otra categoría' 
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

        <!-- Tags List Modal for selected document -->
        <div
          v-if="showTagsModal && tagsModalDocument"
          class="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-50 p-4"
        >
          <div class="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[80vh] flex flex-col">
            <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <div class="flex items-center gap-2">
                <DocumentIcon class="h-5 w-5 text-gray-500" />
                <h2 class="text-sm font-semibold text-gray-900">Etiquetas del documento</h2>
              </div>
              <button
                type="button"
                class="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-100"
                @click="closeTagsModal"
              >
                <XMarkIcon class="h-5 w-5" />
              </button>
            </div>
            <div class="px-4 py-3 border-b border-gray-100 text-xs text-gray-500">
              <span class="font-medium text-gray-700">Documento:</span>
              <span class="ml-1">{{ tagsModalDocument.title || 'Sin título' }}</span>
            </div>
            <div class="px-4 py-3 overflow-y-auto">
              <div
                v-if="!tagsModalDocument.tags || tagsModalDocument.tags.length === 0"
                class="text-sm text-gray-500"
              >
                Este documento no tiene etiquetas.
              </div>
              <ul v-else class="space-y-2 text-sm">
                <li
                  v-for="tag in tagsModalDocument.tags"
                  :key="tag.id"
                  class="flex items-center justify-between gap-2"
                >
                  <div class="flex items-center gap-2 min-w-0">
                    <span
                      class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                      :class="getTagClasses(tag)"
                    >
                      {{ tag.name }}
                    </span>
                  </div>
                  <span v-if="tag.description" class="text-xs text-gray-500 truncate max-w-[8rem]">
                    {{ tag.description }}
                  </span>
                </li>
              </ul>
            </div>
            <div class="px-4 py-3 border-t border-gray-100 flex justify-end">
              <button
                type="button"
                class="px-4 py-2 text-sm font-medium rounded-md border border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
                @click="closeTagsModal"
              >
                Cerrar
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
import { XMarkIcon, CheckIcon, DocumentIcon } from '@heroicons/vue/24/outline';
import ModalTransition from '@/components/layouts/animations/ModalTransition.vue';
import { DocumentCard, UseDocumentCard, SignatureDocumentCard } from '@/components/dynamic_document/cards';
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
const activeDocumentCategory = ref('my-documents');
const isSubmitting = ref(false);
const showCategoryDropdown = ref(false);
const showTagsModal = ref(false);
const tagsModalDocument = ref(null);

// Document categories for the add documents modal - matching Dashboard.vue tabs
const documentCategories = [
  { name: 'my-documents', label: 'Mis Documentos' },
  { name: 'use-documents', label: 'Minutas' },
  { name: 'pending-signatures', label: 'Firmas Pendientes' },
  { name: 'signed-documents', label: 'Documentos Firmados' }
];

// Computed
const currentUser = computed(() => userStore.currentUser);

// Watch for visibility changes
watch(() => props.isVisible, (isVisible) => {
  if (isVisible) {
    selectedDocuments.value = [];
    selectedTags.value = [];
    activeDocumentCategory.value = 'my-documents';
  }
});

// Watch for category changes to clear selections
watch(activeDocumentCategory, () => {
  selectedDocuments.value = [];
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

// Base method to get available documents by category (same as before)
const getAvailableDocumentsByCategory = (category) => {
  if (!props.folder) return [];
  
  const folderDocumentIds = props.folder.documents.map(doc => doc.id);
  let availableDocuments = [];
  
  switch (category) {
    case 'my-documents':
      // Same logic as Dashboard.vue DocumentListClient
      availableDocuments = documentStore.progressAndCompletedDocumentsByClient(currentUser.value?.id);
      break;
      
    case 'use-documents':
      // Same logic as Dashboard.vue UseDocument section
      availableDocuments = documentStore.publishedDocumentsUnassigned;
      break;
      
    case 'pending-signatures':
      // Same logic as Dashboard.vue SignaturesList with state="PendingSignatures"
      availableDocuments = documentStore.documents.filter(doc => 
        doc.state === 'PendingSignatures' && (
          doc.assigned_to === currentUser.value?.id ||
          doc.signatures?.some(sig => sig.signer_email === currentUser.value?.email)
        )
      );
      break;
      
    case 'signed-documents':
      // Same logic as Dashboard.vue SignaturesList with state="FullySigned"
      availableDocuments = documentStore.documents.filter(doc => 
        doc.state === 'FullySigned' && (
          doc.assigned_to === currentUser.value?.id ||
          doc.signatures?.some(sig => sig.signer_email === currentUser.value?.email)
        )
      );
      break;
      
    default:
      availableDocuments = [];
  }
  
  return availableDocuments.filter(doc => !folderDocumentIds.includes(doc.id));
};

// Method that applies tag filtering to available documents
const getFilteredDocumentsByCategory = (category) => {
  const availableDocuments = getAvailableDocumentsByCategory(category);
  
  // If no tags are selected, return all available documents
  if (!selectedTags.value || selectedTags.value.length === 0) {
    return availableDocuments;
  }
  
  // Filter by selected tags (same logic as DocumentListClient.vue)
  const selectedTagIds = selectedTags.value.map(tag => tag.id);
  return availableDocuments.filter(doc => {
    if (!doc.tags || doc.tags.length === 0) return false;
    return doc.tags.some(tag => selectedTagIds.includes(tag.id));
  });
};

const toggleDocumentSelection = (documentId) => {
  const index = selectedDocuments.value.indexOf(documentId);
  if (index > -1) {
    selectedDocuments.value.splice(index, 1);
  } else {
    selectedDocuments.value.push(documentId);
  }
};

// New method to select/deselect all filtered documents
const toggleSelectAllFiltered = () => {
  const filteredDocs = getFilteredDocumentsByCategory(activeDocumentCategory.value);
  const filteredDocIds = filteredDocs.map(doc => doc.id);
  
  if (areAllFilteredSelected.value) {
    // Deselect all filtered documents
    selectedDocuments.value = selectedDocuments.value.filter(id => !filteredDocIds.includes(id));
  } else {
    // Select all filtered documents (add only those not already selected)
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

// Methods for dropdown
const selectCategory = (categoryName) => {
  activeDocumentCategory.value = categoryName;
  showCategoryDropdown.value = false;
};

/**
 * Closes dropdown when clicking outside
 */
const handleClickOutside = (event) => {
  if (!event.target.closest('.relative')) {
    showCategoryDropdown.value = false;
  }
};

// Lifecycle hooks
onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});

// Simple tag color classes similar to other tag modals
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

const openTagsModal = (document) => {
  tagsModalDocument.value = document;
  showTagsModal.value = true;
};

const closeTagsModal = () => {
  showTagsModal.value = false;
  tagsModalDocument.value = null;
};
</script>