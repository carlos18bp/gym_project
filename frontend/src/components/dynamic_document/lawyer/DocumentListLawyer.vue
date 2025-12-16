<!--
@deprecated This component is deprecated. Use DocumentListTable from @/components/dynamic_document/common/DocumentListTable.vue instead.
Migration example:
  <DocumentListTable
    card-type="lawyer"
    :show-state-filter="true"
    :show-client-filter="true"
    :show-associations-column="true"
    context="legal-documents"
  />
-->
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
              <span class="truncate">{{ filterByState || 'Estado' }}</span>
            </div>
            <ChevronDownIcon class="h-4 w-4 flex-shrink-0" />
          </MenuButton>
          <MenuItems class="absolute left-0 z-10 mt-2 w-full min-w-[14rem] origin-top-left rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
            <div class="py-1">
              <MenuItem v-slot="{ active }">
                <a @click="filterByState = null" :class="[active ? 'bg-gray-100' : '', 'block px-4 py-2 text-sm text-gray-700 cursor-pointer']">
                  Todos
                </a>
              </MenuItem>
              <MenuItem v-for="state in documentStates" :key="state" v-slot="{ active }">
                <a @click="filterByState = state" :class="[active ? 'bg-gray-100' : '', 'block px-4 py-2 text-sm text-gray-700 cursor-pointer']">
                  {{ getStateLabel(state) }}
                </a>
              </MenuItem>
            </div>
          </MenuItems>
        </Menu>

        <Menu as="div" class="relative">
          <MenuButton class="w-full inline-flex items-center justify-between gap-2 px-3 py-2 border border-gray-300 rounded-md bg-white text-sm font-medium text-gray-700 hover:bg-gray-50">
            <div class="flex items-center gap-2 min-w-0">
              <FunnelIcon class="h-4 w-4 flex-shrink-0" />
              <span class="truncate">{{ selectedTagName || 'Etiqueta' }}</span>
            </div>
            <ChevronDownIcon class="h-4 w-4 flex-shrink-0" />
          </MenuButton>
          <MenuItems class="absolute left-0 z-10 mt-2 w-full min-w-[16rem] origin-top-left rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
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

        <div class="flex items-center justify-stretch">
          <button
            v-if="filterByState || filterByTag"
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
                Nombre Minuta
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Estado
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Contraparte
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Objeto
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Valor
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Plazo
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Fecha Suscripción
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Fecha Inicio
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Fecha Terminación
              </th>
              <th v-if="!isMinutasTab" scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
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
                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full" :class="getStatusBadgeClasses(document)">
                  {{ getStatusText(document) }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span class="text-sm text-gray-900">
                  {{ getSummaryCounterparty(document) || '-' }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span class="text-sm text-gray-900 line-clamp-2 max-w-xs">
                  {{ document.summary_object || '-' }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span class="text-sm text-gray-900">
                  {{ getSummaryValue(document) || '-' }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span class="text-sm text-gray-900">
                  {{ document.summary_term || '-' }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-xs text-gray-900">
                <span v-if="document.summary_subscription_date">
                  {{ formatDate(document.summary_subscription_date) }}
                </span>
                <span v-else class="text-gray-400">-</span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-xs text-gray-900">
                <span v-if="document.summary_start_date">
                  {{ formatDate(document.summary_start_date) }}
                </span>
                <span v-else class="text-gray-400">-</span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-xs text-gray-900">
                <span v-if="document.summary_end_date">
                  {{ formatDate(document.summary_end_date) }}
                </span>
                <span v-else class="text-gray-400">-</span>
              </td>
              <td v-if="!isMinutasTab" class="px-6 py-4 whitespace-nowrap">
                <button
                  type="button"
                  :disabled="!document.relationships_count || document.relationships_count === 0"
                  :class="[
                    'inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                    document.relationships_count && document.relationships_count > 0
                      ? 'border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 cursor-pointer'
                      : 'border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed opacity-60'
                  ]"
                  @click.stop="openModal('relationships', document)"
                >
                  <span v-if="document.relationships_count && document.relationships_count > 0">
                    Ver asociaciones ({{ document.relationships_count }})
                  </span>
                  <span v-else>
                    Sin asociaciones
                  </span>
                </button>
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
    </div>

    <!-- Empty State -->
    <div v-if="filteredAndSortedDocuments.length === 0" class="text-center py-12">
      <CubeTransparentIcon class="mx-auto h-12 w-12 text-gray-400" />
      <h3 class="mt-2 text-sm font-medium text-gray-900">No hay documentos</h3>
      <p class="mt-1 text-sm text-gray-500">No se encontraron documentos con los filtros seleccionados.</p>
    </div>

    <!-- Modal de previsualización -->
    <DocumentPreviewModal
      :isVisible="showPreviewModal"
      :documentData="previewDocumentData"
      @close="showPreviewModal = false"
    />

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
      
      <DocumentSignaturesModal
        v-if="activeModals.signatures.isOpen"
        :document-id="activeModals.signatures.document?.id"
        @close="closeModal('signatures')"
        @refresh="emit('refresh')"
      />
      
      <DocumentPermissionsModal
        v-if="activeModals.permissions.isOpen"
        :is-open="activeModals.permissions.isOpen"
        :document="activeModals.permissions.document"
        @close="closeModal('permissions')"
        @saved="emit('refresh')"
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
        @update-count="handleUpdateRelationshipCount"
      />
      
      <DocumentActionsModal
        v-if="showActionsModal"
        :is-visible="showActionsModal"
        :document="selectedDocumentForActions"
        card-type="lawyer"
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
  CubeTransparentIcon,
  XMarkIcon,
  DocumentTextIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CheckCircleIcon,
  PencilIcon,
  EllipsisVerticalIcon
} from "@heroicons/vue/24/outline";
import { useDynamicDocumentStore } from "@/stores/dynamic_document";
import { useUserStore } from "@/stores/auth/user";
import { showNotification } from "@/shared/notification_message";
import { get_request } from "@/stores/services/request_http";
import { DocumentCard } from "@/components/dynamic_document/cards";
import DocumentPreviewModal from "@/components/dynamic_document/common/DocumentPreviewModal.vue";
import { showPreviewModal, previewDocumentData, openPreviewModal } from "@/shared/document_utils";
import { getMenuOptionsForCardType } from "@/components/dynamic_document/cards/menuOptionsHelper";
import { useCardModals, useDocumentActions, EditDocumentModal, SendDocumentModal, DocumentSignaturesModal, DocumentPermissionsModal } from "@/components/dynamic_document/cards";
import DocumentActionsModal from "@/components/dynamic_document/common/DocumentActionsModal.vue";
import LetterheadModal from "@/components/dynamic_document/common/LetterheadModal.vue";
import DocumentRelationshipsModal from "@/components/dynamic_document/modals/DocumentRelationshipsModal.vue";
import DocumentSummaryModal from "@/components/dynamic_document/common/DocumentSummaryModal.vue";

// Store instance
const documentStore = useDynamicDocumentStore();
const userStore = useUserStore();
const router = useRouter();

// Initialize centralized modal and actions system
const emit = defineEmits(['refresh']);
const { activeModals, openModal, closeModal, getUserRole } = useCardModals(documentStore, userStore);
const {
  handlePreviewDocument,
  deleteDocument,
  downloadPDFDocument,
  downloadWordDocument,
  copyDocument,
  publishDocument,
  moveToDraft,
  formalizeDocument,
  signDocument,
  downloadSignedDocument
} = useDocumentActions(documentStore, userStore, emit);

// Reactive state for pending and signed documents
const pendingSignatureDocuments = ref([]);
const signedDocuments = ref([]);

const props = defineProps({
  searchQuery: String,
  selectedTags: {
    type: Array,
    default: () => []
  },
  promptDocuments: {
    type: Array,
    default: null
  }
});

// Local search query
const localSearchQuery = ref("");
const tagSearchQuery = ref("");

// Filter and sort states
const filterByState = ref(null);
const filterByTag = ref(null);
const sortBy = ref('recent');

// Selection state
const selectedDocuments = ref([]);

// Summary modal state
const showSummaryModal = ref(false);
const summaryDocument = ref(null);

const openSummaryModal = (document) => {
  summaryDocument.value = document;
  showSummaryModal.value = true;
};

// Pagination state
const currentPage = ref(1);
const itemsPerPage = ref(10);

// --- Helper functions for DocumentCard props ---

/**
 * Get status icon based on document state
 */
const getStatusIcon = (document) => {
  if (document.state === 'Published' || document.state === 'FullySigned') {
    return CheckCircleIcon;
  }
  return PencilIcon;
};

/**
 * Get status text based on document state
 */
const getStatusText = (document) => {
  switch (document.state) {
    case 'Published': return 'Publicado';
    case 'Draft': return 'Borrador';
    case 'Progress': return 'En progreso';
    case 'Completed': return 'Completado';
    case 'PendingSignatures': return 'Pendiente de firmas';
    case 'FullySigned': return 'Completamente firmado';
    default: return 'Desconocido';
  }
};

/**
 * Get status badge classes based on document state
 */
const getStatusBadgeClasses = (document) => {
  switch (document.state) {
    case 'Published':
    case 'FullySigned':
      return 'bg-green-100 text-green-700 border border-green-200';
    case 'Draft':
    case 'Progress':
      return 'bg-blue-100 text-blue-700 border border-blue-200';
    case 'PendingSignatures':
      return 'bg-yellow-100 text-yellow-700 border border-yellow-200';
    case 'Completed':
      return 'bg-purple-100 text-purple-700 border border-purple-200';
    default:
      return 'bg-gray-100 text-gray-700 border border-gray-200';
  }
};

/**
 * Get tag badge classes
 */
const getTagClasses = (tag) => {
  // You can customize colors based on tag name or type
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

/**
 * Get state label in Spanish
 */
const getStateLabel = (state) => {
  switch (state) {
    case 'Published': return 'Publicado';
    case 'Draft': return 'Borrador';
    case 'Progress': return 'En progreso';
    case 'Completed': return 'Completado';
    case 'PendingSignatures': return 'Pendiente de firmas';
    case 'FullySigned': return 'Completamente firmado';
    default: return state;
  }
};

// Available document states
const documentStates = computed(() => {
  const states = new Set();
  lawyerManagedNonFullySignedDocuments.value.forEach(doc => {
    if (doc.state) {
      states.add(doc.state);
    }
  });
  return Array.from(states).sort();
});

// Available tags
const availableTags = computed(() => {
  const tagsMap = new Map();
  lawyerManagedNonFullySignedDocuments.value.forEach(doc => {
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

/**
 * Get signature status classes
 */
const getSignatureStatusClasses = (document) => {
  if (document.fully_signed) {
    return 'bg-green-100 text-green-700 border border-green-200';
  } else if (getCurrentUserSignature(document)?.signed && !document.fully_signed) {
    return 'bg-blue-100 text-blue-700 border border-blue-200';
  } else if (getCurrentUserSignature(document) && !getCurrentUserSignature(document)?.signed) {
    return 'bg-yellow-100 text-yellow-700 border border-yellow-200';
  } else {
    return 'bg-gray-100 text-gray-700 border border-gray-200';
  }
};

// --- Start of new computed properties for separate lists ---

// Documents managed by the lawyer (e.g., Draft, Published), EXCLUDING FullySigned
const lawyerManagedNonFullySignedDocuments = computed(() => {
  if (props.promptDocuments) return []; // Not used if promptDocuments are active

  const docs = documentStore.getDocumentsByLawyerId(userStore.currentUser.id) || [];
  const filteredDocs = docs.filter(doc => doc.state !== 'FullySigned');
  
  // Get selected tag IDs
  const selectedTagIds = props.selectedTags ? props.selectedTags.map(tag => tag.id) : [];
  
  // Apply search and tag filters
  const searchAndTagFiltered = documentStore.filteredDocumentsBySearchAndTags(
    props.searchQuery, 
    userStore, 
    selectedTagIds
  );
  
  // Find intersection between lawyer docs and filtered docs
  return searchAndTagFiltered.filter(doc => 
    filteredDocs.some(lawyerDoc => lawyerDoc.id === doc.id)
  );
});

// Filtered prompt documents (if provided)
const displayablePromptDocuments = computed(() => {
  if (props.promptDocuments && props.promptDocuments.length > 0) {
    let filteredPromptDocs = props.promptDocuments.filter(doc => 
      doc.title && doc.title.toLowerCase().includes((props.searchQuery || '').toLowerCase())
    );
    
    // Apply tag filter if tags are selected
    if (props.selectedTags && props.selectedTags.length > 0) {
      const selectedTagIds = props.selectedTags.map(tag => tag.id);
      filteredPromptDocs = filteredPromptDocs.filter(doc => {
        if (!doc.tags || doc.tags.length === 0) return false;
        return doc.tags.some(tag => selectedTagIds.includes(tag.id));
      });
    }
    
    return filteredPromptDocs;
  }
  return [];
});

// Retrieve documents in drafted and published from the store, applying the search filter.
const filteredDocuments = computed(() => {
  if (props.promptDocuments) {
    return displayablePromptDocuments.value;
  }
  return lawyerManagedNonFullySignedDocuments.value;
});

// Determine if we're showing the "Minutas" tab (Draft/Published documents only)
// Minutas should not have the associations column
const isMinutasTab = computed(() => {
  // If all documents in the current view are Draft or Published, it's the Minutas tab
  const docs = filteredDocuments.value;
  if (docs.length === 0) return false;
  
  // Check if all documents are Draft or Published
  return docs.every(doc => doc.state === 'Draft' || doc.state === 'Published');
});

// Filtered and sorted documents
const filteredAndSortedDocuments = computed(() => {
  let documents = [...filteredDocuments.value];

  // Apply search filter
  const query = localSearchQuery.value.toLowerCase();
  if (query) {
    documents = documents.filter(doc =>
      doc.title?.toLowerCase().includes(query) ||
      doc.state?.toLowerCase().includes(query) ||
      doc.tags?.some(tag => tag.name?.toLowerCase().includes(query))
    );
  }

  // Apply state filter
  if (filterByState.value) {
    documents = documents.filter(doc => doc.state === filterByState.value);
  }

  // Apply tag filter
  if (filterByTag.value) {
    documents = documents.filter(doc =>
      doc.tags && doc.tags.some(tag => tag.id === filterByTag.value)
    );
  }

  // Apply sorting
  if (sortBy.value === 'name') {
    documents.sort((a, b) => {
      const nameA = (a.title || '').toLowerCase();
      const nameB = (b.title || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });
  } else if (sortBy.value === 'recent') {
    // Sort by updated_at (most recent first)
    documents.sort((a, b) => {
      const dateA = new Date(a.updated_at || a.created_at);
      const dateB = new Date(b.updated_at || b.created_at);
      return dateB - dateA;
    });
  }

  return documents;
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
watch([localSearchQuery, filterByState, filterByTag], () => {
  currentPage.value = 1;
});

// Sort label
const sortLabel = computed(() => {
  switch (sortBy.value) {
    case 'name': return 'Nombre (A-Z)';
    case 'recent':
    default: return 'Más recientes';
  }
});

// Computed property to determine which document should be highlighted
const highlightedDocId = computed(() => {
  // If we have prompt documents, don't show any highlight from store/localStorage
  if (props.promptDocuments) {
    return null;
  }

  const storeId = documentStore.lastUpdatedDocumentId;
  const localId = localStorage.getItem('lastUpdatedDocumentId');
  
  const allDisplayedDocs = [...lawyerManagedNonFullySignedDocuments.value];
  
  const docExistsInStoreId = storeId && allDisplayedDocs.some(doc => String(doc.id) === String(storeId));
  if (docExistsInStoreId) {
    return storeId;
  }
  
  const docExistsInLocalId = localId && allDisplayedDocs.some(doc => String(doc.id) === String(localId));
  if (docExistsInLocalId) {
    return localId;
  }
  
  return null;
});

/**
 * Fetch pending and signed documents for the current lawyer
 */
const fetchLawyerDocuments = async () => {
  try {
    const userId = userStore.currentUser.id;

    const pendingResponse = await get_request(`dynamic-documents/user/${userId}/pending-documents-full/`);
    const signedResponse = await get_request(`dynamic-documents/user/${userId}/signed-documents/`);

    if (pendingResponse.status === 200) {
      pendingSignatureDocuments.value = pendingResponse.data;
    }

    if (signedResponse.status === 200) {
      signedDocuments.value = signedResponse.data;
    }
  } catch (error) {
    console.error('Error fetching lawyer documents:', error);
    if (error.response) {
      console.error('Error response data:', error.response.data);
      console.error('Error status:', error.response.status);
    }
  }
};

/**
 * Check if the current user is a signer for the document and get their signature record
 * @param {object} document - The document to check
 * @returns {object|null} - The signature record for the current user or null
 */
const getCurrentUserSignature = (document) => {
  // First, verify document has signatures and requires them
  if (!document.signatures || !document.requires_signature) {
    return null;
  }
  
  // Get current user ID as string for comparison
  const currentUserId = String(userStore.currentUser.id);
  
  // Find signature for current user
  return document.signatures.find(sig => String(sig.signer_id) === currentUserId);
};

/**
 * Gets the signature status display text for a document
 * @param {Object} document - The document object
 * @returns {String} - Status text for display
 */
const getSignatureStatus = (document) => {
  if (!document.requires_signature) {
    return '';
  }
  
  if (document.fully_signed) {
    return 'Documento formalizado';
  }
  
  // Check if current user has already signed
  const currentUserSignature = getCurrentUserSignature(document);
  
  if (document.signatures && document.signatures.length > 0) {
    const totalSignatures = document.signatures.length;
    const signedCount = document.signatures.filter(sig => sig.signed).length;
    
    if (currentUserSignature && currentUserSignature.signed) {
      if (signedCount === 1 && totalSignatures > 1) {
        return `Has firmado. Faltan ${totalSignatures - signedCount} firmas más`;
      } else if (signedCount < totalSignatures) {
        return `Has firmado. Faltan ${totalSignatures - signedCount} firmas más`;
      }
    }
    
    return `Firmas: ${signedCount}/${totalSignatures}`;
  }
  
  return currentUserSignature ? 'Requiere tu firma' : 'Requiere firmas';
};

// Make sure highlighted document ID is updated when filtered documents change
watch(filteredDocuments, (newDocs) => {
  // If we have prompt documents, don't update highlights
  if (props.promptDocuments) {
    return;
  }

  // If we have a lastUpdatedDocumentId, verify it exists in the list
  if (documentStore.lastUpdatedDocumentId) {
    const exists = newDocs.some(doc => String(doc.id) === String(documentStore.lastUpdatedDocumentId));
    
    // If not found but we have documents, use the newest one
    if (!exists && newDocs.length > 0) {
      // Sort by ID to get newest document
      const sortedDocs = [...newDocs].sort((a, b) => b.id - a.id);
      const newId = sortedDocs[0].id;
      
      documentStore.lastUpdatedDocumentId = newId;
      localStorage.setItem('lastUpdatedDocumentId', newId);
    }
  }
});

/**
 * Forces highlight on a specific document by directly manipulating DOM
 * @param {string|number} documentId - ID of the document to highlight
 */
const forceHighlight = (documentId) => {
  if (!documentId) return;
  
  // Find the actual DOM element
  setTimeout(() => {
    try {
      // Find element by attribute selector
      const documentElements = document.querySelectorAll(`[data-document-id="${documentId}"]`);
      
      if (documentElements.length > 0) {
        const element = documentElements[0];
        
        // Remove and re-add classes to restart animation
        element.classList.remove("animate-pulse-highlight-green", "animate-pulse-highlight-blue");
        
        // Force a reflow before adding the class again
        void element.offsetWidth;
        
        // Determine which animation to use based on document state
        const documentElement = element.querySelector('[data-document-id]') || element;
        const isPublished = documentElement.classList.contains('border-green-400');
        
        // Add the appropriate animation class
        if (isPublished) {
          element.classList.add("animate-pulse-highlight-green");
        } else {
          element.classList.add("animate-pulse-highlight-blue");
        }
        
        // Ensure visibility
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    } catch (error) {
      console.error("Error forcing highlight:", error);
    }
  }, 100);
};

// Expose the forceHighlight function globally for use by other components
window.forceDocumentHighlight = forceHighlight;

// Handle relationship count update (optimistic update)
const handleUpdateRelationshipCount = ({ documentId, count }) => {
  const document = documentStore.documents.find(doc => doc.id === documentId);
  if (document) {
    document.relationships_count = count;
  }
};

// Initialize data when component mounts
onMounted(async () => {
  // If we have prompt documents, don't initialize highlights
  if (props.promptDocuments) {
    return;
  }

  // Ensure documents are loaded
  await documentStore.init();
  
  const savedId = localStorage.getItem('lastUpdatedDocumentId');
  
  if (savedId) {
    documentStore.lastUpdatedDocumentId = savedId;
    
    // Force detection of changes in Vue
    setTimeout(() => {
      const docExists = filteredDocuments.value.some(doc => String(doc.id) === String(savedId));
      
      // If document exists, force a highlight
      if (docExists) {
        forceHighlight(savedId);
      }
    }, 500);
  }

  // Fetch pending and signed documents
  fetchLawyerDocuments();
});

const handleRefresh = async () => {
  // Refresh the document list
  await documentStore.init();
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
  filterByState.value = null;
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

  // Create CSV content
  const headers = ['Nombre Minuta', 'Estado', 'Etiquetas'];
  const rows = documentsToExport.map(doc => [
    doc.title || '',
    getStatusText(doc),
    doc.tags ? doc.tags.map(t => t.name).join(', ') : ''
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  // Download CSV
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `documentos_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Get menu options for a document
const getMenuOptionsForDocument = (document) => {
  return getMenuOptionsForCardType('lawyer', document, 'list', userStore);
};

// Handle menu action
const handleMenuAction = async (action, document) => {
  try {
    switch (action) {
      case "edit":
        router.push(`/dynamic_document_dashboard/lawyer/editor/edit/${document.id}`);
        break;
        
      case "permissions":
        openModal('permissions', document);
        break;

      case "relationships":
        openModal('relationships', document);
        break;
        
      case "preview":
        await handlePreviewDocument(document);
        break;
        
      case "delete":
        await deleteDocument(document);
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
        
      case "copy":
        await copyDocument(document);
        break;
        
      case "publish":
        await publishDocument(document);
        break;
        
      case "draft":
        await moveToDraft(document);
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
        
      case "letterhead":
        openModal('letterhead', document);
        break;
        
      default:
        console.warn("Unknown action:", action);
    }
  } catch (error) {
    console.error(`Error executing action ${action}:`, error);
  }
};

// Handle document click
const showActionsModal = ref(false);
const selectedDocumentForActions = ref(null);

const handleDocumentClick = (document) => {
  // Open actions modal instead of preview
  selectedDocumentForActions.value = document;
  showActionsModal.value = true;
};

const handleModalAction = async (action, document) => {
  showActionsModal.value = false;
  await handleMenuAction(action, document);
};

// Handle edit document (kept for backward compatibility)
const handleEditDocument = (document) => {
  router.push(`/dynamic_document_dashboard/lawyer/editor/edit/${document.id}`);
};
</script>

<style scoped>
@keyframes pulse-highlight-green {
  0% {
    box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.6);
    border-color: rgb(74, 222, 128);
    background-color: rgba(34, 197, 94, 0.03);
    transform: scale(1);
  }
  50% {
    box-shadow: 0 0 10px 5px rgba(34, 197, 94, 0.4);
    border-color: rgb(74, 222, 128);
    background-color: rgba(34, 197, 94, 0.1);
    transform: scale(1.02);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.6);
    border-color: rgb(74, 222, 128);
    background-color: rgba(34, 197, 94, 0.03);
    transform: scale(1);
  }
}

@keyframes pulse-highlight-blue {
  0% {
    box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.6);
    border-color: rgb(147, 197, 253);
    background-color: rgba(59, 130, 246, 0.019);
    transform: scale(1);
  }
  50% {
    box-shadow: 0 0 10px 5px rgba(59, 130, 246, 0.4);
    border-color: rgb(147, 197, 253);
    background-color: rgba(59, 130, 246, 0.1);
    transform: scale(1.02);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.6);
    border-color: rgb(147, 197, 253);
    background-color: rgba(59, 130, 246, 0.019);
    transform: scale(1);
  }
}

@keyframes pulse-highlight-yellow {
  0% {
    box-shadow: 0 0 0 0 rgba(234, 179, 8, 0.6);
    border-color: rgb(253, 224, 71);
    background-color: rgba(234, 179, 8, 0.019);
    transform: scale(1);
  }
  50% {
    box-shadow: 0 0 10px 5px rgba(234, 179, 8, 0.4);
    border-color: rgb(253, 224, 71);
    background-color: rgba(234, 179, 8, 0.1);
    transform: scale(1.02);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(234, 179, 8, 0.6);
    border-color: rgb(253, 224, 71);
    background-color: rgba(234, 179, 8, 0.019);
    transform: scale(1);
  }
}

.animate-pulse-highlight-green {
  animation: pulse-highlight-green 1s ease-in-out 3;
  animation-fill-mode: forwards;
  border-width: 1px !important;
  position: relative;
  z-index: 10;
}

.animate-pulse-highlight-blue {
  animation: pulse-highlight-blue 1s ease-in-out 3;
  animation-fill-mode: forwards;
  border-width: 1px !important;
  position: relative;
  z-index: 10;
}

.animate-pulse-highlight-yellow {
  animation: pulse-highlight-yellow 1s ease-in-out 3;
  animation-fill-mode: forwards;
  border-width: 1px !important;
  position: relative;
  z-index: 10;
}

/* Tooltip arrow styles */
.tooltip-with-arrow:after {
  content: '';
  position: absolute;
  bottom: -4px;
  left: 10px;
  margin-left: -5px;
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 5px solid #1f2937; /* Match tooltip background color */
}
</style>
