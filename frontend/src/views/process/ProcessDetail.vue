<template>
  <SlideBar>
    <div class="w-full p-5 rounded-lg border-2 border-stroke bg-terciary">
      <!-- Card header -->
      <div class="col-span-2">
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <img src="@/assets/icons/file-01.svg" class="h-6 w-6" />
            <div class="grid">
              <h1 class="text-base text-primary font-medium">
                Laboral Ordinario
              </h1>
              <h2 class="text-sm text-gray-500 font-regular">Acoso Laboral</h2>
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
            <p class="text-gray-500">Gustavo Adolfo Pérez Pérez</p>
          </div>
          <!-- Authority information -->
          <div class="flex gap-2">
            <h3 class="text-base text-primary">Autoridad:</h3>
            <p class="text-gray-500">
              Juzgado 32 Laboral del Circuito de Bogotá DC.
            </p>
          </div>
          <!-- Accionant information -->
          <div class="flex gap-2">
            <h3 class="text-base text-primary">Dte./Accionante:</h3>
            <p class="text-gray-500">Karen Estefania España Chavez</p>
          </div>
          <!-- plaintiff information -->
          <div class="flex gap-2">
            <h3 class="text-base text-primary">Dte./Accionado:</h3>
            <p class="text-gray-500">SINTRACOLPEN</p>
          </div>
          <!-- Ref information -->
          <div class="flex gap-2">
            <h3 class="text-base text-primary">Radicado:</h3>
            <p class="text-gray-500">11001310503220210062300</p>
          </div>
          <!-- Last stage -->
          <div class="flex gap-2">
            <h3 class="text-base text-primary">Etapa Procesal:</h3>
            <p class="text-gray-500">Fallo</p>
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
            <div
              class="absolute top-1/2 left-0 right-0 z-10 transform -translate-y-1/2 flex w-full h-full px-16 justify-between items-center"
            >
              <div class="w-10 h-10 bg-secondary rounded-full"></div>
              <div class="w-20 h-20 bg-secondary rounded-full"></div>
              <div
                class="w-10 h-10 bg-white border-2 border-secondary rounded-full"
              ></div>
            </div>
          </div>
          <!-- Text of states -->
          <div
            class="relative mt-5 px-16 flex justify-between items-center text-gray-500 font-medium"
          >
            <!-- Last but one state -->
            <p class="text-xs w-10 text-center">Alegatos de conclusión</p>
            <!-- Last state -->
            <p class="text-sm w-20 text-center">Fallo</p>
            <p class="w-10"></p>
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
                    <th scope="col" class="py-3.5 pr-3 w-3/5">Descripción</th>
                    <th scope="col" class="px-3 py-3.5 w-1/5">Fecha</th>
                    <th scope="col" class="px-3 py-3.5 w-1/5">Acción</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200">
                  <tr v-for="file in archive">
                    <!-- File descripction -->
                    <td
                      class="w-3/5 py-4 pr-3 text-sm font-medium text-primary sm:pl-0 break-words"
                    >
                      {{ file.description }}
                    </td>
                    <!-- Date (The same it was created or edited) -->
                    <td
                      class="whitespace-nowrap w-1/5 px-3 py-4 text-sm text-primary"
                    >
                      {{ file.date }}
                    </td>
                    <!-- Actions buttons -->
                    <td
                      class="whitespace-nowrap w-1/5 px-3 py-4 text-sm text-primary flex gap-2"
                    >
                      <!-- Download file -->
                      <button>
                        <ArrowDownTrayIcon
                          class="h-5 w-5 text-primary"
                          aria-hidden="true"
                        >
                        </ArrowDownTrayIcon>
                      </button>
                      <!-- See file in another pad -->
                      <button>
                        <EyeIcon
                          class="h-5 w-5 text-primary"
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
                <a
                  href="#"
                  class="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0"
                >
                  <span class="sr-only">Anterior</span>
                  <ChevronLeftIcon class="h-5 w-5" aria-hidden="true" />
                </a>
                <!-- Current: "z-10 bg-indigo-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600", Default: "text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:outline-offset-0" -->
                <a
                  href="#"
                  aria-current="page"
                  class="relative z-10 inline-flex items-center bg-secondary px-4 py-2 text-sm font-semibold text-white focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                >
                  1
                </a>
                <a
                  href="#"
                  class="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0"
                >
                  2
                </a>
                <a
                  href="#"
                  class="relative hidden items-center px-4 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 md:inline-flex"
                >
                  3
                </a>
                <span
                  class="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-inset ring-gray-300 focus:outline-offset-0"
                >
                  ...
                </span>
                <a
                  href="#"
                  class="relative hidden items-center px-4 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 md:inline-flex"
                >
                  8
                </a>
                <a
                  href="#"
                  class="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0"
                >
                  9
                </a>
                <a
                  href="#"
                  class="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0"
                >
                  10
                </a>
                <a
                  href="#"
                  class="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0"
                >
                  <span class="sr-only">Siguiente</span>
                  <ChevronRightIcon class="h-5 w-5" aria-hidden="true" />
                </a>
              </nav>
            </div>
          </div>
        </div>
        <!-- Edit Button (It's gonna redirect to /process_form view) -->
        <div>
          <button
            type="button"
            class="p-2.5 text-sm text-white font-medium bg-secondary rounded-md flex gap-2"
          >
            <span class="hidden lg:block">Editar</span>
          </button>
        </div>
      </div>
    </div>
  </SlideBar>
</template>

<script setup>
import SlideBar from "@/components/layouts/SlideBar.vue";
import {
  ArrowDownTrayIcon,
  MagnifyingGlassIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@heroicons/vue/20/solid";
import { EyeIcon } from "@heroicons/vue/24/outline";

const archive = [
  { description: "Auto de suspención de términos", date: "Abr 18, 2022" },
];
</script>
