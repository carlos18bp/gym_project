<template>
  <!-- Menu button -->
  <div
    class="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8 lg:hidden"
  >
    <slot></slot>
  </div>
  
  <!-- Attributes company -->
  <div class="px-4 sm:px-6 lg:px-8 pt-10 pb-6">
    <div class="grid grid-cols-3 w-full text-center font-semibold overflow-hidden rounded-lg">
      <span class="bg-secondary text-white py-3">
        Seguridad
      </span>
      <span class="bg-terciary text-primary py-3">
        Confianza
      </span>
      <span class="bg-secondary text-white py-3">
        Tranquilidad
      </span>
    </div>
  </div>

  <!-- Cover Image and Profile Section -->
  <div class="relative">
    <!-- Cover Image -->
    <div class="h-64 w-full overflow-hidden">
      <img 
        :src="intranetGymStore.profile.cover_image_url || 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&h=400&fit=crop'" 
        alt="Cover" 
        class="h-full w-full object-cover"
      >
    </div>
    
    <!-- Profile Image -->
    <div class="absolute left-8 -bottom-16 sm:left-12">
      <div class="relative">
        <img 
          :src="intranetGymStore.profile.profile_image_url || 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=200&h=200&fit=crop'" 
          alt="G&M Logo" 
          class="h-32 w-32 rounded-full border-4 border-white shadow-lg object-cover"
        >
      </div>
    </div>
  </div>

  <!-- Company Info Section -->
  <div class="px-4 sm:px-6 lg:px-8 pt-20 pb-6">
    <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-3xl font-bold text-gray-900">G&M</h1>
        <p class="text-lg text-gray-600 mt-1">Firma de Abogados G&M</p>
        <div class="flex items-center gap-4 mt-2 text-sm text-gray-500">
          <span class="flex items-center gap-1">
            <UsersIcon class="h-4 w-4" />
            {{ intranetGymStore.lawyers_count }} {{ intranetGymStore.lawyers_count === 1 ? 'miembro' : 'miembros' }}
          </span>
          <span class="flex items-center gap-1">
            <EnvelopeIcon class="h-4 w-4" />
            0 invitaciones pendientes
          </span>
          <span class="flex items-center gap-1">
            <CalendarIcon class="h-4 w-4" />
            Creado 28 de septiembre de 2025
          </span>
        </div>
      </div>
    </div>
  </div>

  <!-- Main Content Grid -->
  <div class="px-4 sm:px-6 lg:px-8 pb-10">
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Left Column: Organigrama and Radicar Informe buttons -->
      <div class="space-y-6">
        <!-- Organigrama Button -->
        <div class="bg-gray-100 p-6 rounded-xl shadow-md">
          <h2 class="text-lg font-semibold text-primary mb-4">Organigrama</h2>
          <button
            type="button"
            @click="showOrganizationChart = true"
            class="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-secondary text-white rounded-lg hover:bg-opacity-90 transition-all font-medium"
          >
            <BuildingOfficeIcon class="h-5 w-5" />
            Ver Organigrama
          </button>
        </div>

        <!-- Radicar Informe Button -->
        <div class="bg-gray-100 p-6 rounded-xl shadow-md">
          <h2 class="text-lg font-semibold text-primary mb-4">Radicar Informe</h2>
          <p class="text-sm text-gray-700 mb-4 leading-relaxed">
            Por favor, radique su Informe de Actividades y su Cuenta de Cobro o Factura en este espacio. Recuerde presentar únicamente los documentos debidamente aprobados y firmados por el Supervisor, incluyendo los anexos correspondientes según los términos establecidos.
          </p>
          <button
            type="button"
            @click="showFacturationModal = true"
            class="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-secondary text-white rounded-lg hover:bg-opacity-90 transition-all font-medium"
          >
            <DocumentTextIcon class="h-5 w-5" />
            Enviar Informe
          </button>
        </div>
      </div>

      <!-- Middle Column: Processes and Subprocesses -->
      <div class="lg:col-span-2 bg-blue-100 p-6 rounded-xl shadow-md flex flex-col">
        <div class="mb-4">
          <h2 class="text-xl font-semibold text-primary mb-2">
            Procedimientos G&M
          </h2>
          <p class="text-sm text-gray-700">
            Aquí encontrarás los procesos y sub-procesos administrativos, operativos, mercadeo y comerciales de G&M
          </p>
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
              class="block w-full rounded-xl border-0 bg-white py-2 pl-10 pr-3
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
        <ul class="flex-grow space-y-2 text-sm rounded-xl font-regular bg-white px-4 py-3 overflow-auto max-h-[500px]">
          <li v-for="(process, index) in filteredProcess" :key="index" class="cursor-pointer hover:bg-blue-100 rounded-lg p-2 transition-colors">
            <a :href="process.file_url" target="_blank" rel="noopener noreferrer" class="flex items-center space-x-2 text-primary font-regular">
              <DocumentTextIcon class="size-5 flex-shrink-0" />
              <HighlightText :text="process.name" :query="searchTerm" highlightClass="bg-blue-200" />
            </a>
          </li>
        </ul>
      </div>
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
  UsersIcon,
  EnvelopeIcon,
  CalendarIcon,
  BuildingOfficeIcon,
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
