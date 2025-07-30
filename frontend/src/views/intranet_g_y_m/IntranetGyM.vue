<template>
  <!-- Menu button -->
  <div
    class="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8 lg:hidden"
  >
    <slot></slot>
  </div>
  <!-- Main content -->
  <div class="pb-10 px-4 sm:px-6 lg:px-8 lg:pt-10">
    <!-- Atributes company -->
    <div class="grid grid-cols-3 w-full text-center font-semibold overflow-hidden rounded-lg">
      <!-- Seguridad -->
      <span class="bg-secondary text-white py-3">
        Seguridad
      </span>
      <!-- Confianza -->
      <span class="bg-terciary text-primary py-3">
        Confianza
      </span>
      <span class="bg-secondary text-white py-3">
        Tranquilidad
      </span>
    </div>
  </div>
  <!-- Main container in 3 columns -->
  <div class="grid grid-cols-1 gap-6 md:grid-cols-3 sm:px-6 lg:px-8">
    <!-- 1. Organization Chart (Organigrama) -->
    <div class="bg-gray-100 p-6 rounded-xl shadow-md">
      <div class="mb-4 flex items-center space-x-2">
        <!-- Icon (if you have one imported) -->
        <!-- <BuildingOfficeIcon class="h-5 w-5 text-primary" /> -->
        <h2 class="text-lg font-semibold text-primary">Organigrama</h2>
      </div>
      <img 
      @click="showOrganizationChart = true" 
      class="cursor-pointer transition-all duration-200 ease-in-out transform hover:bg-gray-200 hover:rounded-xl hover:shadow-lg hover:-translate-x-1 hover:-translate-y-1" 
      src="@/assets/images/charts/organization_chart.png" 
      alt="Organigrama G&M"
      >
    </div>

    <!-- 2. Processes and Subprocesses (with search bar) -->
    <div class="bg-blue-100 p-6 rounded-xl shadow-md flex flex-col max-h-[550px]">
      <!-- Header: Icon and Title -->
      <div class="mb-4 flex items-center space-x-2">
        <!-- <FolderIcon class="h-5 w-5 text-primary" /> -->
        <h2 class="text-lg font-semibold text-primary">
          Procesos y Subprocesos
        </h2>
      </div>

      <!-- Search bar -->
      <div class="w-full mb-4">
        <label for="search" class="sr-only">Buscar</label>
        <div class="relative">
          <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <MagnifyingGlassIcon class="h-5 w-5 text-gray-400" aria-hidden="true" />
          </div>
          <input
            id="search"
            name="search"
            v-model="searchTerm"
            class="block w-full rounded-xl border-0 bg-white py-1.5 pl-10 pr-3
                  text-gray-900 ring-1 ring-inset ring-gray-300
                  placeholder:text-gray-400
                  focus:ring-2 focus:ring-inset focus:ring-secondary
                  sm:text-sm sm:leading-6"
            placeholder="Buscar"
            type="search"
          />
        </div>
      </div>

      <!-- List of legal documents -->
      <ul class="flex-grow space-y-2 text-sm rounded-xl font-regular bg-white px-3 pt-1 pb-3 overflow-auto">
        <!-- Loop through filteredProcess and display each document's name with a link -->
        <li v-for="(process, index) in filteredProcess" :key="index" class="cursor-pointer hover:bg-blue-100 rounded-lg">
          <a :href="process.file_url" target="_blank" rel="noopener noreferrer" class="flex items-center space-x-1 text-primary font-regular">
            <DocumentTextIcon class="size-4" />
            <HighlightText :text="process.name" :query="searchTerm" highlightClass="bg-blue-200" />
          </a>
        </li>
      </ul>
    </div>
    <!-- 3. Billing / File a Report -->
    <div class="bg-gray-100 p-6 rounded-xl shadow-md">
      <div class="mb-4 flex items-center space-x-2">
        <!-- Icon (if you have one imported) -->
        <!-- <DocumentTextIcon class="h-5 w-5 text-primary" /> -->
        <h2 class="text-lg font-semibold text-primary">Radicar Informe</h2>
      </div>
      <p class="text-lg font-regular text-gray-700 mb-4 leading-relaxed text-justify">
        Por favor, radique su Informe de Actividades y su Cuenta de Cobro o Factura en este espacio. Recuerde presentar únicamente los documentos debidamente aprobados y firmados por el Supervisor, incluyendo los anexos correspondientes según los términos establecidos.
      </p>
      <button
        type="button"
        @click="showFacturationModal = true"
        class="inline-flex items-center px-4 py-2 bg-secondary text-white
              rounded-md"
      >
        Enviar Informe
      </button>
    </div>
  </div>

  <!-- Facturation Modal -->
  <ModalTransition v-show="showFacturationModal">
    <FacturationForm @close="showFacturationModal = false" />
  </ModalTransition>
  <ModalTransition v-show="showOrganizationChart">
      <div class="relative bg-white rounded-xl p-3">
        <div class="absolute right-0 top-0 pt-6 pe-6">
          <XMarkIcon class="cursor-pointer size-6 text-primary" @click="showOrganizationChart = false"></XMarkIcon>
        </div>
        <img src="@/assets/images/charts/organigram_chart.png" alt="Organigrama y organización de G&M">
      </div>
  </ModalTransition>
</template>

<script setup>
import {
  MagnifyingGlassIcon,
  XMarkIcon,
  DocumentTextIcon,
} from "@heroicons/vue/24/outline";
import { useIntranetGymStore } from "@/stores/legal/intranet_gym";
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import ModalTransition from "@/components/layouts/animations/ModalTransition.vue";
import { useSearch } from '@/composables/useSearch.js';
import HighlightText from '@/components/utils/HighlightText.vue';
import FacturationForm from './FacturationForm.vue';

// Handlers for modals
const showFacturationModal = ref(false);
const showOrganizationChart = ref(false);

/**
 * Router of app used for redirect the user.
 */
const router = useRouter();

// import the store
const intranetGymStore = useIntranetGymStore();
const legalDocuments = ref([]);

// Use the composable, passing the array and the fields to search
const { searchTerm, filteredProcess } = useSearch(legalDocuments, ['name'])

// Call to init function to fetch the legal documents
onMounted(async () => {
  await intranetGymStore.init();
  legalDocuments.value = intranetGymStore.legalDocuments;
});
</script>
