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
    <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between">
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
      <!-- Organigrama Button -->
      <div class="mt-4 sm:mt-0 sm:self-start">
        <button
          type="button"
          @click="showOrganizationChart = true"
          class="inline-flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all font-medium shadow-md hover:shadow-lg"
        >
          <BuildingOfficeIcon class="h-5 w-5" />
          Ver Organigrama
        </button>
      </div>
    </div>
  </div>

  <!-- Main Content Grid -->
  <div class="px-4 sm:px-6 lg:px-8 pb-10">
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Left Column: Radicar Informe button -->
      <div class="space-y-6">
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
            <button
              type="button"
              @click="handleDownload(process)"
              class="flex items-center space-x-2 text-primary font-regular w-full text-left"
            >
              <DocumentTextIcon class="size-5 flex-shrink-0" />
              <HighlightText :text="process.name" :query="searchTerm" highlightClass="bg-blue-200" />
            </button>
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
    <div class="relative bg-white rounded-xl shadow-xl max-w-[95vw] w-full max-h-[95vh] overflow-hidden flex flex-col">
      <!-- Header with close button -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
        <h2 class="text-xl font-semibold text-gray-900">Organigrama G&M</h2>
        <button
          @click="showOrganizationChart = false"
          class="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-lg"
          title="Cerrar"
        >
          <XMarkIcon class="h-6 w-6" />
        </button>
      </div>
      
      <!-- Image content -->
      <div class="p-6 overflow-auto flex-grow flex items-start justify-center bg-gray-50 min-h-0">
        <img 
          src="@/assets/images/charts/organigram_chart.png" 
          alt="Organigrama y organización de G&M"
          class="max-w-full h-auto rounded-lg shadow-md"
          style="min-width: fit-content;"
        >
      </div>
      
      <!-- Footer with close button -->
      <div class="px-6 py-4 border-t border-gray-200 flex justify-end flex-shrink-0">
        <button
          @click="showOrganizationChart = false"
          class="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
        >
          Cerrar
        </button>
      </div>
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
import { downloadFile } from '@/shared/document_utils';
import { showNotification } from '@/shared/notification_message';

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

/**
 * Sanitize filename by normalizing special characters
 * @param {string} filename - Original filename
 * @returns {string} - Sanitized filename
 */
const sanitizeFilename = (filename) => {
  if (!filename) return 'documento';
  
  // Normalize unicode characters (converts á to a, ñ to n, etc.)
  let sanitized = filename.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  // Replace special characters with safe alternatives
  sanitized = sanitized
    .replace(/ñ/gi, 'n')
    .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace any non-alphanumeric (except . _ -) with underscore
    .replace(/_+/g, '_') // Replace multiple underscores with single
    .replace(/^_|_$/g, ''); // Remove leading/trailing underscores
  
  return sanitized || 'documento';
};

/**
 * Handle document download using blob to prevent blank screen in PWA.
 * @param {Object} process - The document/process to download
 */
const handleDownload = async (process) => {
  try {
    if (!process.file_url) {
      await showNotification('No se encontró el archivo para descargar', 'error');
      return;
    }

    // Extract the last path segment from the URL (may be percent-encoded)
    const urlParts = process.file_url.split('/');
    let originalFilenameSegment = urlParts[urlParts.length - 1] || '';

    // Decode percent-encoded characters if present (e.g. %C3%B3)
    try {
      originalFilenameSegment = decodeURIComponent(originalFilenameSegment);
    } catch (e) {
      // If decoding fails, keep the raw segment
    }

    // Detect file extension from the (possibly decoded) URL segment
    const extensionMatch = originalFilenameSegment.match(/\.(docx?|pdf|xlsx?|txt)$/i);
    const extension = extensionMatch ? extensionMatch[0] : '.docx';

    // Use the human-readable process name as base for the download filename
    const baseName = process.name || originalFilenameSegment.replace(/\.(docx?|pdf|xlsx?|txt)$/i, '');

    // Sanitize the base name (remove tildes and special characters) and reconstruct filename
    const sanitizedBaseName = sanitizeFilename(baseName);
    const filename = `${sanitizedBaseName}${extension}`;
    
    // Determine MIME type based on file extension
    let mimeType = 'application/octet-stream';
    if (extension.toLowerCase() === '.docx') {
      mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    } else if (extension.toLowerCase() === '.pdf') {
      mimeType = 'application/pdf';
    } else if (extension.toLowerCase() === '.doc') {
      mimeType = 'application/msword';
    } else if (extension.toLowerCase() === '.xlsx') {
      mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    } else if (extension.toLowerCase() === '.xls') {
      mimeType = 'application/vnd.ms-excel';
    }

    // Use the file_url directly as it's already a full URL from the backend
    // We need to fetch it as blob to avoid navigation
    const response = await fetch(process.file_url);
    if (!response.ok) {
      throw new Error('Error al descargar el archivo');
    }
    
    const blob = await response.blob();
    const link = document.createElement('a');
    const objectUrl = window.URL.createObjectURL(blob);
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(objectUrl);
    
    await showNotification(`Documento "${process.name}" descargado exitosamente`, 'success');
  } catch (error) {
    console.error('Error downloading document:', error);
    await showNotification('Error al descargar el documento', 'error');
  }
};
</script>
