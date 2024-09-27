<template>
  <div
    v-if="process"
    class="my-5 mx-8 p-10 rounded-lg border-2 border-stroke bg-terciary"
  >
    <!-- Card header -->
    <div class="col-span-2">
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <img src="@/assets/icons/file-01.svg" class="h-6 w-6" />
          <div class="grid">
            <h1 class="text-base text-primary font-medium">
              {{ process.case.type }}
            </h1>
            <h2 class="text-sm text-gray-500 font-regular">
              {{ process.subcase }}
            </h2>
          </div>
        </div>
      </div>
    </div>
    <!-- Row for relevant information and timeline of process status -->
    <div class="grid grid-cols-2">
      <!-- First colum for relevant information -->
      <div class="font-medium mt-4 space-y-1">
        <!-- User information -->
        <div class="flex gap-2">
          <h3 class="text-base text-primary">Usuario:</h3>
          <p class="text-gray-500">
            {{ process.client.last_name }} {{ process.client.first_name }}
          </p>
        </div>
        <!-- Authority information -->
        <div class="flex gap-2">
          <h3 class="text-base text-primary">Autoridad:</h3>
          <p class="text-gray-500">
            {{ process.authority }}
          </p>
        </div>
        <!-- Accionant information -->
        <div class="flex gap-2">
          <h3 class="text-base text-primary">Dte./Accionante:</h3>
          <p class="text-gray-500">{{ process.plaintiff }}</p>
        </div>
        <!-- plaintiff information -->
        <div class="flex gap-2">
          <h3 class="text-base text-primary">Dte./Accionado:</h3>
          <p class="text-gray-500">{{ process.defendant }}</p>
        </div>
        <!-- Ref information -->
        <div class="flex gap-2">
          <h3 class="text-base text-primary">Radicado:</h3>
          <p class="text-gray-500">{{ process.ref }}</p>
        </div>
        <!-- Last stage -->
        <div class="flex gap-2">
          <h3 class="text-base text-primary">Etapa Procesal:</h3>
          <p class="text-gray-500">
            {{ process.stages[process.stages.length - 1].status }}
          </p>
        </div>
      </div>

      <!-- Second colum timeline of process status -->
      <div class="relative mt-16">
        <!-- Line -->
        <div class="relative">
          <div class="flex justify-between">
            <div class="border-2 border-gray-500 h-4 w-0"></div>
            <div class="border-2 border-gray-500 h-4 w-0"></div>
          </div>
          <div class="border-2 border-gray-500"></div>
          <div class="flex justify-between">
            <div class="border-2 border-gray-500 h-4 w-0"></div>
            <div class="border-2 border-gray-500 h-4 w-0"></div>
          </div>

          <!-- Bubbles -->
          <Bubbles
            :length="process.stages.length"
            :displayParam="'history'"
          />
        </div>

        <!-- Text of states -->
        <div>
          <TextStages :stages="process.stages" />
        </div>
      </div>
    </div>

    <!-- Process archive -->
    <div class="mt-14">
      <!-- Title and searchbar container -->
      <div class="flex justify-between font-medium">
        <!-- Title -->
        <h3 class="text-base text-primary">Expendiente:</h3>
        <!-- Search bar -->
        <div class="w-full max-w-lg lg:max-w-xs">
          <label for="search" class="sr-only"> Buscar </label>
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
      <!-- Archive table -->
      <div class="qflow-root">
        <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
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
                  <!-- File descripction -->
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
                    <!-- See file in another pad -->
                    <button @click="openFile(caseFile.file)">
                      <EyeIcon
                        class="h-5 w-5"
                        aria-hidden="true"
                      ></EyeIcon>
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
        <div
          class="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between"
        >
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
          <span class="hidden lg:block">Editar</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import Bubbles from "@/components/process/Bubbles.vue";
import TextStages from "@/components/process/TextStages.vue";
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
import { useUserStore } from "@/stores/user";

// Route and store
const route = useRoute();
const router = useRouter();
const processStore = useProcessStore();
const userStore = useUserStore();
const currentUser = computed(() => userStore.currentUser);

// Get process ID from route and fetch process data
const processId = route.params.process_id;
const process = computed(() => processStore.processById(processId));

onBeforeMount(async () => {
  await processStore.init();
  await userStore.init();
});

// State for search and pagination
const searchTerm = ref("");
const currentPage = ref(1);
const itemsPerPage = ref(10);

// Watch search term and reset page when it changes
watch(searchTerm, () => {
  currentPage.value = 1;
});

// Navigate to Edit form
function navigateToEdit() {
  router.push({ name: 'process_form', params: { action: 'edit', process_id: processId } });
}

// Get filtered and paginated case files
const filteredCaseFiles = computed(() => {
  if (!searchTerm.value) return process.value.case_files;
  return process.value.case_files.filter((caseFile) =>
    getFileName(caseFile.file)
      .toLowerCase()
      .includes(searchTerm.value.toLowerCase())
  );
});

// Paginated case files based on current page and items per page
const paginatedCaseFiles = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value;
  const end = start + itemsPerPage.value;
  return filteredCaseFiles.value.slice(start, end);
});

// Total pages for pagination
const totalPages = computed(() => {
  return Math.ceil(filteredCaseFiles.value.length / itemsPerPage.value);
});

// Pagination methods
function previousPage() {
  if (currentPage.value > 1) currentPage.value--;
}

function nextPage() {
  if (currentPage.value < totalPages.value) currentPage.value++;
}

function goToPage(page) {
  currentPage.value = page;
}

// Helper function to get file name
function getFileName(fileUrl) {
  return fileUrl.split("/").pop();
}

// Open file in new tab
function openFile(fileUrl) {
  window.open(fileUrl, "_blank");
}

const downloadFile = async (fileUrl) => {
  try {
    // Fetch the file from the server
    const response = await fetch(fileUrl);

    // Check if the response is okay
    if (!response.ok) {
      throw new Error(`Failed to fetch the file: ${response.statusText}`);
    }

    // Convert the response to a blob
    const blob = await response.blob();

    // Create a temporary link element
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);

    // Get the file name from the URL
    const fileName = fileUrl.split('/').pop();
    link.download = fileName;

    // Append the link to the DOM
    document.body.appendChild(link);

    // Trigger a click on the link to start the download
    link.click();

    // Remove the link from the DOM
    document.body.removeChild(link);

    // Revoke the object URL to release memory
    window.URL.revokeObjectURL(link.href);
  } catch (error) {
    console.error("An error occurred while downloading the file:", error);
  }
};

/**
 * Converts an ISO date string to a formatted date and time string in the Bogota, Colombia time zone.
 *
 * @param {string} isoDateString - The ISO date string to be converted, e.g., "2024-09-25T23:56:28.630717Z".
 * @returns {string} - The formatted date and time string in the format "YYYY-MM-DD HH:mm:ss hora Bogotá Colombia".
 * 
 * @example
 * const isoDateString = "2024-09-25T23:56:28.630717Z";
 * const bogotaTime = convertToBogotaTime(isoDateString);
 * console.log(bogotaTime); // Output: "2024-09-25 18:56:28 hora Bogotá Colombia"
 */
 const convertToBogotaTime = (isoDateString) => {
  // Crear un objeto Date a partir de la cadena ISO
  const date = new Date(isoDateString);
  
  // Convertir a la hora de Bogotá (America/Bogota) usando toLocaleString
  const options = {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false, // Usar formato de 24 horas
  };

  // Formatear la fecha y hora en la zona horaria de Bogotá
  const formattedDate = date.toLocaleString("en-CA", options);

  // Retornar la fecha en el formato deseado
  return formattedDate
};
</script>
