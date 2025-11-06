<template>
  <div class="document-list-client-table" style="overflow: visible !important;">
    <!-- Filter Bar -->
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6" style="overflow: visible !important;">
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

        </div>
      </div>
    </div>

    <!-- Table -->
    <div style="overflow: visible !important;">
      <div style="overflow: visible !important;">
        <table class="min-w-full divide-y divide-gray-200" style="overflow: visible !important;">
          <thead class="bg-gray-50">
            <tr>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Documento
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Estado
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Firma
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Etiqueta
              </th>
              <th scope="col" class="w-16 px-6 py-3"></th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200" style="overflow: visible !important;">
            <tr
              v-for="document in filteredAndSortedDocuments"
              :key="document.id"
              class="hover:bg-gray-50 cursor-pointer transition-colors"
              style="overflow: visible !important;"
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
                <span 
                  class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full"
                  :class="getSignatureClasses(document)"
                >
                  {{ getSignatureText(document) }}
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
              <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium" style="overflow: visible !important;" @click.stop>
                <Menu as="div" class="relative inline-block text-left" style="overflow: visible !important;">
                  <MenuButton class="inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-gray-100">
                    <EllipsisVerticalIcon class="h-5 w-5 text-gray-500" />
                  </MenuButton>
                  <MenuItems class="absolute right-0 z-[9999] mt-2 w-56 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                    <div class="py-1">
                      <!-- Editar / Completar -->
                      <MenuItem v-if="document.state === 'Completed'" v-slot="{ active }">
                        <a @click="handleEditForm(document)" :class="[active ? 'bg-gray-100' : '', 'block px-4 py-2 text-sm text-gray-700 cursor-pointer']">
                          Editar Formulario
                        </a>
                      </MenuItem>
                      <MenuItem v-if="document.state === 'Completed'" v-slot="{ active }">
                        <a @click="handleEditDocument(document)" :class="[active ? 'bg-gray-100' : '', 'block px-4 py-2 text-sm text-gray-700 cursor-pointer']">
                          Editar Documento
                        </a>
                      </MenuItem>
                      <MenuItem v-if="document.state !== 'Completed'" v-slot="{ active }">
                        <a @click="handleEditForm(document)" :class="[active ? 'bg-gray-100' : '', 'block px-4 py-2 text-sm text-gray-700 cursor-pointer']">
                          Completar
                        </a>
                      </MenuItem>
                      
                      <!-- Previsualizar -->
                      <MenuItem v-if="document.state === 'Completed'" v-slot="{ active }">
                        <a @click="handlePreview(document)" :class="[active ? 'bg-gray-100' : '', 'block px-4 py-2 text-sm text-gray-700 cursor-pointer']">
                          Previsualizar
                        </a>
                      </MenuItem>
                      
                      <!-- Eliminar -->
                      <MenuItem v-slot="{ active }">
                        <a @click="handleDelete(document)" :class="[active ? 'bg-gray-100' : '', 'block px-4 py-2 text-sm text-red-600 cursor-pointer']">
                          Eliminar
                        </a>
                      </MenuItem>
                      
                      <!-- Gestionar Membrete -->
                      <MenuItem v-slot="{ active }">
                        <a @click="handleLetterhead(document)" :class="[active ? 'bg-gray-100' : '', 'block px-4 py-2 text-sm text-gray-700 cursor-pointer']">
                          Gestionar Membrete
                        </a>
                      </MenuItem>
                      
                      <!-- Administrar Asociaciones -->
                      <MenuItem v-slot="{ active }">
                        <a @click="handleRelationships(document)" :class="[active ? 'bg-gray-100' : '', 'block px-4 py-2 text-sm text-gray-700 cursor-pointer']">
                          Administrar Asociaciones
                        </a>
                      </MenuItem>
                      
                      <!-- Descargas y Envío (solo para Completed) -->
                      <MenuItem v-if="document.state === 'Completed'" v-slot="{ active }">
                        <a @click="handleDownloadPDF(document)" :class="[active ? 'bg-gray-100' : '', 'block px-4 py-2 text-sm text-gray-700 cursor-pointer']">
                          Descargar PDF
                        </a>
                      </MenuItem>
                      <MenuItem v-if="document.state === 'Completed'" v-slot="{ active }">
                        <a @click="handleDownloadWord(document)" :class="[active ? 'bg-gray-100' : '', 'block px-4 py-2 text-sm text-gray-700 cursor-pointer']">
                          Descargar Word
                        </a>
                      </MenuItem>
                      <MenuItem v-if="document.state === 'Completed'" v-slot="{ active }">
                        <a @click="handleEmail(document)" :class="[active ? 'bg-gray-100' : '', 'block px-4 py-2 text-sm text-gray-700 cursor-pointer']">
                          Enviar
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
  EllipsisVerticalIcon,
  CubeTransparentIcon,
  XMarkIcon,
  DocumentTextIcon
} from "@heroicons/vue/24/outline";
import { useDynamicDocumentStore } from "@/stores/dynamic_document";
import { useUserStore } from "@/stores/auth/user";
import { useDocumentActions, useCardModals } from "@/components/dynamic_document/cards";
import EditDocumentModal from "@/components/dynamic_document/cards/modals/EditDocumentModal.vue";
import SendDocumentModal from "@/components/dynamic_document/cards/modals/SendDocumentModal.vue";
import LetterheadModal from "@/components/dynamic_document/common/LetterheadModal.vue";
import DocumentRelationshipsModal from "@/components/dynamic_document/modals/DocumentRelationshipsModal.vue";

const documentStore = useDynamicDocumentStore();
const userStore = useUserStore();
const router = useRouter();

const emit = defineEmits(['refresh', 'open-letterhead', 'open-relationships']);

// Setup modals and actions
const { activeModals, openModal, closeModal } = useCardModals(documentStore, userStore);
const {
  handlePreviewDocument,
  deleteDocument,
  downloadPDFDocument,
  downloadWordDocument
} = useDocumentActions(documentStore, userStore, emit);

// Debug: watch activeModals
watch(activeModals, (newVal) => {
  console.log('activeModals changed:', newVal);
}, { deep: true });

// Debug: log on mount
onMounted(() => {
  console.log('DocumentListClientTable mounted');
  console.log('activeModals:', activeModals.value);
  console.log('openModal function:', openModal);
  console.log('LetterheadModal component:', LetterheadModal);
  console.log('DocumentRelationshipsModal component:', DocumentRelationshipsModal);
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

onMounted(() => {
  documentStore.init();
  userStore.init();
});

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
    docs.sort((a, b) => b.id - a.id);
  }

  return docs;
});

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

// Get signature text and classes
const getSignatureText = (document) => {
  // Check if document requires signature
  if (!document.signatures || document.signatures.length === 0) {
    return 'Sin Firma';
  }
  
  // Check if fully signed
  if (document.fully_signed) {
    return 'Firmado';
  }
  
  // Check current user's signature
  const userSignature = document.signatures.find(sig => sig.user_id === currentUser.value?.id);
  if (userSignature) {
    if (userSignature.signed) {
      return 'Firmado';
    } else {
      return 'Pendiente Firmar';
    }
  }
  
  // Check if any signature is pending
  const hasPendingSignatures = document.signatures.some(sig => !sig.signed);
  if (hasPendingSignatures) {
    return 'Pendiente Firmar';
  }
  
  return 'Sin Firma';
};

const getSignatureClasses = (document) => {
  const text = getSignatureText(document);
  
  if (text === 'Sin Firma') {
    return 'bg-yellow-100 text-yellow-700 border border-yellow-200';
  }
  if (text === 'Firmado') {
    return 'bg-green-100 text-green-700 border border-green-200';
  }
  if (text === 'Pendiente Firmar') {
    return 'bg-blue-100 text-blue-700 border border-blue-200';
  }
  if (text === 'Devuelto Sin Firma') {
    return 'bg-red-100 text-red-700 border border-red-200';
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

// Handle document click
const handleDocumentClick = (document) => {
  const editRoute = `/dynamic_document_dashboard/document/use/editor/${document.id}/${encodeURIComponent(document.title.trim())}`;
  router.push(editRoute);
};

// Menu action handlers
const handleEditForm = (document) => {
  console.log('handleEditForm called', document);
  openModal('edit', document, { userRole: userStore.currentUser?.role || 'client' });
};

const handleEditDocument = (document) => {
  console.log('handleEditDocument called', document);
  router.push(`/dynamic_document_dashboard/client/editor/edit/${document.id}`);
};

const handlePreview = async (document) => {
  console.log('handlePreview called', document);
  await handlePreviewDocument(document);
};

const handleDelete = async (document) => {
  console.log('handleDelete called', document);
  await deleteDocument(document);
};

const handleLetterhead = (document) => {
  console.log('handleLetterhead called', document);
  openModal('letterhead', document);
};

const handleRelationships = (document) => {
  console.log('handleRelationships called', document);
  openModal('relationships', document);
};

const handleDownloadPDF = async (document) => {
  console.log('handleDownloadPDF called', document);
  await downloadPDFDocument(document);
};

const handleDownloadWord = async (document) => {
  console.log('handleDownloadWord called', document);
  await downloadWordDocument(document);
};

const handleEmail = (document) => {
  console.log('handleEmail called', document);
  openModal('email', document);
};
</script>
