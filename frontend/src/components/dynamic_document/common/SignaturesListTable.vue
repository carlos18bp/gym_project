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
        <!-- Single row: Export, More options, and Sort aligned -->
        <div class="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <!-- Left side: Action buttons -->
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
                Estado Firma
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Información clave
              </th>
              <th
                v-if="props.state === 'PendingSignatures' || props.state === 'FullySigned'"
                scope="col"
                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
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
              <td
                v-if="props.state === 'PendingSignatures' || props.state === 'FullySigned'"
                class="px-6 py-4 whitespace-nowrap"
              >
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

    <!-- Preview modal -->
    <DocumentPreviewModal
      :isVisible="showPreviewModal"
      :documentData="previewDocumentData"
      @close="showPreviewModal = false"
    />

    <!-- Modals using centralized system -->
    <teleport to="body">
      <DocumentSignaturesModal
        v-if="activeModals.signatures.isOpen"
        :document-id="activeModals.signatures.document?.id"
        @close="closeModal('signatures')"
        @refresh="emit('refresh')"
        @open-electronic-signature="emit('open-electronic-signature')"
      />
      
      <LetterheadModal
        v-if="activeModals.letterhead.isOpen"
        :is-visible="activeModals.letterhead.isOpen"
        :document="activeModals.letterhead.document"
        @close="closeModal('letterhead')"
        @refresh="emit('refresh')"
      />

      <DocumentActionsModal
        v-if="showActionsModal"
        :is-visible="showActionsModal"
        :document="selectedDocumentForActions"
        card-type="signatures"
        context="table"
        :user-store="userStore"
        @close="showActionsModal = false"
        @action="handleModalAction"
      />

      <DocumentRelationshipsModal
        v-if="activeModals.relationships.isOpen"
        :is-open="activeModals.relationships.isOpen"
        :document="activeModals.relationships.document"
        :readonly="props.state === 'PendingSignatures' || props.state === 'FullySigned'"
        @close="closeModal('relationships')"
        @refresh="emit('refresh')"
      />

      <DocumentSummaryModal
        v-if="showSummaryModal"
        :is-visible="showSummaryModal"
        :document="summaryDocument"
        @close="showSummaryModal = false"
      />

      <!-- Reject Document Modal -->
      <div
        v-if="showRejectModal && documentToReject"
        class="fixed inset-0 z-[70] flex items-center justify-center bg-black/40"
      >
        <div class="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
          <div class="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <h2 class="text-sm font-semibold text-gray-900">Rechazar documento</h2>
            <button
              type="button"
              class="p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              @click="closeRejectModal"
            >
              <XMarkIcon class="h-5 w-5" />
            </button>
          </div>
          <div class="px-4 py-4 space-y-3 text-sm text-gray-700">
            <p>
              Estás a punto de rechazar el documento
              <span class="font-semibold">"{{ documentToReject.title }}"</span>.
            </p>
            <p class="text-xs text-gray-500">
              El rechazo devolverá el documento al abogado creador para que pueda revisarlo, editarlo o archivarlo.
            </p>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">
                Motivo del rechazo (opcional)
              </label>
              <textarea
                v-model="rejectComment"
                rows="4"
                class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-secondary focus:border-transparent resize-none"
                placeholder="Describe brevemente por qué no estás de acuerdo con el documento..."
              ></textarea>
            </div>
          </div>
          <div class="px-4 py-3 border-t border-gray-100 flex justify-end gap-2 bg-gray-50">
            <button
              type="button"
              class="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-100"
              @click="closeRejectModal"
            >
              Cancelar
            </button>
            <button
              type="button"
              class="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
              @click="confirmRejectDocument"
            >
              Rechazar documento
            </button>
          </div>
        </div>
      </div>

      <!-- Rejection Reason Modal -->
      <div
        v-if="showRejectionReasonModal"
        class="fixed inset-0 z-[70] flex items-center justify-center bg-black/40"
      >
        <div class="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
          <div class="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <h2 class="text-sm font-semibold text-gray-900">Motivo del rechazo</h2>
            <button
              type="button"
              class="p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              @click="showRejectionReasonModal = false"
            >
              <XMarkIcon class="h-5 w-5" />
            </button>
          </div>
          <div class="px-4 py-4 text-sm text-gray-700 whitespace-pre-line">
            {{ rejectionReasonText || 'No se encontró un motivo de rechazo para este documento.' }}
          </div>
          <div class="px-4 py-3 border-t border-gray-100 flex justify-end bg-gray-50">
            <button
              type="button"
              class="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-100"
              @click="showRejectionReasonModal = false"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
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
import { useUserStore } from "@/stores/auth/user";
import { useDynamicDocumentStore } from "@/stores/dynamic_document";
import { get_request, create_request } from "@/stores/services/request_http";
import { showNotification } from "@/shared/notification_message";
import { registerUserActivity, ACTION_TYPES } from "@/stores/dashboard/activity_feed";
import DocumentPreviewModal from "@/components/dynamic_document/common/DocumentPreviewModal.vue";
import { showPreviewModal, previewDocumentData, openPreviewModal } from "@/shared/document_utils";
import { getMenuOptionsForCardType } from "@/components/dynamic_document/cards/menuOptionsHelper";
import { useCardModals, useDocumentActions, SendDocumentModal, DocumentSignaturesModal } from "@/components/dynamic_document/cards";
import DocumentActionsModal from "@/components/dynamic_document/common/DocumentActionsModal.vue";
import LetterheadModal from "@/components/dynamic_document/common/LetterheadModal.vue";
import DocumentRelationshipsModal from "@/components/dynamic_document/modals/DocumentRelationshipsModal.vue";
import DocumentSummaryModal from "@/components/dynamic_document/common/DocumentSummaryModal.vue";

// Props
const props = defineProps({
  state: {
    type: String,
    required: true,
    validator: (value) => ['PendingSignatures', 'FullySigned', 'Archived'].includes(value)
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
const emit = defineEmits(['refresh', 'document-fully-signed', 'document-rejected', 'open-electronic-signature']);

// Store instances
const userStore = useUserStore();
const documentStore = useDynamicDocumentStore();
const router = useRouter();

// Initialize centralized modal and actions system
const { activeModals, openModal, closeModal, getUserRole } = useCardModals(documentStore, userStore);
const {
  handlePreviewDocument,
  downloadPDFDocument,
  signDocument,
  downloadSignedDocument
} = useDocumentActions(documentStore, userStore, emit);

// Reactive state
const documents = ref([]);
const isLoading = ref(false);
const localSearchQuery = ref("");
const tagSearchQuery = ref("");
const filterByTag = ref(null);
const sortBy = ref('recent');
const selectedDocuments = ref([]);
const showSummaryModal = ref(false);
const summaryDocument = ref(null);

// Pagination state
const currentPage = ref(1);
const itemsPerPage = ref(10);

const emptyMessage = computed(() => {
  if (props.state === 'PendingSignatures') {
    return 'No tienes documentos pendientes por firmar';
  }
  if (props.state === 'FullySigned') {
    return 'No tienes documentos firmados';
  }
  return 'No tienes documentos archivados';
});

const getDetailedEmptyMessage = computed(() => {
  if (props.state === 'PendingSignatures') {
    return 'Cuando tengas documentos que requieran tu firma electrónica aparecerán aquí.';
  }
  if (props.state === 'FullySigned') {
    return 'Una vez que firmes documentos electrónicamente, aparecerán aquí.';
  }
  return 'Aquí aparecerán los documentos rechazados o expirados relacionados contigo.';
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
        // Show documents where lawyer is creator OR signer
        const isCreator = doc.created_by === userId;
        const isSigner = doc.signatures?.some(sig => sig.signer_email === userEmail);
        return isCreator || isSigner;
      });
    } else if (props.state === 'FullySigned') {
      storeDocuments = documentStore.fullySignedDocuments.filter(doc => {
        // Show documents where lawyer is creator OR signer
        const isCreator = doc.created_by === userId;
        const isSigner = doc.signatures?.some(sig => 
          sig.signer_email === userEmail && sig.signed
        );
        return isCreator || isSigner;
      });
    } else if (props.state === 'Archived') {
      storeDocuments = documentStore.documents.filter(doc => {
        if (doc.state !== 'Rejected' && doc.state !== 'Expired') return false;
        const isCreator = doc.created_by === userId;
        const isSigner = doc.signatures?.some(sig => sig.signer_email === userEmail);
        return isCreator || isSigner;
      });
    }
  } else {
    if (props.state === 'PendingSignatures') {
      storeDocuments = documentStore.documents.filter(doc => {
        if (doc.state !== 'PendingSignatures') return false;
        // Show documents where user is a signer OR created the document
        const isSigner = doc.signatures?.some(sig => sig.signer_email === userEmail);
        const isCreator = doc.created_by === userId;
        return isSigner || isCreator;
      });
    } else if (props.state === 'FullySigned') {
      storeDocuments = documentStore.documents.filter(doc => {
        if (doc.state !== 'FullySigned') return false;
        // Show documents where user signed OR created the document
        const isSigner = doc.signatures?.some(sig => 
          sig.signer_email === userEmail && sig.signed
        );
        const isCreator = doc.created_by === userId;
        return isSigner || isCreator;
      });
    } else if (props.state === 'Archived') {
      storeDocuments = documentStore.documents.filter(doc => {
        if (doc.state !== 'Rejected' && doc.state !== 'Expired') return false;
        const isSigner = doc.signatures?.some(sig => sig.signer_email === userEmail);
        const isCreator = doc.created_by === userId;
        return isSigner || isCreator;
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
  if (props.state === 'Archived') {
    if (document.state === 'Rejected') {
      return 'bg-red-100 text-red-700 border border-red-200';
    }
    if (document.state === 'Expired') {
      return 'bg-gray-100 text-gray-700 border border-gray-200';
    }
    return 'bg-gray-100 text-gray-700 border border-gray-200';
  }
  return 'bg-yellow-100 text-yellow-700 border border-yellow-200';
};

// Get signature status text
const getSignatureStatusText = (document) => {
  if (props.state === 'FullySigned') {
    return 'Firmado';
  }
  if (props.state === 'Archived') {
    if (document.state === 'Rejected') {
      return 'Rechazado';
    }
    if (document.state === 'Expired') {
      return 'Expirado';
    }
    return 'Archivado';
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
const showActionsModal = ref(false);
const selectedDocumentForActions = ref(null);
const showRejectModal = ref(false);
const documentToReject = ref(null);
const rejectComment = ref('');
const showRejectionReasonModal = ref(false);
const rejectionReasonText = ref('');

const handleDocumentClick = (document) => {
  // Open actions modal instead of navigating
  selectedDocumentForActions.value = document;
  showActionsModal.value = true;
};

const handleModalAction = async (action, document) => {
  showActionsModal.value = false;
  await handleMenuAction(action, document);
};

// Handle sign document
// Get menu options for a document
const getMenuOptionsForDocument = (document) => {
  return getMenuOptionsForCardType('signatures', document, 'list', userStore);
};

// Handle menu action
const handleMenuAction = async (action, document) => {
  try {
    switch (action) {
      case "preview":
        await handlePreviewDocument(document);
        break;
        
      case "letterhead":
        openModal('letterhead', document);
        break;
        
      case "relationships":
        openModal('relationships', document);
        break;
        
      case "viewSignatures":
        openModal('signatures', document);
        break;
        
      case "sign":
        await signDocument(document, openModal);
        break;
        
      case "reject":
        documentToReject.value = document;
        rejectComment.value = '';
        showRejectModal.value = true;
        break;

      case "viewRejectionReason": {
        const sigWithComment = (document.signatures || []).find(sig => sig.rejection_comment);
        if (sigWithComment && sigWithComment.rejection_comment) {
          rejectionReasonText.value = sigWithComment.rejection_comment;
          showRejectionReasonModal.value = true;
        } else {
          await showNotification('Este documento no tiene un motivo de rechazo registrado.', 'info');
        }
        break;
      }
        
      case "downloadSignedDocument":
        await downloadSignedDocument(document);
        break;
        
      case "downloadPDF":
        await downloadPDFDocument(document);
        break;
        
      default:
        console.warn("Unknown action:", action);
    }
  } catch (error) {
    console.error(`Error executing action ${action}:`, error);
  }
};

const handleSignDocument = (document) => {
  router.push({ name: 'sign_document', params: { id: document.id } });
};

const closeRejectModal = () => {
  showRejectModal.value = false;
  documentToReject.value = null;
  rejectComment.value = '';
};

const confirmRejectDocument = async () => {
  if (!documentToReject.value) {
    return;
  }
  const rejectedDocument = documentToReject.value;
  const documentId = rejectedDocument.id;
  const userId = userStore.currentUser.id;
  
  try {
    const url = `dynamic-documents/${documentId}/reject/${userId}/`;
    const payload = rejectComment.value ? { comment: rejectComment.value } : {};
    const response = await create_request(url, payload);
    if (response && (response.status === 200 || response.status === 201)) {
      // Close modal and switch tab IMMEDIATELY for instant UX
      closeRejectModal();
      emit('document-rejected', rejectedDocument);
      
      // Run notification, activity registration, and data refresh in parallel (non-blocking)
      Promise.all([
        showNotification('Documento rechazado correctamente.', 'success'),
        registerUserActivity(
          ACTION_TYPES.FINISH,
          `Rechazaste el documento "${rejectedDocument.title}"`
        ).catch(error => console.warn('No se pudo registrar la actividad de rechazo:', error)),
        documentStore.init(true)
      ]).then(() => {
        emit('refresh');
      });
    } else {
      await showNotification('Error al rechazar el documento.', 'error');
    }
  } catch (error) {
    console.error('Error rejecting document:', error);
    await showNotification('Error al rechazar el documento.', 'error');
  }
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

// Summary modal functions
const openSummaryModal = (document) => {
  summaryDocument.value = document;
  showSummaryModal.value = true;
};

const getSummaryCounterparty = (document) => {
  if (!document.summary_counterparty) return null;
  const variable = document.variables?.find(v => v.summary_field === 'counterparty');
  return variable?.value || document.summary_counterparty;
};

const getSummaryValue = (document) => {
  if (!document.summary_value) return null;
  const value = parseFloat(document.summary_value);
  if (isNaN(value)) return null;
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

// Watch for changes
watch(
  () => userStore.currentUser,
  () => {
    handleRefresh();
  }
);
</script>
