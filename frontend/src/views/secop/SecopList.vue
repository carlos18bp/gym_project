<template>
  <div class="min-h-screen bg-gray-50" data-testid="secop-list-page">
    <ModuleHeader title="Contratación Pública" subtitle="Oportunidades de contratación SECOP II">
      <template #menu-button><slot></slot></template>
      <template #actions>
        <SyncStatus :sync-status="secopStore.syncStatus" @trigger-sync="secopStore.triggerSync()" />
      </template>
    </ModuleHeader>

    <!-- Main content -->
    <div class="py-6 px-4 sm:px-6 lg:px-8">
      <!-- Tabs Navigation -->
      <div class="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 mb-6" data-testid="secop-tabs">
        <div class="border-b border-gray-200">
          <div class="flex items-center justify-between px-4 sm:px-6">
            <!-- Desktop Tabs -->
            <nav class="-mb-px hidden sm:flex space-x-6">
              <button
                v-for="tab in tabs"
                :key="tab.key"
                @click="activeTab = tab.key"
                :data-testid="`tab-${tab.key}`"
                :class="[
                  'relative whitespace-nowrap pb-3 pt-4 text-sm font-medium transition-colors',
                  activeTab === tab.key
                    ? 'text-secondary'
                    : 'text-gray-500 hover:text-gray-700'
                ]"
              >
                {{ tab.label }}
                <span v-if="tab.key === 'alerts' && secopStore.activeAlertsCount > 0" class="ml-1.5 inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                  {{ secopStore.activeAlertsCount }}
                </span>
                <span
                  v-if="activeTab === tab.key"
                  class="absolute inset-x-0 bottom-0 h-0.5 bg-secondary rounded-full transition-all duration-200"
                ></span>
              </button>
            </nav>

            <!-- Mobile Dropdown -->
            <div class="sm:hidden flex-1 py-3">
              <Menu as="div" class="relative">
                <MenuButton class="w-full inline-flex items-center justify-between rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50">
                  <span>{{ activeTabLabel }}</span>
                  <ChevronDownIcon class="h-5 w-5 ml-2 text-gray-400" />
                </MenuButton>
                <MenuItems class="absolute left-0 z-10 mt-2 w-full origin-top-left rounded-xl bg-white shadow-lg ring-1 ring-gray-200 focus:outline-none">
                  <div class="py-1">
                    <MenuItem v-for="tab in tabs" :key="tab.key" v-slot="{ active }">
                      <button
                        @click="activeTab = tab.key"
                        :class="[active ? 'bg-terciary' : '', 'block w-full text-left px-4 py-2.5 text-sm text-gray-700']"
                      >
                        {{ tab.label }}
                      </button>
                    </MenuItem>
                  </div>
                </MenuItems>
              </Menu>
            </div>
          </div>
        </div>
      </div>

      <!-- ALL PROCESSES TAB -->
      <template v-if="activeTab === 'all' || activeTab === 'classified'">
        <!-- Classification status filter (only on classified tab) -->
        <div v-if="activeTab === 'classified'" class="flex items-center gap-3 mb-4" data-testid="classification-status-filter">
          <span class="text-sm font-medium text-gray-600">Filtrar por estado:</span>
          <select
            v-model="classificationFilter"
            data-testid="filter-classification-status"
            class="rounded-lg border-gray-300 bg-white py-2 pl-3 pr-8 text-sm shadow-sm focus:ring-2 focus:ring-secondary focus:border-secondary"
          >
            <option value="">Todos los estados</option>
            <option value="INTERESTING">Interesante</option>
            <option value="UNDER_REVIEW">En Revisión</option>
            <option value="APPLIED">Aplicado</option>
            <option value="DISCARDED">Descartado</option>
          </select>
        </div>

        <!-- Filters and Search Bar -->
        <div class="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 p-4 sm:p-5 mb-6 relative" data-testid="secop-filters">
          <!-- Disabled overlay for basic role -->
          <div v-if="filtersDisabled" class="absolute inset-0 z-10 flex items-start justify-center rounded-xl bg-white/70 backdrop-blur-[1px]" data-testid="filters-disabled-overlay">
            <div class="mt-6 flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-600 shadow-sm ring-1 ring-gray-200">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-500" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd" /></svg>
              Los filtros no están disponibles en el plan básico
            </div>
          </div>

          <!-- Search Bar -->
          <div class="mb-4">
            <div class="relative w-full">
              <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <MagnifyingGlassIcon class="h-5 w-5 text-gray-400" />
              </div>
              <input
                v-model="searchQuery"
                type="search"
                data-testid="secop-search"
                placeholder="Buscar por entidad, objeto, referencia..."
                class="block w-full rounded-xl border-0 bg-terciary py-3 pl-10 pr-4 text-gray-900 ring-1 ring-inset ring-gray-200 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-secondary sm:text-sm sm:leading-6"
                :disabled="filtersDisabled"
                @keyup.enter="loadProcesses"
              />
            </div>
          </div>

          <!-- Keywords search -->
          <div class="mb-4">
            <div class="relative w-full">
              <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <TagIcon class="h-5 w-5 text-gray-400" />
              </div>
              <input
                v-model="filters.keywords"
                type="search"
                data-testid="secop-keywords"
                placeholder="Palabras clave (ej: prestación servicios enfermería)"
                class="block w-full rounded-xl border-0 bg-terciary py-3 pl-10 pr-4 text-gray-900 ring-1 ring-inset ring-gray-200 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-secondary sm:text-sm sm:leading-6"
                :disabled="filtersDisabled"
                @keyup.enter="loadProcesses"
              />
            </div>
          </div>

          <!-- Filters Section -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
            <!-- Department filter -->
            <MultiSelectDropdown
              v-model="filters.department"
              :options="secopStore.availableFilters.departments"
              placeholder="Departamento"
              data-testid="filter-department"
            />

            <!-- Procurement method filter -->
            <MultiSelectDropdown
              v-model="filters.procurement_method"
              :options="secopStore.availableFilters.procurement_methods"
              placeholder="Modalidad"
              data-testid="filter-procurement"
            />

            <!-- Status filter -->
            <MultiSelectDropdown
              v-model="filters.status"
              :options="secopStore.availableFilters.statuses"
              placeholder="Estado"
              data-testid="filter-status"
            />

            <!-- Entity filter -->
            <MultiSelectDropdown
              v-model="filters.entity_name"
              :options="secopStore.availableFilters.entity_names"
              placeholder="Entidad"
              data-testid="filter-entity"
            />
          </div>

          <!-- Advanced filters toggle + clear -->
          <div class="flex items-center justify-between mb-3">
            <button
              @click="showAdvancedFilters = !showAdvancedFilters"
              data-testid="toggle-advanced-filters"
              class="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-secondary transition-colors"
            >
              <AdjustmentsHorizontalIcon class="h-4 w-4" />
              <span>Filtros avanzados</span>
              <span v-if="activeFilterCount > 0" class="ml-1 inline-flex items-center rounded-full bg-secondary/10 px-2 py-0.5 text-xs font-medium text-secondary">{{ activeFilterCount }}</span>
              <ChevronDownIcon :class="['h-3.5 w-3.5 transition-transform', showAdvancedFilters ? 'rotate-180' : '']" />
            </button>
            <button
              v-if="hasActiveFilters"
              @click="clearFilters"
              data-testid="clear-filters"
              class="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
            >
              <XMarkIcon class="h-3.5 w-3.5" />
              Limpiar filtros
            </button>
          </div>

          <!-- Advanced Filters Panel -->
          <div v-if="showAdvancedFilters" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4 p-4 rounded-lg bg-terciary/50 border border-gray-100" data-testid="advanced-filters">
            <!-- Budget range -->
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1.5">Presupuesto mínimo (COP)</label>
              <input
                v-model="filters.min_budget"
                type="number"
                data-testid="filter-min-budget"
                placeholder="0"
                class="w-full rounded-lg border-gray-300 bg-white text-sm shadow-sm focus:ring-2 focus:ring-secondary focus:border-secondary placeholder:text-gray-400"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1.5">Presupuesto máximo (COP)</label>
              <input
                v-model="filters.max_budget"
                type="number"
                data-testid="filter-max-budget"
                placeholder="Sin límite"
                class="w-full rounded-lg border-gray-300 bg-white text-sm shadow-sm focus:ring-2 focus:ring-secondary focus:border-secondary placeholder:text-gray-400"
              />
            </div>

            <!-- UNSPSC Code filter -->
            <Menu as="div" class="relative">
              <label class="block text-xs font-medium text-gray-500 mb-1.5">Código UNSPSC</label>
              <MenuButton data-testid="filter-unspsc" :class="['w-full inline-flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium shadow-sm hover:bg-gray-50 transition-colors', filters.unspsc_code ? 'border-2 border-secondary bg-blue-50/50 text-secondary' : 'border border-gray-300 bg-white text-gray-700']">
                <span class="truncate">{{ filters.unspsc_code || 'Seleccionar código' }}</span>
                <ChevronDownIcon class="h-4 w-4 flex-shrink-0 text-gray-400" />
              </MenuButton>
              <MenuItems class="absolute left-0 z-10 mt-2 w-48 origin-top-left rounded-xl bg-white shadow-lg ring-1 ring-gray-200 focus:outline-none max-h-60 overflow-y-auto">
                <div class="py-1">
                  <MenuItem v-slot="{ active }">
                    <a @click="filters.unspsc_code = ''" :class="[active ? 'bg-terciary' : '', 'block px-4 py-2 text-sm text-gray-700 cursor-pointer']">Todos</a>
                  </MenuItem>
                  <MenuItem v-for="code in secopStore.availableFilters.unspsc_codes" :key="code" v-slot="{ active }">
                    <a @click="filters.unspsc_code = code" :class="[active ? 'bg-terciary' : '', filters.unspsc_code === code ? 'font-semibold text-secondary' : 'text-gray-700', 'block px-4 py-2 text-sm cursor-pointer font-mono']">{{ code }}</a>
                  </MenuItem>
                </div>
              </MenuItems>
            </Menu>

            <!-- Publication date range -->
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1.5">Publicación desde</label>
              <input
                v-model="filters.publication_date_from"
                type="date"
                data-testid="filter-pub-from"
                class="w-full rounded-lg border-gray-300 bg-white text-sm shadow-sm focus:ring-2 focus:ring-secondary focus:border-secondary"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1.5">Publicación hasta</label>
              <input
                v-model="filters.publication_date_to"
                type="date"
                data-testid="filter-pub-to"
                class="w-full rounded-lg border-gray-300 bg-white text-sm shadow-sm focus:ring-2 focus:ring-secondary focus:border-secondary"
              />
            </div>

            <!-- Closing date range -->
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1.5">Cierre desde</label>
              <input
                v-model="filters.closing_date_from"
                type="date"
                data-testid="filter-close-from"
                class="w-full rounded-lg border-gray-300 bg-white text-sm shadow-sm focus:ring-2 focus:ring-secondary focus:border-secondary"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1.5">Cierre hasta</label>
              <input
                v-model="filters.closing_date_to"
                type="date"
                data-testid="filter-close-to"
                class="w-full rounded-lg border-gray-300 bg-white text-sm shadow-sm focus:ring-2 focus:ring-secondary focus:border-secondary"
              />
            </div>
          </div>

          <!-- Actions Bar -->
          <div class="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between pt-4 border-t border-gray-100">
            <div class="flex items-center gap-3">
              <p class="text-sm text-gray-500" data-testid="secop-result-count">
                <span class="font-semibold text-primary">{{ secopStore.pagination.count }}</span> resultados
              </p>

              <!-- Export Button -->
              <button
                @click="handleExport"
                data-testid="secop-export-btn"
                class="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
              >
                <ArrowDownTrayIcon class="h-4 w-4" />
                <span class="hidden sm:inline">Exportar Excel</span>
              </button>
            </div>

            <div class="flex items-center gap-3">
            <!-- Page size selector -->
            <div class="inline-flex items-center gap-2">
              <label class="text-xs text-gray-500 hidden sm:inline">Mostrar</label>
              <select
                v-model="pageSize"
                data-testid="page-size-selector"
                class="rounded-lg border-gray-300 bg-white py-1.5 pl-2 pr-7 text-sm shadow-sm focus:ring-2 focus:ring-secondary focus:border-secondary"
              >
                <option :value="20">20</option>
                <option :value="25">25</option>
                <option :value="50">50</option>
                <option :value="100">100</option>
              </select>
            </div>

            <!-- Sort -->
            <Menu as="div" class="relative">
              <MenuButton data-testid="sort-menu" class="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50">
                <ArrowsUpDownIcon class="h-4 w-4 text-gray-400" />
                <span class="hidden sm:inline">{{ sortLabel }}</span>
                <ChevronDownIcon class="h-4 w-4 text-gray-400" />
              </MenuButton>
              <MenuItems class="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-xl bg-white shadow-lg ring-1 ring-gray-200 focus:outline-none">
                <div class="py-1">
                  <MenuItem v-slot="{ active }">
                    <a @click="ordering = '-publication_date'" :class="[active ? 'bg-terciary' : '', ordering === '-publication_date' ? 'font-semibold text-secondary' : 'text-gray-700', 'block px-4 py-2 text-sm cursor-pointer']">Más recientes</a>
                  </MenuItem>
                  <MenuItem v-slot="{ active }">
                    <a @click="ordering = 'closing_date'" :class="[active ? 'bg-terciary' : '', ordering === 'closing_date' ? 'font-semibold text-secondary' : 'text-gray-700', 'block px-4 py-2 text-sm cursor-pointer']">Cierre próximo</a>
                  </MenuItem>
                  <MenuItem v-slot="{ active }">
                    <a @click="ordering = '-base_price'" :class="[active ? 'bg-terciary' : '', ordering === '-base_price' ? 'font-semibold text-secondary' : 'text-gray-700', 'block px-4 py-2 text-sm cursor-pointer']">Mayor presupuesto</a>
                  </MenuItem>
                  <MenuItem v-slot="{ active }">
                    <a @click="ordering = 'entity_name'" :class="[active ? 'bg-terciary' : '', ordering === 'entity_name' ? 'font-semibold text-secondary' : 'text-gray-700', 'block px-4 py-2 text-sm cursor-pointer']">Entidad (A-Z)</a>
                  </MenuItem>
                </div>
              </MenuItems>
            </Menu>
            </div>
          </div>
        </div>

        <!-- Loading skeleton -->
        <div v-if="secopStore.loading" class="space-y-4" data-testid="secop-loading">
          <div v-for="i in 5" :key="i" class="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 p-5 animate-pulse">
            <div class="flex items-start gap-4">
              <div class="flex-1 space-y-3">
                <div class="h-4 w-3/4 rounded bg-gray-200"></div>
                <div class="h-3 w-1/2 rounded bg-gray-100"></div>
                <div class="flex gap-2">
                  <div class="h-5 w-20 rounded-full bg-gray-100"></div>
                  <div class="h-5 w-24 rounded-full bg-gray-100"></div>
                </div>
              </div>
              <div class="h-6 w-28 rounded bg-gray-200"></div>
            </div>
          </div>
        </div>

        <!-- Table -->
        <div v-else-if="secopStore.processes.length" class="rounded-xl bg-white shadow-sm ring-1 ring-gray-200" data-testid="secop-table">
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead>
                <tr class="bg-gray-50/80">
                  <th scope="col" class="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Entidad</th>
                  <th scope="col" class="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Objeto</th>
                  <th scope="col" class="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Modalidad</th>
                  <th scope="col" class="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Presupuesto</th>
                  <th scope="col" class="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Departamento</th>
                  <th scope="col" class="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden xl:table-cell">Ciudad</th>
                  <th scope="col" class="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden xl:table-cell">Publicación</th>
                  <th scope="col" class="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Cierre</th>
                  <th scope="col" class="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                  <th scope="col" class="w-14 px-4 py-3.5"></th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                <tr
                  v-for="process in secopStore.processes"
                  :key="process.id"
                  :data-testid="`process-row-${process.id}`"
                  class="hover:bg-terciary/50 transition-colors cursor-pointer group"
                  @click="goToDetail(process.id)"
                >
                  <td class="px-4 py-4">
                    <div class="text-sm font-medium text-primary max-w-[200px] truncate group-hover:text-secondary transition-colors">{{ process.entity_name }}</div>
                    <div class="text-xs text-gray-400 mt-0.5">{{ process.reference }}</div>
                  </td>
                  <td class="px-4 py-4 hidden lg:table-cell">
                    <div class="text-sm text-gray-700 max-w-[250px] truncate">{{ process.procedure_name || process.description }}</div>
                  </td>
                  <td class="px-4 py-4 hidden md:table-cell">
                    <span class="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20 truncate max-w-[150px]">
                      {{ process.procurement_method || '-' }}
                    </span>
                  </td>
                  <td class="px-4 py-4 whitespace-nowrap">
                    <span class="text-sm font-semibold text-primary">{{ formatCurrency(process.base_price) }}</span>
                  </td>
                  <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-600 hidden sm:table-cell">
                    {{ process.department || '-' }}
                  </td>
                  <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-600 hidden xl:table-cell">
                    {{ process.city || '-' }}
                  </td>
                  <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-600 hidden xl:table-cell">
                    {{ formatDate(process.publication_date) }}
                  </td>
                  <td class="px-4 py-4 whitespace-nowrap hidden md:table-cell">
                    <div class="text-sm text-gray-700">{{ formatDate(process.closing_date) }}</div>
                    <div v-if="process.days_remaining !== null && process.days_remaining >= 0" :class="[
                      'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium mt-1',
                      process.days_remaining <= 3
                        ? 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20'
                        : 'bg-gray-50 text-gray-600'
                    ]">
                      {{ process.days_remaining }} días
                    </div>
                  </td>
                  <td class="px-4 py-4 whitespace-nowrap">
                    <div class="flex items-center gap-1.5 flex-wrap">
                      <span :class="[
                        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
                        process.is_open
                          ? 'bg-green-50 text-green-700 ring-green-600/20'
                          : 'bg-gray-50 text-gray-600 ring-gray-500/20'
                      ]">
                        {{ process.status || 'N/A' }}
                      </span>
                      <ClassificationBadge
                        v-if="process.my_classification"
                        :status="process.my_classification.status"
                      />
                    </div>
                  </td>
                  <td class="px-4 py-4 whitespace-nowrap text-right" @click.stop>
                    <button
                      @click="openClassifyModal(process)"
                      :data-testid="`classify-btn-${process.id}`"
                      class="rounded-lg p-1.5 text-gray-400 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 hover:bg-blue-50 hover:text-secondary transition-all"
                      title="Clasificar"
                    >
                      <TagIcon class="h-5 w-5" />
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Pagination -->
          <div v-if="secopStore.pagination.totalPages > 1" class="px-4 py-3.5 flex items-center justify-between border-t border-gray-100 sm:px-6" data-testid="secop-pagination">
            <div class="flex flex-1 justify-between sm:hidden">
              <button @click="goToPage(secopStore.pagination.currentPage - 1)" :disabled="secopStore.pagination.currentPage === 1"
                :class="['relative inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm', secopStore.pagination.currentPage === 1 ? 'opacity-50 cursor-not-allowed' : '']">
                Anterior
              </button>
              <button @click="goToPage(secopStore.pagination.currentPage + 1)" :disabled="secopStore.pagination.currentPage === secopStore.pagination.totalPages"
                :class="['relative ml-3 inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm', secopStore.pagination.currentPage === secopStore.pagination.totalPages ? 'opacity-50 cursor-not-allowed' : '']">
                Siguiente
              </button>
            </div>
            <div class="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
              <p class="text-sm text-gray-500">
                Página <span class="font-semibold text-primary">{{ secopStore.pagination.currentPage }}</span>
                de <span class="font-semibold text-primary">{{ secopStore.pagination.totalPages }}</span>
                · <span class="font-semibold text-primary">{{ secopStore.pagination.count }}</span> resultados
              </p>
              <nav class="isolate inline-flex -space-x-px rounded-lg shadow-sm">
                <button @click="goToPage(secopStore.pagination.currentPage - 1)" :disabled="secopStore.pagination.currentPage === 1"
                  :class="['relative inline-flex items-center rounded-l-lg px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50', secopStore.pagination.currentPage === 1 ? 'opacity-50 cursor-not-allowed' : '']">
                  <ChevronLeftIcon class="h-5 w-5" />
                </button>
                <template v-for="page in visiblePages" :key="page">
                  <button v-if="page !== '...'" @click="goToPage(page)"
                    :class="['relative inline-flex items-center px-4 py-2 text-sm font-semibold', secopStore.pagination.currentPage === page ? 'z-10 bg-secondary text-white' : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50']">
                    {{ page }}
                  </button>
                  <span v-else class="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-400 ring-1 ring-inset ring-gray-300">...</span>
                </template>
                <button @click="goToPage(secopStore.pagination.currentPage + 1)" :disabled="secopStore.pagination.currentPage === secopStore.pagination.totalPages"
                  :class="['relative inline-flex items-center rounded-r-lg px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50', secopStore.pagination.currentPage === secopStore.pagination.totalPages ? 'opacity-50 cursor-not-allowed' : '']">
                  <ChevronRightIcon class="h-5 w-5" />
                </button>
              </nav>
            </div>
          </div>
        </div>

        <!-- Error State -->
        <div v-else-if="secopStore.error" class="rounded-xl border-2 border-dashed border-red-200 bg-red-50/50 p-12 text-center" data-testid="secop-error">
          <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
            <ExclamationTriangleIcon class="h-8 w-8 text-red-400" />
          </div>
          <h3 class="mt-4 text-base font-semibold text-gray-900">Error al cargar procesos</h3>
          <p class="mt-2 text-sm text-gray-500 max-w-sm mx-auto">{{ secopStore.error }}</p>
          <button
            @click="loadProcesses"
            class="mt-5 inline-flex items-center gap-2 rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors"
          >
            Reintentar
          </button>
        </div>

        <!-- Empty State -->
        <div v-else class="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/50 p-12 text-center" data-testid="secop-empty">
          <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-50">
            <BuildingLibraryIcon class="h-8 w-8 text-secondary" />
          </div>
          <h3 class="mt-4 text-base font-semibold text-gray-900">
            {{ activeTab === 'classified' ? 'No has clasificado procesos' : 'No hay procesos disponibles' }}
          </h3>
          <p class="mt-2 text-sm text-gray-500 max-w-sm mx-auto">
            {{ activeTab === 'classified' ? 'Explora las oportunidades y clasifica las que te interesen.' : 'Intenta con otros filtros o espera la próxima sincronización.' }}
          </p>
          <button
            v-if="hasActiveFilters"
            @click="clearFilters"
            class="mt-5 inline-flex items-center gap-2 rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors"
          >
            <XMarkIcon class="h-4 w-4" />
            Limpiar filtros
          </button>
        </div>
      </template>

      <!-- ALERTS TAB -->
      <template v-if="activeTab === 'alerts'">
        <AlertsList
          :alerts="secopStore.alerts"
          @create="showAlertForm = true"
          @edit="editAlert"
          @toggle="handleToggleAlert"
          @delete="handleDeleteAlert"
        />
        <!-- Alert Form Modal -->
        <AlertForm
          v-if="showAlertForm"
          :alert="editingAlert"
          :available-filters="secopStore.availableFilters"
          @save="handleSaveAlert"
          @close="closeAlertForm"
        />
      </template>

      <!-- SAVED VIEWS TAB -->
      <template v-if="activeTab === 'savedViews'">
        <SavedViewsList
          :saved-views="secopStore.savedViews"
          :current-filters="currentFiltersSnapshot"
          :has-active-filters="hasActiveFilters"
          @save="handleSaveView"
          @apply="handleApplyView"
          @delete="handleDeleteView"
        />
      </template>

      <!-- Classification Modal -->
      <ClassificationModal
        v-if="showClassifyModal"
        :process="classifyingProcess"
        :current-classification="classifyingProcess?.my_classification"
        @save="handleSaveClassification"
        @delete="handleDeleteClassification"
        @close="showClassifyModal = false"
      />
    </div>
  </div>
</template>

<script setup>
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/vue";
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  ChevronDownIcon,
  ArrowDownTrayIcon,
  XMarkIcon,
  ArrowsUpDownIcon,
  AdjustmentsHorizontalIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  BuildingLibraryIcon,
  TagIcon,
  ExclamationTriangleIcon,
} from "@heroicons/vue/24/outline";
import { computed, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useSecopStore } from "@/stores/secop/index";
import { useUserStore } from "@/stores/auth/user";
import ModuleHeader from "@/components/layouts/ModuleHeader.vue";
import MultiSelectDropdown from "@/components/secop/MultiSelectDropdown.vue";
import SyncStatus from "@/components/secop/SyncStatus.vue";
import ClassificationBadge from "@/components/secop/ClassificationBadge.vue";
import ClassificationModal from "@/components/secop/ClassificationModal.vue";
import AlertsList from "@/components/secop/AlertsList.vue";
import AlertForm from "@/components/secop/AlertForm.vue";
import SavedViewsList from "@/components/secop/SavedViewsList.vue";

const router = useRouter();
const secopStore = useSecopStore();
const userStore = useUserStore();

// Role-based filter access
const filtersDisabled = computed(() => userStore.currentUser?.role === 'basic');

// Tab definitions
const tabs = [
  { key: 'all', label: 'Todas las Oportunidades' },
  { key: 'classified', label: 'Mis Clasificaciones' },
  { key: 'alerts', label: 'Alertas' },
  { key: 'savedViews', label: 'Vistas Guardadas' },
];

// Tab state
const activeTab = ref('all');

// Search & filters
const searchQuery = ref('');
const ordering = ref('-publication_date');
const pageSize = ref(20);
const showAdvancedFilters = ref(false);
const classificationFilter = ref('');
const filters = ref({
  department: [],
  procurement_method: [],
  status: [],
  entity_name: [],
  unspsc_code: '',
  keywords: '',
  min_budget: '',
  max_budget: '',
  publication_date_from: '',
  publication_date_to: '',
  closing_date_from: '',
  closing_date_to: '',
});

// Classification modal
const showClassifyModal = ref(false);
const classifyingProcess = ref(null);

// Alert form
const showAlertForm = ref(false);
const editingAlert = ref(null);

// Computed
const activeTabLabel = computed(() => {
  const labels = { all: 'Todas las Oportunidades', classified: 'Mis Clasificaciones', alerts: 'Alertas', savedViews: 'Vistas Guardadas' };
  return labels[activeTab.value] || 'Todas las Oportunidades';
});

const currentFiltersSnapshot = computed(() => ({
  search: searchQuery.value || '',
  department: filters.value.department.length ? filters.value.department.join(',') : '',
  procurement_method: filters.value.procurement_method.length ? filters.value.procurement_method.join(',') : '',
  status: filters.value.status.length ? filters.value.status.join(',') : '',
  entity_name: filters.value.entity_name.length ? filters.value.entity_name.join(',') : '',
  unspsc_code: filters.value.unspsc_code || '',
  keywords: filters.value.keywords || '',
  min_budget: filters.value.min_budget || '',
  max_budget: filters.value.max_budget || '',
  publication_date_from: filters.value.publication_date_from || '',
  publication_date_to: filters.value.publication_date_to || '',
  closing_date_from: filters.value.closing_date_from || '',
  closing_date_to: filters.value.closing_date_to || '',
}));

const hasActiveFilters = computed(() => {
  return filters.value.department.length || filters.value.procurement_method.length || filters.value.status.length || searchQuery.value
    || filters.value.entity_name.length || filters.value.unspsc_code || filters.value.keywords
    || filters.value.min_budget || filters.value.max_budget
    || filters.value.publication_date_from || filters.value.publication_date_to
    || filters.value.closing_date_from || filters.value.closing_date_to;
});

const activeFilterCount = computed(() => {
  let count = 0;
  if (filters.value.department.length) count++;
  if (filters.value.procurement_method.length) count++;
  if (filters.value.status.length) count++;
  if (filters.value.entity_name.length) count++;
  if (filters.value.unspsc_code) count++;
  if (filters.value.keywords) count++;
  if (filters.value.min_budget || filters.value.max_budget) count++;
  if (filters.value.publication_date_from || filters.value.publication_date_to) count++;
  if (filters.value.closing_date_from || filters.value.closing_date_to) count++;
  if (searchQuery.value) count++;
  return count;
});

const sortLabel = computed(() => {
  const labels = {
    '-publication_date': 'Más recientes',
    'closing_date': 'Cierre próximo',
    '-base_price': 'Mayor presupuesto',
    'entity_name': 'Entidad (A-Z)',
  };
  return labels[ordering.value] || 'Más recientes';
});

const visiblePages = computed(() => {
  const total = secopStore.pagination.totalPages;
  const current = secopStore.pagination.currentPage;
  const pages = [];

  if (total <= 7) {
    for (let i = 1; i <= total; i++) pages.push(i);
  } else if (current <= 4) {
    for (let i = 1; i <= 5; i++) pages.push(i);
    pages.push('...', total);
  } else if (current >= total - 3) {
    pages.push(1, '...');
    for (let i = total - 4; i <= total; i++) pages.push(i);
  } else {
    pages.push(1, '...', current - 1, current, current + 1, '...', total);
  }

  return pages;
});

// Initialize
onMounted(async () => {
  await Promise.all([
    secopStore.fetchAvailableFilters(),
    secopStore.fetchSyncStatus(),
    secopStore.fetchAlerts(),
    loadProcesses(),
  ]);
});

// Watch filters/ordering/pageSize for auto-reload with debounce to prevent double-fetch
let debounceTimer = null;
watch([filters, ordering, searchQuery, pageSize], () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => loadProcesses(), 300);
}, { deep: true });

watch(activeTab, (newTab) => {
  if (newTab === 'all') loadProcesses();
  else if (newTab === 'classified') loadClassified();
  else if (newTab === 'savedViews') secopStore.fetchSavedViews();
});

watch(classificationFilter, () => {
  loadClassified();
});

// Methods
function _buildFilterParams(page = 1) {
  return {
    search: searchQuery.value || undefined,
    department: filters.value.department.length ? filters.value.department.join(',') : undefined,
    procurement_method: filters.value.procurement_method.length ? filters.value.procurement_method.join(',') : undefined,
    status: filters.value.status.length ? filters.value.status.join(',') : undefined,
    entity_name: filters.value.entity_name.length ? filters.value.entity_name.join(',') : undefined,
    unspsc_code: filters.value.unspsc_code || undefined,
    keywords: filters.value.keywords || undefined,
    min_budget: filters.value.min_budget || undefined,
    max_budget: filters.value.max_budget || undefined,
    publication_date_from: filters.value.publication_date_from || undefined,
    publication_date_to: filters.value.publication_date_to || undefined,
    closing_date_from: filters.value.closing_date_from || undefined,
    closing_date_to: filters.value.closing_date_to || undefined,
    is_open: filters.value.status.length ? undefined : 'true',
    ordering: ordering.value,
    page,
    page_size: pageSize.value,
  };
}

async function loadProcesses() {
  await secopStore.fetchProcesses(_buildFilterParams(1));
}

async function loadClassified() {
  await secopStore.fetchMyClassified(classificationFilter.value || null);
}

function goToPage(page) {
  if (page < 1 || page > secopStore.pagination.totalPages) return;
  secopStore.fetchProcesses(_buildFilterParams(page));
}

function clearFilters() {
  searchQuery.value = '';
  filters.value = {
    department: [], procurement_method: [], status: [],
    entity_name: [], unspsc_code: '', keywords: '',
    min_budget: '', max_budget: '',
    publication_date_from: '', publication_date_to: '',
    closing_date_from: '', closing_date_to: '',
  };
}

function goToDetail(id) {
  router.push({ name: 'secop_detail', params: { id } });
}

function formatCurrency(value) {
  if (!value) return '-';
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);
}

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' });
}

function handleExport() {
  secopStore.exportExcel(_buildFilterParams());
}

// Classification handlers
function openClassifyModal(process) {
  classifyingProcess.value = process;
  showClassifyModal.value = true;
}

async function handleSaveClassification(data) {
  await secopStore.createClassification(data);
  showClassifyModal.value = false;
}

async function handleDeleteClassification(classificationId, processId) {
  await secopStore.deleteClassification(classificationId, processId);
  showClassifyModal.value = false;
}

// Alert handlers
function editAlert(alert) {
  editingAlert.value = alert;
  showAlertForm.value = true;
}

function closeAlertForm() {
  showAlertForm.value = false;
  editingAlert.value = null;
}

async function handleSaveAlert(data) {
  if (editingAlert.value) {
    await secopStore.updateAlert(editingAlert.value.id, data);
  } else {
    await secopStore.createAlert(data);
  }
  closeAlertForm();
}

async function handleToggleAlert(alertId) {
  await secopStore.toggleAlert(alertId);
}

async function handleDeleteAlert(alertId) {
  await secopStore.deleteAlert(alertId);
}

// Saved views handlers
async function handleSaveView(data) {
  await secopStore.createSavedView(data);
}

function handleApplyView(view) {
  searchQuery.value = view.filters.search || '';
  filters.value = {
    department: view.filters.department ? view.filters.department.split(',') : [],
    procurement_method: view.filters.procurement_method ? view.filters.procurement_method.split(',') : [],
    status: view.filters.status ? view.filters.status.split(',') : [],
    entity_name: view.filters.entity_name ? view.filters.entity_name.split(',') : [],
    unspsc_code: view.filters.unspsc_code || '',
    keywords: view.filters.keywords || '',
    min_budget: view.filters.min_budget || '',
    max_budget: view.filters.max_budget || '',
    publication_date_from: view.filters.publication_date_from || '',
    publication_date_to: view.filters.publication_date_to || '',
    closing_date_from: view.filters.closing_date_from || '',
    closing_date_to: view.filters.closing_date_to || '',
  };
  activeTab.value = 'all';
}

async function handleDeleteView(viewId) {
  await secopStore.deleteSavedView(viewId);
}
</script>
