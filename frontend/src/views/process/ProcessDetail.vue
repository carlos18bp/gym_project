<template>
  <!-- Menu button -->
  <div
    class="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8"
  >
    <slot></slot>
  </div>
  <!-- Content -->
  <div class="py-10 px-4 sm:px-6 lg:px-8">
    <div
      v-if="process"
      class="space-y-6"
    >
      <!-- Card: process header and information -->
      <div class="p-6 rounded-lg border border-gray-200 bg-white shadow-sm">
        <!-- Header with case type and client avatar -->
        <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between mb-6">
          <div class="flex items-center gap-3">
            <img src="@/assets/icons/file-01.svg" class="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 flex-shrink-0" />
            <div class="min-w-0 flex-1">
              <h1 class="text-base sm:text-xl font-semibold text-blue-600 break-words">
                {{ process.case.type }}
              </h1>
              <p class="text-xs sm:text-sm text-gray-600 mt-1 break-words">
                {{ process.subcase }}
              </p>
            </div>
          </div>
          
          <!-- Client avatar and info (avatar on the left, info on the right) -->
          <div class="flex items-center gap-2 sm:gap-3 min-w-0">
            <!-- Show photo_profile if available, otherwise show initials -->
            <img 
              v-if="process.client.photo_profile"
              :src="process.client.photo_profile" 
              :alt="process.client.first_name"
              class="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover border-2 border-gray-200 shadow-sm flex-shrink-0"
            />
            <div 
              v-else
              class="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold text-base sm:text-lg shadow-md flex-shrink-0"
            >
              {{ getInitials(process.client.first_name, process.client.last_name) }}
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-xs sm:text-sm font-medium text-gray-900 truncate">
                {{ process.client.first_name }} {{ process.client.last_name }}
              </p>
              <p class="text-xs text-gray-500 truncate">{{ process.client.email || 'Cliente' }}</p>
            </div>
          </div>
        </div>

        <!-- Information sections -->
        <div class="grid md:grid-cols-2 gap-6">
        <!-- Left column: Process details -->
        <div class="space-y-4">
          <!-- Authority section -->
          <div class="bg-gray-50 rounded-lg p-3 sm:p-4 border border-gray-200">
            <h3 class="text-xs sm:text-sm font-semibold text-blue-600 mb-3 break-words">Oficina de Control Interno Disciplinario</h3>
            <div class="space-y-2">
              <div class="flex flex-col sm:flex-row sm:items-start gap-1">
                <span class="text-xs sm:text-sm font-medium text-gray-600 sm:w-32 flex-shrink-0">Autoridad:</span>
                <span class="text-xs sm:text-sm text-gray-900 break-words">{{ process.authority }}</span>
              </div>
              <div class="flex flex-col sm:flex-row sm:items-start gap-1">
                <span class="text-xs sm:text-sm font-medium text-gray-600 sm:w-32 flex-shrink-0">Email:</span>
                <span class="text-xs sm:text-sm text-blue-600 break-all">{{ process.authority.toLowerCase().replace(/\s+/g, '') }}@colpensiones.gov.co</span>
              </div>
              <div class="flex flex-col sm:flex-row sm:items-start gap-1">
                <span class="text-xs sm:text-sm font-medium text-gray-600 sm:w-32 flex-shrink-0">Radicado:</span>
                <span class="text-xs sm:text-sm text-gray-900 break-words">{{ process.ref }}</span>
              </div>
            </div>
          </div>

          <!-- Parties section -->
          <div class="bg-gray-50 rounded-lg p-3 sm:p-4 border border-gray-200">
            <h3 class="text-xs sm:text-sm font-semibold text-blue-600 mb-3">Partes del Proceso</h3>
            <div class="space-y-2">
              <div class="flex flex-col sm:flex-row sm:items-start gap-1">
                <span class="text-xs sm:text-sm font-medium text-gray-600 sm:w-32 flex-shrink-0">Dte./Accionante:</span>
                <span class="text-xs sm:text-sm text-gray-900 break-words">{{ process.plaintiff }}</span>
              </div>
              <div class="flex flex-col sm:flex-row sm:items-start gap-1">
                <span class="text-xs sm:text-sm font-medium text-gray-600 sm:w-32 flex-shrink-0">Ddo./Accionado:</span>
                <span class="text-xs sm:text-sm text-gray-900 break-words">{{ process.defendant }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Right column: Process stage progress -->
        <div>
          <ProcessStageProgress
            :stages="process.stages"
            :total-stages-expected="5"
            @open-history="showHistoryModal = true"
          />
        </div>
      </div>
      </div>

      <!-- Card: expediente and document list -->
      <div class="p-6 rounded-lg border border-gray-200 bg-white shadow-sm">
        <!-- Title and searchbar container -->
        <div
          class="flex flex-col gap-3 justify-between font-medium md:flex-row mb-4"
        >
          <!-- Title -->
          <h3 class="text-lg font-semibold text-blue-600">Expediente</h3>
          <!-- Search bar -->
          <div class="max-w-lg lg:max-w-xs">
            <label for="search" class="sr-only">Buscar</label>
            <div class="relative">
              <div
                class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3"
              >
                <MagnifyingGlassIcon
                  class="h-5 w-5 text-gray-400"
                  aria-hidden="true"
                />
              </div>
              <input
                id="search"
                name="search"
                v-model="searchTerm"
                class="block w-full rounded-md border-0 bg-white py-1.5 pl-10 pr-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-secondary sm:text-sm sm:leading-6"
                placeholder="Buscar"
                type="search"
              />
            </div>
          </div>
        </div>
        <!-- Archive/document table -->
        <div v-if="filteredCaseFiles.length === 0" class="flex flex-col items-center justify-center py-12 text-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 class="text-base font-medium text-gray-900 mb-1">No hay expedientes registrados</h3>
          <p class="text-sm text-gray-500 max-w-sm">
            Este proceso aún no tiene documentos de expediente asociados. Los archivos que se agreguen aparecerán aquí.
          </p>
        </div>
        <div v-else class="flow-root overflow-y-auto max-h-[400px] whitespace-nowrap">
          <div class="-my-2 sm:-mx-6 lg:-mx-8">
            <div
              class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8"
            >
              <table class="min-w-full divide-y divide-gray-300">
                <thead>
                  <tr class="text-left text-base font-regular text-primary">
                    <th scope="col" class="py-3.5 pr-3 w-2/5">Documento</th>
                    <th scope="col" class="px-3 py-3.5 w-2/5">Fecha</th>
                    <th scope="col" class="px-3 py-3.5 w-1/5">Acción</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200">
                  <tr v-for="caseFile in paginatedCaseFiles" :key="caseFile.id">
                    <!-- File description -->
                    <td
                      class="w-2/5 py-4 pr-3 text-sm font-medium text-stone-700 sm:pl-0 break-words"
                    >
                      {{ getFileName(caseFile.file) }}
                    </td>
                    <!-- Date (The same it was created or edited) -->
                    <td
                      class="whitespace-nowrap w-2/5 px-3 py-4 text-sm text-stone-700"
                    >
                      {{ convertToBogotaTime(caseFile.created_at) }}
                    </td>
                    <!-- Actions buttons -->
                    <td
                      class="whitespace-nowrap w-1/5 px-3 py-4 text-sm text-primary flex space-x-2"
                    >
                      <!-- Download file -->
                      <button @click="downloadFile(caseFile.file)">
                        <ArrowDownTrayIcon
                          class="h-5 w-5"
                          aria-hidden="true"
                        ></ArrowDownTrayIcon>
                      </button>
                      <!-- View file in another tab -->
                      <button @click="openFile(caseFile.file)">
                        <EyeIcon class="h-5 w-5" aria-hidden="true"></EyeIcon>
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      <!-- Pagination and edit button container -->
      <div class="w-full flex justify-between mt-4">
        <!-- Pagination -->
        <div class="flex items-center justify-between">
          <div class="sm:flex sm:flex-1 sm:items-center sm:justify-between">
            <div>
              <nav
                class="isolate inline-flex -space-x-px rounded-md shadow-sm"
                aria-label="Pagination"
              >
                <button
                  @click="previousPage"
                  :disabled="currentPage === 1"
                  class="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0"
                >
                  <span class="sr-only">Anterior</span>
                  <ChevronLeftIcon class="h-5 w-5" aria-hidden="true" />
                </button>
                <span
                  v-for="page in totalPages"
                  :key="page"
                  @click="goToPage(page)"
                  :class="[
                    'relative inline-flex items-center px-4 py-2 text-sm font-semibold focus:z-20 focus:outline-offset-0',
                    { 'bg-secondary text-white': currentPage === page },
                    {
                      'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 cursor-pointer':
                        currentPage !== page,
                    },
                  ]"
                >
                  {{ page }}
                </span>
                <button
                  @click="nextPage"
                  :disabled="currentPage === totalPages"
                  class="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0"
                >
                  <span class="sr-only">Siguiente</span>
                  <ChevronRightIcon class="h-5 w-5" aria-hidden="true" />
                </button>
              </nav>
            </div>
          </div>
        </div>
        <!-- Edit Button (It's gonna redirect to /process_form view) -->
        <div v-if="currentUser.role !== 'client'">
          <button
            @click="navigateToEdit"
            type="button"
            class="p-2.5 text-sm text-white font-medium bg-secondary rounded-md flex gap-2"
          >
            <span class="lg:block">Editar</span>
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Process History Modal -->
  <ProcessHistoryModal
    :is-open="showHistoryModal"
    :stages="process?.stages || []"
    @close="showHistoryModal = false"
  />
</template>

<script setup>
import ProcessStageProgress from "@/components/process/ProcessStageProgress.vue";
import ProcessHistoryModal from "@/components/process/ProcessHistoryModal.vue";
import {
  ArrowDownTrayIcon,
  MagnifyingGlassIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@heroicons/vue/20/solid";
import { EyeIcon } from "@heroicons/vue/24/outline";
import { computed, onBeforeMount, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useProcessStore } from "@/stores/process";
import { useUserStore } from "@/stores/auth/user";

// Route and store instances
const route = useRoute();
const router = useRouter();
const processStore = useProcessStore();
const userStore = useUserStore();
const currentUser = computed(() => userStore.currentUser);

// Get process ID from route and fetch process data
const processId = route.params.process_id;
const process = computed(() => processStore.processById(processId));

/**
 * Initializes process and user data before the component is mounted.
 */
onBeforeMount(async () => {
  try {
    await Promise.all([
      processStore.init(),
      userStore.init(),
    ]);
  } catch (error) {
    console.error('Error initializing process detail:', error);
  }
});

// State variables for search and pagination
const searchTerm = ref("");
const currentPage = ref(1);
const itemsPerPage = ref(10);
const showHistoryModal = ref(false);

/**
 * Watches for changes in the search term and resets the page to the first one.
 */
watch(searchTerm, () => {
  currentPage.value = 1;
});

/**
 * Navigates to the edit form for the current process.
 */
function navigateToEdit() {
  router.push({
    name: "process_form",
    params: { action: "edit", process_id: processId },
  });
}

/**
 * Filters case files based on the search term.
 *
 * @returns {Array} Filtered case files.
 */
const filteredCaseFiles = computed(() => {
  if (!searchTerm.value) return process.value.case_files;
  return process.value.case_files.filter((caseFile) =>
    getFileName(caseFile.file)
      .toLowerCase()
      .includes(searchTerm.value.toLowerCase())
  );
});

/**
 * Retrieves a paginated list of case files based on the current page.
 *
 * @returns {Array} Paginated case files.
 */
const paginatedCaseFiles = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value;
  const end = start + itemsPerPage.value;
  return filteredCaseFiles.value.slice(start, end);
});

/**
 * Calculates the total number of pages based on the number of case files.
 *
 * @returns {number} Total pages.
 */
const totalPages = computed(() => {
  return Math.ceil(filteredCaseFiles.value.length / itemsPerPage.value);
});

// Pagination methods

/**
 * Moves to the previous page if possible.
 */
function previousPage() {
  if (currentPage.value > 1) currentPage.value--;
}

/**
 * Moves to the next page if possible.
 */
function nextPage() {
  if (currentPage.value < totalPages.value) currentPage.value++;
}

/**
 * Navigates to a specific page.
 *
 * @param {number} page - The page number to navigate to.
 */
function goToPage(page) {
  currentPage.value = page;
}

/**
 * Extracts the file name from a given URL.
 *
 * @param {string} fileUrl - The URL of the file.
 * @returns {string} The extracted file name.
 */
function getFileName(fileUrl) {
  return fileUrl.split("/").pop();
}

/**
 * Opens a file in a new browser tab.
 *
 * @param {string} fileUrl - The URL of the file to open.
 */
function openFile(fileUrl) {
  window.open(fileUrl, "_blank");
}

/**
 * Downloads a file from the given URL.
 *
 * @param {string} fileUrl - The URL of the file to download.
 */
const downloadFile = async (fileUrl) => {
  try {
    // Fetch the file from the server
    const response = await fetch(fileUrl);

    // Check if the response is valid
    if (!response.ok) {
      throw new Error(`Failed to fetch the file: ${response.statusText}`);
    }

    // Convert the response to a blob
    const blob = await response.blob();

    // Create a temporary link element
    const link = document.createElement("a");
    link.href = window.URL.createObjectURL(blob);

    // Extract the file name from the URL
    const fileName = fileUrl.split("/").pop();
    link.download = fileName;

    // Append the link to the DOM and trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Revoke the object URL to free up memory
    window.URL.revokeObjectURL(link.href);
  } catch (error) {
    console.error("An error occurred while downloading the file:", error);
  }
};

/**
 * Converts an ISO date string to a formatted date and time string in the Bogota, Colombia time zone.
 *
 * @param {string} isoDateString - The ISO date string to be converted (e.g., "2024-09-25T23:56:28.630717Z").
 * @returns {string} - The formatted date and time string in the format "YYYY-MM-DD HH:mm:ss Bogotá time".
 */
const convertToBogotaTime = (isoDateString) => {
  // Create a Date object from the ISO string
  const date = new Date(isoDateString);

  // Convert to Bogotá time zone using toLocaleString
  const options = {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false, // Use 24-hour format
  };

  // Format the date and time in Bogotá's time zone
  const formattedDate = date.toLocaleString("en-CA", options);

  return formattedDate;
};

/**
 * Gets initials from first and last name
 * @param {string} firstName
 * @param {string} lastName
 * @returns {string} Initials
 */
const getInitials = (firstName, lastName) => {
  const first = firstName?.charAt(0)?.toUpperCase() || '';
  const last = lastName?.charAt(0)?.toUpperCase() || '';
  return `${first}${last}`;
};
</script>
