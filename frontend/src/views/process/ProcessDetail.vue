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
      class="p-5 rounded-lg border-2 border-stroke bg-terciary"
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
      <div class="grid xl:grid-cols-2">
        <!-- First column for relevant information -->
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
          <!-- Plaintiff information -->
          <div class="flex gap-2">
            <h3 class="text-base text-primary">Dte./Accionante:</h3>
            <p class="text-gray-500">{{ process.plaintiff }}</p>
          </div>
          <!-- Defendant information -->
          <div class="flex gap-2">
            <h3 class="text-base text-primary">Ddo./Accionado:</h3>
            <p class="text-gray-500">{{ process.defendant }}</p>
          </div>
          <!-- Reference number information -->
          <div class="flex gap-2">
            <h3 class="text-base text-primary">Radicado:</h3>
            <p class="text-gray-500">{{ process.ref }}</p>
          </div>
          <!-- Last procedural stage -->
          <div class="flex gap-2">
            <h3 class="text-base text-primary">Etapa Procesal:</h3>
            <p class="text-gray-500">
              {{ process.stages[process.stages.length - 1].status }}
            </p>
          </div>
        </div>

        <!-- Second column timeline of process status -->
        <div class="hidden md:block relative mt-16">
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

      <!-- Process record/archive -->
      <div class="mt-14">
        <!-- Title and searchbar container -->
        <div
          class="flex flex-col gap-3 justify-between font-medium md:flex-row"
        >
          <!-- Title -->
          <h3 class="text-base text-primary">Expendiente:</h3>
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
        <div class="flow-root overflow-y-auto max-h-[400px] whitespace-nowrap">
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
  await processStore.init();
  await userStore.init();
});

// State variables for search and pagination
const searchTerm = ref("");
const currentPage = ref(1);
const itemsPerPage = ref(10);

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
</script>
