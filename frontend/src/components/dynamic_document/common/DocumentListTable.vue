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
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-3">
        <!-- State Filter -->
        <Menu v-if="showStateFilter" as="div" class="relative">
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
              <MenuItem v-for="state in availableStates" :key="state" v-slot="{ active }">
                <a @click="filterByState = state" :class="[active ? 'bg-gray-100' : '', 'block px-4 py-2 text-sm text-gray-700 cursor-pointer']">
                  {{ getStateLabel(state) }}
                </a>
              </MenuItem>
            </div>
          </MenuItems>
        </Menu>

        <!-- Tag Filter -->
        <Menu as="div" class="relative">
          <MenuButton class="w-full inline-flex items-center justify-between gap-2 px-3 py-2 border border-gray-300 rounded-md bg-white text-sm font-medium text-gray-700 hover:bg-gray-50">
            <div class="flex items-center gap-2 min-w-0">
              <FunnelIcon class="h-4 w-4 flex-shrink-0" />
              <span class="truncate">{{ selectedTagName || 'Etiqueta' }}</span>
            </div>
            <ChevronDownIcon class="h-4 w-4 flex-shrink-0" />
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
              </div>
            </div>
          </MenuItems>
        </Menu>

        <!-- Client Filter (only for lawyer card type) -->
        <Menu v-if="showClientFilter" as="div" class="relative">
          <MenuButton class="w-full inline-flex items-center justify-between gap-2 px-3 py-2 border border-gray-300 rounded-md bg-white text-sm font-medium text-gray-700 hover:bg-gray-50">
            <div class="flex items-center gap-2 min-w-0">
              <FunnelIcon class="h-4 w-4 flex-shrink-0" />
              <span class="truncate">{{ selectedClientName || 'Cliente' }}</span>
            </div>
            <ChevronDownIcon class="h-4 w-4 flex-shrink-0" />
          </MenuButton>
          <MenuItems class="absolute left-0 z-10 mt-2 w-64 origin-top-left rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
            <div class="p-2">
              <div class="relative mb-2">
                <MagnifyingGlassIcon class="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  v-model="clientSearchQuery"
                  type="text"
                  placeholder="Buscar clientes..."
                  class="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-secondary focus:border-transparent"
                  @click.stop
                />
              </div>
              <div class="max-h-60 overflow-y-auto">
                <MenuItem v-slot="{ active }">
                  <a @click="filterByClient = null" :class="[active ? 'bg-gray-100' : '', 'block px-3 py-2 text-sm text-gray-700 cursor-pointer rounded-md']">
                    Todos
                  </a>
                </MenuItem>
                <MenuItem v-for="client in filteredClients" :key="client.id" v-slot="{ active }">
                  <a @click="filterByClient = client.id" :class="[active ? 'bg-gray-100' : '', 'block px-3 py-2 text-sm text-gray-700 cursor-pointer rounded-md']">
                    {{ client.first_name }} {{ client.last_name }}
                  </a>
                </MenuItem>
              </div>
            </div>
          </MenuItems>
        </Menu>
      </div>

      <!-- Date range filter row -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <div class="flex flex-col gap-1">
          <label class="text-xs font-medium text-gray-600">Fecha inicio</label>
          <input
            v-model="dateFrom"
            type="date"
            class="w-full min-w-0 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-secondary focus:border-transparent text-sm"
            placeholder="Fecha inicio"
          />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-xs font-medium text-gray-600">Fecha fin</label>
          <input
            v-model="dateTo"
            type="date"
            class="w-full min-w-0 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-secondary focus:border-transparent text-sm"
            placeholder="Fecha fin"
          />
        </div>
      </div>

      <!-- Sort and Actions -->
      <div class="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <Menu as="div" class="relative w-full sm:w-auto">
          <MenuButton class="w-full sm:w-auto inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md bg-white text-sm font-medium text-gray-700 hover:bg-gray-50">
            <ArrowsUpDownIcon class="h-4 w-4" />
            <span>{{ getSortLabel(sortBy) }}</span>
            <ChevronDownIcon class="h-4 w-4" />
          </MenuButton>
          <MenuItems class="absolute left-0 z-10 mt-2 w-56 origin-top-left rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
            <div class="py-1">
              <MenuItem v-for="option in sortOptions" :key="option.value" v-slot="{ active }">
                <a @click="sortBy = option.value" :class="[active ? 'bg-gray-100' : '', 'block px-4 py-2 text-sm text-gray-700 cursor-pointer']">
                  {{ option.label }}
                </a>
              </MenuItem>
            </div>
          </MenuItems>
        </Menu>

        <div class="flex gap-2 w-full sm:w-auto">
          <button
            v-if="selectedDocuments.length > 0"
            @click="exportDocuments"
            class="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-3 py-2 border border-gray-300 rounded-md bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <ArrowDownTrayIcon class="h-4 w-4" />
            <span>Exportar ({{ selectedDocuments.length }})</span>
          </button>
          <button
            v-if="filterByState || filterByTag || filterByClient || dateFrom || dateTo"
            @click="clearAllFilters"
            class="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-3 py-2 border border-gray-200 rounded-md bg-white text-xs font-medium text-gray-500 hover:bg-gray-50"
            title="Limpiar filtros"
            type="button"
          >
            <XMarkIcon class="h-4 w-4 flex-shrink-0" />
            <span>Limpiar filtros</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="flex justify-center items-center py-12 bg-white rounded-lg shadow-sm border border-gray-200">
      <div class="text-center">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
        <p class="text-sm text-gray-500">Cargando documentos...</p>
      </div>
    </div>

    <!-- Documents Table -->
    <div v-else-if="!isLoading && paginatedDocuments.length > 0" class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th
                v-if="showSelectionColumn"
                scope="col"
                class="w-12 px-3 py-3"
              >
                <input
                  type="checkbox"
                  :checked="allDocumentsSelected"
                  @change="toggleAllDocuments"
                  class="h-4 w-4 text-secondary focus:ring-secondary border-gray-300 rounded cursor-pointer"
                />
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Documento
              </th>
              <!-- Columna Cliente eliminada para mantener estructura original -->
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
              <th v-if="showAssociationsColumn && !isMinutasView" scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Asociaciones
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Etiquetas
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr
              v-for="document in paginatedDocuments"
              :key="document.id"
              :class="[
                'hover:bg-gray-50 cursor-pointer transition-colors duration-150',
                isDocumentHighlighted(document.id) ? 'bg-yellow-50' : ''
              ]"
              @click="handleRowClick(document)"
            >
              <td
                v-if="showSelectionColumn"
                class="px-3 py-4"
              >
                <input
                  type="checkbox"
                  :checked="selectedDocuments.includes(document.id)"
                  @change.stop="toggleDocumentSelection(document.id)"
                  class="h-4 w-4 text-secondary focus:ring-secondary border-gray-300 rounded cursor-pointer"
                />
              </td>
              <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                  <DocumentTextIcon class="h-5 w-5 flex-shrink-0" :class="getDocumentIconColor(document)" />
                  <div class="min-w-0">
                    <span
                      class="text-sm font-medium text-gray-900 hover:text-secondary truncate block max-w-xs text-left"
                    >
                      {{ document.title || 'Sin título' }}
                    </span>
                  </div>
                </div>
              </td>
              <!-- Columna Cliente eliminada para mantener estructura original -->
              <td class="px-6 py-4 whitespace-nowrap">
                <span :class="getStatusBadgeClass(document)" class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full">
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
              <td v-if="showAssociationsColumn && !isMinutasView" class="px-6 py-4 whitespace-nowrap">
                <button
                  v-if="canManageAssociations(document)"
                  @click.stop="openModal('relationships', document)"
                  class="inline-flex items-center gap-1 text-sm text-secondary hover:text-blue-700"
                >
                  <LinkIcon class="h-4 w-4" />
                  <span>{{ document.relationships_count || 0 }}</span>
                </button>
                <span v-else class="text-sm text-gray-400">
                  {{ document.relationships_count || 0 }}
                </span>
              </td>
              <td class="px-6 py-4">
                <div class="flex flex-wrap gap-1">
                  <span
                    v-for="tag in document.tags?.slice(0, 2)"
                    :key="tag.id"
                    :class="getTagColorClass(tag)"
                    class="px-2 py-1 text-xs rounded-full"
                  >
                    {{ tag.name }}
                  </span>
                  <button
                    v-if="document.tags?.length > 2"
                    type="button"
                    class="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 inline-flex items-center gap-1"
                    @click.stop="openTagsModal(document)"
                  >
                    <span>+{{ document.tags.length - 2 }}</span>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="bg-gray-50 px-4 py-3 border-t border-gray-200 sm:px-6">
        <div class="flex items-center justify-between">
          <div class="flex-1 flex justify-between sm:hidden">
            <button
              @click="currentPage--"
              :disabled="currentPage === 1"
              class="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Anterior
            </button>
            <button
              @click="currentPage++"
              :disabled="currentPage === totalPages"
              class="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Siguiente
            </button>
          </div>
          <div class="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p class="text-sm text-gray-700">
                Mostrando
                <span class="font-medium">{{ (currentPage - 1) * itemsPerPage + 1 }}</span>
                a
                <span class="font-medium">{{ Math.min(currentPage * itemsPerPage, filteredAndSortedDocuments.length) }}</span>
                de
                <span class="font-medium">{{ filteredAndSortedDocuments.length }}</span>
                resultados
              </p>
            </div>
            <div>
              <nav class="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button
                  @click="currentPage--"
                  :disabled="currentPage === 1"
                  class="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeftIcon class="h-5 w-5" />
                </button>
                <button
                  v-for="page in displayedPages"
                  :key="page"
                  @click="typeof page === 'number' ? currentPage = page : null"
                  :class="[
                    page === currentPage
                      ? 'z-10 bg-secondary border-secondary text-white'
                      : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50',
                    typeof page === 'string' ? 'cursor-default' : 'cursor-pointer',
                    'relative inline-flex items-center px-4 py-2 border text-sm font-medium'
                  ]"
                >
                  {{ page }}
                </button>
                <button
                  @click="currentPage++"
                  :disabled="currentPage === totalPages"
                  class="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRightIcon class="h-5 w-5" />
                </button>
              </nav>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else-if="!isLoading && paginatedDocuments.length === 0" class="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
      <DocumentTextIcon class="mx-auto h-12 w-12 text-gray-400" />
      <h3 class="mt-2 text-sm font-medium text-gray-900">No hay documentos</h3>
      <p class="mt-1 text-sm text-gray-500">
        {{ props.promptDocuments ? 'No se encontraron documentos' : 'Comienza creando un nuevo documento' }}
      </p>
    </div>

    <!-- Modals -->
    <DocumentPreviewModal
      v-if="showPreviewModal"
      :is-open="showPreviewModal"
      :document="previewDocumentData"
      @close="showPreviewModal = false"
    />

    <EditDocumentModal
      v-if="activeModals.edit.isOpen"
      :is-open="activeModals.edit.isOpen"
      :document="activeModals.edit.document"
      :user-role="activeModals.edit.userRole || userStore.currentUser?.role || 'client'"
      :show-editor-button="!activeModals.edit.renameOnly"
      @close="closeModal('edit')"
      @refresh="emit('refresh')"
    />

    <SendDocumentModal
      v-if="safeActiveModals.email.isOpen"
      :is-open="safeActiveModals.email.isOpen"
      :document="safeActiveModals.email.document"
      @close="closeModal('email')"
      @refresh="emit('refresh')"
    />

    <DocumentSignaturesModal
      v-if="activeModals.signatures.isOpen"
      :is-open="activeModals.signatures.isOpen"
      :document="activeModals.signatures.document"
      @close="closeModal('signatures')"
      @refresh="emit('refresh')"
    />

    <DocumentPermissionsModal
      v-if="activeModals.permissions.isOpen"
      :is-open="activeModals.permissions.isOpen"
      :document="activeModals.permissions.document"
      @close="closeModal('permissions')"
      @refresh="emit('refresh')"
    />

    <LetterheadModal
      v-if="activeModals.letterhead.isOpen"
      :is-visible="activeModals.letterhead.isOpen"
      :document="activeModals.letterhead.document"
      @close="closeModal('letterhead')"
      @refresh="emit('refresh')"
    />

    <DocumentRelationshipsModal
      v-if="relationshipsModalState.isOpen"
      :is-open="relationshipsModalState.isOpen"
      :document="relationshipsModalState.document"
      @close="closeModal('relationships')"
      @update-count="handleUpdateRelationshipCount"
    />

    <DocumentActionsModal
      v-if="showActionsModal"
      :is-visible="showActionsModal"
      :document="selectedDocumentForActions"
      :card-type="cardType"
      :context="props.context || 'list'"
      :user-store="userStore"
      @close="showActionsModal = false"
      @refresh="emit('refresh')"
      @action="handleModalAction"
    />

    <!-- Tags List Modal -->
    <div
      v-if="showTagsModal && tagsModalDocument"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
    >
      <div class="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[80vh] flex flex-col">
        <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div class="flex items-center gap-2">
            <TagIcon class="h-5 w-5 text-gray-500" />
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
                  :class="getTagColorClass(tag)"
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
</template>

<script setup>
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/vue";
import { computed, ref, onMounted, watch } from "vue";
import { useRouter } from "vue-router";
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  ChevronDownIcon,
  ArrowsUpDownIcon,
  ArrowDownTrayIcon,
  DocumentTextIcon,
  EllipsisVerticalIcon,
  LinkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  XMarkIcon,
  TagIcon,
} from "@heroicons/vue/24/outline";
import { useDynamicDocumentStore } from "@/stores/dynamic_document";
import { useUserStore } from "@/stores/auth/user";
import DocumentPreviewModal from "@/components/dynamic_document/common/DocumentPreviewModal.vue";
import { showPreviewModal, previewDocumentData, openPreviewModal } from "@/shared/document_utils";
import { getMenuOptionsForCardType } from "@/components/dynamic_document/cards/menuOptionsHelper";
import { useCardModals, useDocumentActions, EditDocumentModal, SendDocumentModal, DocumentSignaturesModal, DocumentPermissionsModal } from "@/components/dynamic_document/cards";
import DocumentActionsModal from "@/components/dynamic_document/common/DocumentActionsModal.vue";
import LetterheadModal from "@/components/dynamic_document/common/LetterheadModal.vue";
import DocumentRelationshipsModal from "@/components/dynamic_document/modals/DocumentRelationshipsModal.vue";

// Store instance
const documentStore = useDynamicDocumentStore();
const userStore = useUserStore();
const router = useRouter();

// Props
const props = defineProps({
  searchQuery: String,
  selectedTags: {
    type: Array,
    default: () => []
  },
  promptDocuments: {
    type: Array,
    default: null
  },
  cardType: {
    type: String,
    default: 'lawyer',
    validator: (value) => ['lawyer', 'client'].includes(value)
  },
  showStateFilter: {
    type: Boolean,
    default: true
  },
  showClientFilter: {
    type: Boolean,
    default: false
  },
  showAssociationsColumn: {
    type: Boolean,
    default: true
  },
  availableStates: {
    type: Array,
    default: () => ['Draft', 'Published', 'Progress', 'PendingSignatures', 'Completed', 'FullySigned', 'Rejected', 'Expired']
  },
  context: {
    type: String,
    default: 'legal-documents'
  },
  isLoading: {
    type: Boolean,
    default: false
  }
});

// Emits
const emit = defineEmits(['refresh', 'open-electronic-signature', 'update:searchQuery']);

// Initialize centralized modal and actions system
const { activeModals, openModal, closeModal } = useCardModals(documentStore, userStore);

// Safe wrapper for full activeModals object (handles ref/unref)
const safeActiveModals = computed(() => {
  return activeModals?.value || activeModals || {};
});

// Safe wrapper for relationships modal state to avoid undefined access
const relationshipsModalState = computed(() => {
  const modals = safeActiveModals.value;
  const rel = modals?.relationships;
  return rel || { isOpen: false, document: null };
});
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

// Local state
const localSearchQuery = ref("");
const tagSearchQuery = ref("");
const clientSearchQuery = ref("");
const filterByState = ref(null);
const filterByTag = ref(null);
const filterByClient = ref(null);
const dateFrom = ref("");
const dateTo = ref("");
const sortBy = ref('recent');
const selectedDocuments = ref([]);
const showActionsModal = ref(false);
const selectedDocumentForActions = ref(null);
const showTagsModal = ref(false);
const tagsModalDocument = ref(null);
const currentPage = ref(1);
const itemsPerPage = ref(20);

// Computed: Show selection (checkbox) column
// Solo existía originalmente en la tabla de abogado (Documentos legales)
const showSelectionColumn = computed(() => {
  return props.cardType === 'lawyer' && props.context === 'legal-documents';
});

// Computed: Show client column (eliminada de la tabla para mantener estructura original)
const showClientColumn = computed(() => {
  return false;
});

// Computed: Documents to display (scoped by role/context)
const documentsToDisplay = computed(() => {
  // Explicit prompt documents always win (e.g. search results)
  if (props.promptDocuments) {
    return props.promptDocuments;
  }

  const currentUser = userStore.currentUser;

  // Lawyer main legal documents view: mirror previous DocumentListLawyer behavior
  if (props.cardType === 'lawyer' && props.context === 'legal-documents') {
    if (!currentUser?.id || typeof documentStore.getDocumentsByLawyerId !== 'function') {
      return [];
    }
    return documentStore.getDocumentsByLawyerId(currentUser.id) || [];
  }

  // "My Documents" view (client-style list) for the current user
  if (props.cardType === 'client' && props.context === 'my-documents') {
    if (!currentUser?.id || typeof documentStore.progressAndCompletedDocumentsByClient !== 'function') {
      return [];
    }
    return documentStore.progressAndCompletedDocumentsByClient(currentUser.id) || [];
  }

  // Fallback: use all documents visible to the user
  return documentStore.documents || [];
});

// Computed: Available tags
const availableTags = computed(() => {
  const tags = new Map();
  documentsToDisplay.value.forEach(doc => {
    doc.tags?.forEach(tag => {
      if (!tags.has(tag.id)) {
        tags.set(tag.id, tag);
      }
    });
  });
  return Array.from(tags.values());
});

// Computed: Filtered tags
const filteredAvailableTags = computed(() => {
  if (!tagSearchQuery.value) return availableTags.value;
  const query = tagSearchQuery.value.toLowerCase();
  return availableTags.value.filter(tag =>
    tag.name.toLowerCase().includes(query)
  );
});

// Computed: Selected tag name
const selectedTagName = computed(() => {
  if (!filterByTag.value) return null;
  const tag = availableTags.value.find(t => t.id === filterByTag.value);
  return tag?.name || null;
});

// Computed: Available clients (for lawyer view)
const availableClients = computed(() => {
  if (props.cardType !== 'lawyer') return [];
  const clients = new Map();
  documentsToDisplay.value.forEach(doc => {
    if (doc.client) {
      clients.set(doc.client.id, doc.client);
    }
  });
  return Array.from(clients.values());
});

// Computed: Filtered clients
const filteredClients = computed(() => {
  if (!clientSearchQuery.value) return availableClients.value;
  const query = clientSearchQuery.value.toLowerCase();
  return availableClients.value.filter(client =>
    `${client.first_name} ${client.last_name}`.toLowerCase().includes(query)
  );
});

// Computed: Selected client name
const selectedClientName = computed(() => {
  if (!filterByClient.value) return null;
  const client = availableClients.value.find(c => c.id === filterByClient.value);
  return client ? `${client.first_name} ${client.last_name}` : null;
});

// Normalise selected tags from parent: accepts array of tag objects or IDs
const selectedTagIdsFromParent = computed(() => {
  if (!props.selectedTags || !props.selectedTags.length) return [];
  return props.selectedTags.map(tag => typeof tag === 'object' ? tag.id : tag);
});

// Computed: Filtered documents
const filteredDocuments = computed(() => {
  let docs = documentsToDisplay.value;

  // Apply search filter
  const searchTerm = (localSearchQuery.value || '').toLowerCase();
  if (searchTerm) {
    docs = docs.filter(doc =>
      doc.title?.toLowerCase().includes(searchTerm) ||
      doc.code?.toLowerCase().includes(searchTerm)
    );
  }

  // Apply state filter
  if (filterByState.value) {
    docs = docs.filter(doc => doc.state === filterByState.value);
  }

  // Apply date range filter (using subscription date when available, otherwise created_at)
  if (dateFrom.value || dateTo.value) {
    docs = docs.filter(doc => {
      const rawDate = doc.summary_subscription_date || doc.created_at || doc.updated_at;
      if (!rawDate) return false;
      const docDate = new Date(rawDate);
      if (isNaN(docDate.getTime())) return false;

      if (dateFrom.value) {
        const from = new Date(dateFrom.value);
        if (docDate < from) return false;
      }

      if (dateTo.value) {
        const to = new Date(dateTo.value);
        to.setHours(23, 59, 59, 999);
        if (docDate > to) return false;
      }

      return true;
    });
  }

  // Apply local tag filter (dropdown inside the table)
  if (filterByTag.value) {
    docs = docs.filter(doc =>
      doc.tags?.some(tag => tag.id === filterByTag.value)
    );
  }

  // Apply selected tags from parent (Dashboard-level filters)
  if (selectedTagIdsFromParent.value.length > 0) {
    docs = docs.filter(doc =>
      doc.tags?.some(tag => selectedTagIdsFromParent.value.includes(tag.id))
    );
  }

  // Apply client filter (lawyer only)
  if (filterByClient.value && props.cardType === 'lawyer') {
    docs = docs.filter(doc => doc.client?.id === filterByClient.value);
  }

  return docs;
});

// Clear all local filters (state, tag, client, dates)
const clearAllFilters = () => {
  filterByState.value = null;
  filterByTag.value = null;
  filterByClient.value = null;
  dateFrom.value = "";
  dateTo.value = "";
};

// Computed: determine if current view is "Minutas" (Draft/Published only for lawyer legal-documents)
const isMinutasView = computed(() => {
  if (props.cardType !== 'lawyer' || props.context !== 'legal-documents') {
    return false;
  }

  const docs = filteredDocuments.value;
  if (!docs.length) return false;

  return docs.every(doc => doc.state === 'Draft' || doc.state === 'Published');
});


// Computed: Sorted documents
const filteredAndSortedDocuments = computed(() => {
  const docs = [...filteredDocuments.value];

  switch (sortBy.value) {
    case 'recent':
      return docs.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
    case 'oldest':
      return docs.sort((a, b) => new Date(a.updated_at) - new Date(b.updated_at));
    case 'name-asc':
      return docs.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    case 'name-desc':
      return docs.sort((a, b) => (b.title || '').localeCompare(a.title || ''));
    default:
      return docs;
  }
});

// Computed: Paginated documents
const paginatedDocuments = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value;
  const end = start + itemsPerPage.value;
  return filteredAndSortedDocuments.value.slice(start, end);
});

// Computed: Total pages
const totalPages = computed(() => {
  return Math.ceil(filteredAndSortedDocuments.value.length / itemsPerPage.value);
});

// Computed: Displayed pages
const displayedPages = computed(() => {
  const total = totalPages.value;
  const current = currentPage.value;
  const pages = [];

  if (total <= 7) {
    for (let i = 1; i <= total; i++) {
      pages.push(i);
    }
  } else {
    if (current <= 4) {
      for (let i = 1; i <= 5; i++) {
        pages.push(i);
      }
      pages.push('...');
      pages.push(total);
    } else if (current >= total - 3) {
      pages.push(1);
      pages.push('...');
      for (let i = total - 4; i <= total; i++) {
        pages.push(i);
      }
    } else {
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

// Computed: All documents selected
const allDocumentsSelected = computed(() => {
  return paginatedDocuments.value.length > 0 &&
    paginatedDocuments.value.every(doc => selectedDocuments.value.includes(doc.id));
});

// Sort options
const sortOptions = [
  { value: 'recent', label: 'Más recientes' },
  { value: 'oldest', label: 'Más antiguos' },
  { value: 'name-asc', label: 'Nombre (A-Z)' },
  { value: 'name-desc', label: 'Nombre (Z-A)' }
];

// Methods
const getSortLabel = (value) => {
  return sortOptions.find(opt => opt.value === value)?.label || 'Ordenar';
};

const getStateLabel = (state) => {
  const labels = {
    'Draft': 'Borrador',
    'Published': 'Publicado',
    'Progress': 'En Progreso',
    'PendingSignatures': 'Pendiente de Firmas',
    'Completed': 'Completado',
    'FullySigned': 'Firmado',
    'Rejected': 'Rechazado',
    'Expired': 'Expirado'
  };
  return labels[state] || state;
};

const getStatusText = (document) => {
  return getStateLabel(document.state);
};

const getStatusBadgeClass = (document) => {
  const classes = {
    'Draft': 'bg-gray-100 text-gray-800',
    'Published': 'bg-blue-100 text-blue-800',
    'Progress': 'bg-yellow-100 text-yellow-800',
    'PendingSignatures': 'bg-orange-100 text-orange-800',
    'Completed': 'bg-green-100 text-green-800',
    'FullySigned': 'bg-purple-100 text-purple-800',
    'Rejected': 'bg-red-100 text-red-800',
    'Expired': 'bg-gray-100 text-gray-800'
  };
  return classes[document.state] || 'bg-gray-100 text-gray-800';
};

const getDocumentIconColor = (document) => {
  const iconColors = {
    'Draft': 'text-gray-500',
    'Published': 'text-blue-600',
    'Progress': 'text-yellow-600',
    'PendingSignatures': 'text-orange-600',
    'Completed': 'text-green-600',
    'FullySigned': 'text-purple-600',
    'Rejected': 'text-red-600',
    'Expired': 'text-gray-500'
  };
  return iconColors[document.state] || 'text-gray-400';
};

const getTagColorClass = (tag) => {
  // If the backend provides an explicit color key, prefer that
  if (tag && tag.color) {
    const colorMap = {
      'red': 'bg-red-100 text-red-800',
      'blue': 'bg-blue-100 text-blue-800',
      'green': 'bg-green-100 text-green-800',
      'yellow': 'bg-yellow-100 text-yellow-800',
      'purple': 'bg-purple-100 text-purple-800',
      'pink': 'bg-pink-100 text-pink-800',
      'indigo': 'bg-indigo-100 text-indigo-800'
    };
    return colorMap[tag.color] || 'bg-gray-100 text-gray-800';
  }

  // Fallback used historically in client table: derive a stable color from tag.id
  const colors = [
    'bg-blue-100 text-blue-700',
    'bg-purple-100 text-purple-700',
    'bg-pink-100 text-pink-700',
    'bg-yellow-100 text-yellow-700',
    'bg-green-100 text-green-700'
  ];
  const index = tag && typeof tag.id === 'number'
    ? tag.id % colors.length
    : 0;
  return colors[index];
};

const getClientName = (document) => {
  if (!document.client) return '-';
  return `${document.client.first_name} ${document.client.last_name}`;
};

const formatDate = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

// --- Helpers for summary fields (clasificación) ---
const getSummaryCounterparty = (document) => {
  return document.summary_counterparty || '';
};

const getSummaryValue = (document) => {
  if (document.summary_value === null || document.summary_value === undefined || document.summary_value === '') {
    return '';
  }

  // Parse numeric value safely
  const numericValue = Number(String(document.summary_value).replace(/[^0-9.,-]/g, '').replace(/\./g, '').replace(',', '.'));
  if (Number.isNaN(numericValue)) {
    // Fallback: return raw value if parsing fails
    return document.summary_value;
  }

  // Format number with thousands separators (locale-style: 1.234.567,89)
  const formattedNumber = numericValue.toLocaleString('es-CO', {
    maximumFractionDigits: 2,
  });

  const currencyCode = document.summary_value_currency || '';
  const currencyLabelMap = {
    COP: 'COP $',
    USD: 'US $',
    EUR: 'EUR €',
  };

  const currencyLabel = currencyLabelMap[currencyCode] || currencyCode || '';

  if (currencyLabel) {
    return `${currencyLabel} ${formattedNumber}`;
  }

  return formattedNumber;
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

const canManageAssociations = (document) => {
  // Only Completed and FullySigned documents can manage associations
  return ['Completed', 'FullySigned'].includes(document.state);
};

const isDocumentHighlighted = (documentId) => {
  return String(documentStore.lastUpdatedDocumentId) === String(documentId);
};

const toggleDocumentSelection = (documentId) => {
  const index = selectedDocuments.value.indexOf(documentId);
  if (index > -1) {
    selectedDocuments.value.splice(index, 1);
  } else {
    selectedDocuments.value.push(documentId);
  }
};

const openTagsModal = (document) => {
  tagsModalDocument.value = document;
  showTagsModal.value = true;
};

const closeTagsModal = () => {
  showTagsModal.value = false;
  tagsModalDocument.value = null;
};

const toggleAllDocuments = () => {
  if (allDocumentsSelected.value) {
    selectedDocuments.value = selectedDocuments.value.filter(
      id => !paginatedDocuments.value.some(doc => doc.id === id)
    );
  } else {
    const newSelections = paginatedDocuments.value
      .map(doc => doc.id)
      .filter(id => !selectedDocuments.value.includes(id));
    selectedDocuments.value.push(...newSelections);
  }
};

// Handle row click: open the standard actions modal with all options
const handleRowClick = (document) => {
  selectedDocumentForActions.value = document;
  showActionsModal.value = true;
};

const exportDocuments = () => {
  const documentsToExport = selectedDocuments.value.length > 0
    ? filteredAndSortedDocuments.value.filter(d => selectedDocuments.value.includes(d.id))
    : filteredAndSortedDocuments.value;

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

const getMenuOptionsForDocument = (document) => {
  // Use the provided context (e.g. 'legal-documents', 'my-documents')
  // so menuOptionsHelper can tailor options per view
  const context = props.context || 'list';
  return getMenuOptionsForCardType(props.cardType, document, context, userStore);
};

const handleMenuAction = async (action, document) => {
  switch (action) {
    // Visualización
    case 'preview':
      await handlePreviewDocument(document);
      break;

    // Edición
    case 'edit':
      {
        const userRole = userStore.currentUser?.role || 'client';
        if (props.cardType === 'lawyer' && props.context === 'legal-documents') {
          // En Minutas (abogado), usar modo solo renombrar (sin botón "Editar Documento")
          openModal('edit', document, { userRole, renameOnly: true });
        } else {
          openModal('edit', document, { userRole });
        }
      }
      break;
    case 'editForm':
      // Editar configuración / variables
      if (props.cardType === 'lawyer' && props.context === 'legal-documents') {
        // Para minutas (plantillas de abogado), ir directo a la vista de configuración de variables
        try {
          const fullDocument = await documentStore.fetchDocumentById(document.id, true);
          documentStore.selectedDocument = fullDocument;
          router.push('/dynamic_document_dashboard/lawyer/variables-config');
        } catch (error) {
          console.error('Error al abrir la configuración de variables:', error);
        }
      } else {
        // Para documentos de uso/cliente, usar el flujo existente (DocumentForm)
        openModal('edit', document, { userRole: 'client' });
      }
      break;
    case 'editDocument':
      {
        // Editar contenido del documento en el editor adecuado
        const userRole = userStore.currentUser?.role || 'client';
        const isLawyerTemplateContext = userRole === 'lawyer' && props.cardType === 'lawyer';
        if (isLawyerTemplateContext) {
          // Editor de abogado para plantillas/minutas
          router.push(`/dynamic_document_dashboard/lawyer/editor/edit/${document.id}`);
        } else {
          // Editor de cliente/uso para documentos completados/en progreso
          router.push(`/dynamic_document_dashboard/client/editor/edit/${document.id}`);
        }
      }
      break;

    // Permisos / Asociaciones / Membrete / Firmas
    case 'permissions':
      openModal('permissions', document);
      break;
    case 'relationships':
      openModal('relationships', document);
      break;
    case 'letterhead':
      openModal('letterhead', document);
      break;
    case 'viewSignatures':
    case 'signatures':
      openModal('signatures', document);
      break;

    // Estado del documento
    case 'publish':
      await publishDocument(document);
      break;
    case 'draft':
    case 'move-to-draft':
      await moveToDraft(document);
      break;
    case 'formalize':
      await formalizeDocument(document);
      break;

    // Firmar / eliminar
    case 'sign':
      await signDocument(document);
      break;
    case 'delete':
      await deleteDocument(document);
      break;

    // Descargas / envío
    case 'downloadPDF':
    case 'download-pdf':
      await downloadPDFDocument(document);
      break;
    case 'downloadWord':
    case 'download-word':
      await downloadWordDocument(document);
      break;
    case 'downloadSignedDocument':
    case 'download-signed':
      await downloadSignedDocument(document);
      break;
    case 'email':
    case 'send':
      openModal('email', document);
      break;

    // Copia
    case 'copy':
      await copyDocument(document);
      break;

    // Fallback
    default:
      console.warn('Unknown action:', action);
  }
};

const handleModalAction = async (action, document) => {
  showActionsModal.value = false;
  await handleMenuAction(action, document);
};

const handleUpdateRelationshipCount = ({ documentId, count }) => {
  const document = documentStore.documents.find(doc => doc.id === documentId);
  if (document) {
    document.relationships_count = count;
  }
};

// Watch for page changes
watch(() => filteredAndSortedDocuments.value.length, () => {
  if (currentPage.value > totalPages.value) {
    currentPage.value = Math.max(1, totalPages.value);
  }
});

// Sync local search back to parent (two-way binding for searchQuery)
watch(localSearchQuery, (newValue) => {
  emit('update:searchQuery', newValue ?? '');
});

// Watch for external searchQuery changes (e.g., from parent component)
watch(() => props.searchQuery, (newValue) => {
  if (newValue !== undefined && newValue !== null) {
    localSearchQuery.value = newValue;
  }
}, { immediate: true });

// Initialize
onMounted(async () => {
  if (!props.promptDocuments) {
    await documentStore.init();
  }
  await userStore.init();
});
</script>
