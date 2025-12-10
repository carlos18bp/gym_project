<template>
  <!-- Menu button -->
  <div
    class="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8 lg:hidden"
  >
    <slot></slot>
  </div>
  <!-- Content -->
  <div class="pb-10 px-4 sm:px-6 lg:px-8 lg:pt-10">
    <div class="w-full p-5 rounded-lg border-2 border-stroke bg-terciary">
      <!-- Title -->
      <div>
        <h1 class="text-primary text-xl font-semibold">
          Información del proceso
        </h1>
      </div>
      <!-- Relevant information form -->
      <div class="mt-4 space-y-3">
        <!-- First row -->
        <div class="grid md:grid-cols-2 xl:grid-cols-4 gap-3">
          <!-- Plaintiff form -->
          <div>
            <label
              for="plaintiff"
              class="block text-base font-medium leading-6 text-primary"
            >
              Dte./Accionante
              <span class="text-red-500">*</span>
            </label>
            <div class="mt-2">
              <input
                v-model="formData.plaintiff"
                type="text"
                name="plaintiff"
                id="plaintiff"
                class="block w-full rounded-md border-0 py-1.5 text-primary shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-secondary sm:text-sm sm:leading-6"
                required
              />
            </div>
          </div>
          <!-- Defendant form -->
          <div>
            <label
              for="defendant"
              class="block text-base font-medium leading-6 text-primary"
            >
              Ddo./Accionado
              <span class="text-red-500">*</span>
            </label>
            <div class="mt-2">
              <input
                v-model="formData.defendant"
                type="text"
                name="defendant"
                id="defendant"
                class="block w-full rounded-md border-0 py-1.5 text-primary shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-secondary sm:text-sm sm:leading-6"
                required
              />
            </div>
          </div>
          <!-- Type case form -->
          <div>
            <Combobox
              as="div"
              v-model="selectedCaseType"
              @update:modelValue="query = ''"
            >
              <ComboboxLabel
                class="block text-base font-medium leading-6 text-primary"
              >
                Tipo Proceso
                <span class="text-red-500">*</span>
              </ComboboxLabel>
              <div class="relative mt-2">
                <ComboboxInput
                  class="w-full rounded-md border-0 bg-white py-1.5 pl-3 pr-10 text-primary shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-secondary sm:text-sm sm:leading-6"
                  @change="query = $event.target.value"
                  @blur="query = ''"
                  :display-value="(caseType) => caseType?.type"
                />
                <ComboboxButton
                  class="absolute inset-y-0 right-0 flex items-center gap-2 rounded-r-md px-2 focus:outline-none border-l border-gray-300"
                >
                  Seleccionar
                  <ChevronDownIcon
                    class="h-5 w-5 text-gray-400"
                    aria-hidden="true"
                  />
                </ComboboxButton>

                <ComboboxOptions
                  v-if="filteredCaseTypes.length > 0"
                  class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm"
                >
                  <ComboboxOption
                    v-for="caseType in filteredCaseTypes"
                    :key="caseType.id"
                    :value="caseType"
                    as="template"
                    v-slot="{ active, selected }"
                  >
                    <li
                      :class="[
                        'relative cursor-default select-none py-2 pl-3 pr-9',
                        active ? 'bg-secondary text-white' : 'text-primary',
                      ]"
                    >
                      <span
                        :class="['block truncate', selected && 'font-semibold']"
                      >
                        {{ caseType.type }}
                      </span>

                      <span
                        v-if="selected"
                        :class="[
                          'absolute inset-y-0 right-0 flex items-center pr-4',
                          active ? 'text-white' : 'text-secondary',
                        ]"
                      >
                        <CheckIcon class="h-5 w-5" aria-hidden="true" />
                      </span>
                    </li>
                  </ComboboxOption>
                </ComboboxOptions>
              </div>
            </Combobox>
          </div>
          <!-- Subcase form -->
          <div>
            <label
              for="defendant"
              class="block text-base font-medium leading-6 text-primary"
            >
              Subclase
              <span class="text-red-500">*</span>
            </label>
            <div class="mt-2">
              <input
                v-model="formData.subcase"
                type="text"
                name="defendant"
                id="defendant"
                class="block w-full rounded-md border-0 py-1.5 text-primary shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-secondary sm:text-sm sm:leading-6"
                required
              />
            </div>
          </div>
        </div>
        <!-- Second row -->
        <div class="grid md:grid-cols-3 gap-3">
          <!-- Ref form -->
          <div>
            <label
              for="plaintiff"
              class="block text-base font-medium leading-6 text-primary"
            >
              Radicado
              <span class="text-red-500">*</span>
            </label>
            <div class="mt-2">
              <input
                v-model="formData.ref"
                type="text"
                name="plaintiff"
                id="plaintiff"
                class="block w-full rounded-md border-0 py-1.5 text-primary shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-secondary sm:text-sm sm:leading-6"
                required
              />
            </div>
          </div>
          <!-- Authority form -->
          <div>
            <label
              for="plaintiff"
              class="block text-base font-medium leading-6 text-primary"
            >
              Autoridad
              <span class="text-red-500">*</span>
            </label>
            <div class="mt-2">
              <input
                v-model="formData.authority"
                type="text"
                name="plaintiff"
                id="plaintiff"
                class="block w-full rounded-md border-0 py-1.5 text-primary shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-secondary sm:text-sm sm:leading-6"
                required
              />
            </div>
          </div>
          <!-- Client form -->
          <div>
            <Combobox
              as="div"
              v-model="selectedClient"
              @update:modelValue="query = ''"
            >
              <ComboboxLabel
                class="block text-sm font-medium leading-6 text-primary"
              >
                Usuario
                <span class="text-red-500">*</span>
              </ComboboxLabel>
              <div class="relative mt-2">
                <ComboboxInput
                  class="w-full rounded-md border-0 bg-white py-1.5 pl-3 pr-12 text-primary shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-secondary sm:text-sm sm:leading-6"
                  @change="query = $event.target.value"
                  @blur="query = ''"
                  :display-value="
                    (client) =>
                      client?.last_name && client?.first_name
                        ? `${client?.last_name} ${client?.first_name}`
                        : ''
                  "
                />
                <ComboboxButton
                  class="absolute inset-y-0 right-0 flex items-center rounded-r-md px-2 focus:outline-none"
                >
                  <ChevronDownIcon
                    class="h-5 w-5 text-gray-400"
                    aria-hidden="true"
                  />
                </ComboboxButton>

                <ComboboxOptions
                  v-if="filteredClients.length > 0"
                  class="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm"
                >
                  <ComboboxOption
                    v-for="client in filteredClients"
                    :key="client.id"
                    :value="client"
                    as="template"
                    v-slot="{ active, selected }"
                  >
                    <li
                      :class="[
                        'relative cursor-default select-none py-2 pl-3 pr-9',
                        active ? 'bg-secondary text-white' : 'text-primary',
                      ]"
                    >
                      <div class="flex items-center">
                        <img
                          :src="client.photo_profile || userAvatar"
                          alt="Foto de perfil"
                          class="h-6 w-6 flex-shrink-0 rounded-full"
                        />

                        <span
                          :class="[
                            'ml-3 truncate',
                            selected && 'font-semibold',
                          ]"
                        >
                          {{ client.last_name }} {{ client.first_name }}
                        </span>
                      </div>

                      <span
                        v-if="selected"
                        :class="[
                          'absolute inset-y-0 right-0 flex items-center pr-4',
                          active ? 'text-white' : 'text-secondary',
                        ]"
                      >
                        <CheckIcon class="h-5 w-5" aria-hidden="true" />
                      </span>
                    </li>
                  </ComboboxOption>
                </ComboboxOptions>
              </div>
            </Combobox>
          </div>
        </div>
        <!-- Third row -->
        <div>
          <!-- Title and button add container -->
          <div class="flex items-center gap-3 font-medium">
            <p class="inline-block text-base text-primary">
              Etapa procesal
              <span class="text-red-500">*</span>
            </p>
            <button
              @click="addStage"
              class="flex items-center px-2 py-1 rounded-md text-sm text-secondary bg-selected-background"
            >
              <PlusIcon class="h-5 w-5" />
              Nuevo
            </button>
          </div>
          <!-- Stages table -->
          <div class="qflow-root">
            <div class="-my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
              <!-- Mobile: Card layout -->
              <div class="block md:hidden space-y-3">
                <div
                  v-for="(stage, index) in formData.stages"
                  :key="index"
                  class="bg-gray-50 rounded-lg p-4 border border-gray-200"
                >
                  <div class="space-y-3">
                    <!-- Stage description -->
                    <div>
                      <label class="block text-xs font-medium text-gray-700 mb-1">
                        Descripción
                      </label>
                      <input
                        v-model="stage.status"
                        type="text"
                        name="stage"
                        placeholder="Descripción de la etapa"
                        class="block w-full rounded-md border-0 py-2 text-primary shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-secondary text-sm"
                        required
                      />
                    </div>
                    
                    <!-- Date and delete button row -->
                    <div class="flex items-end gap-2">
                      <div class="flex-1">
                        <label class="block text-xs font-medium text-gray-700 mb-1">
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          Fecha
                        </label>
                        <input
                          v-model="stage.date"
                          type="date"
                          name="stage_date"
                          class="block w-full rounded-md border-0 py-2 text-primary shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-secondary text-sm"
                        />
                      </div>
                      
                      <!-- Delete button -->
                      <button
                        @click="deleteStage(index)"
                        :disabled="index == 0"
                        class="p-2 rounded-md"
                        :class="
                          index == 0
                            ? 'text-gray-400 cursor-not-allowed'
                            : 'text-red-600 hover:bg-red-50'
                        "
                      >
                        <TrashIcon class="h-6 w-6" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Desktop: Table layout -->
              <div class="hidden md:block">
                <div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
                  <table class="min-w-full divide-y divide-gray-300">
                    <thead>
                      <tr class="text-left text-base font-regular text-primary">
                        <th scope="col" class="py-3.5 pr-3 w-3/5">Descripción</th>
                        <th scope="col" class="px-3 py-3.5 w-1/5">Fecha</th>
                        <th scope="col" class="px-3 py-3.5 w-1/5">Acción</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200">
                      <tr v-for="(stage, index) in formData.stages" :key="index">
                        <!-- Stage description -->
                        <td
                          class="w-3/5 py-4 pr-3 text-sm font-medium text-primary sm:pl-0 break-words"
                        >
                          <input
                            v-model="stage.status"
                            type="text"
                            name="stage"
                            id="stage"
                            class="block w-full rounded-md border-0 py-1.5 text-primary shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-secondary sm:text-sm sm:leading-6"
                            required
                          />
                        </td>
                        <!-- Stage date -->
                        <td
                          class="whitespace-nowrap w-1/5 px-3 py-4 text-sm text-primary"
                        >
                          <input
                            v-model="stage.date"
                            type="date"
                            name="stage_date"
                            class="block w-full rounded-md border-0 py-1.5 text-primary shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-secondary sm:text-sm sm:leading-6"
                          />
                        </td>
                        <!-- Actions buttons -->
                        <td
                          class="whitespace-nowrap w-1/5 px-3 py-4 text-sm text-primary flex gap-2"
                        >
                          <!-- Delete stage -->
                          <button
                            @click="deleteStage(index)"
                            :disabled="index == 0"
                          >
                            <TrashIcon
                              class="mx-3 h-7 w-7"
                              :class="
                                index == 0
                                  ? 'text-gray-500 cursor-not-allowed'
                                  : 'text-red-600/80'
                              "
                            ></TrashIcon>
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
        <!-- Fourth row -->
        <div>
          <!-- Title and button add container -->
          <div class="flex items-center gap-3 font-medium">
            <p class="inline-block text-base text-primary">Documento</p>
            <button
              @click="addCaseFile"
              class="flex items-center px-2 py-1 rounded-md text-sm text-secondary bg-selected-background"
            >
              <PlusIcon class="h-5 w-5" />
              Nuevo
            </button>
          </div>
          <!-- Archive table -->
          <div class="qflow-root">
            <div class="-my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
              <div
                class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8"
              >
                <table class="min-w-full divide-y divide-gray-300">
                  <thead>
                    <tr class="text-left text-base font-regular text-primary">
                      <th scope="col" class="py-3.5 pr-3 w-3/5">
                        Documentos Cargados
                      </th>
                      <th scope="col" class="px-3 py-3.5 w-1/5">Acción</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-200">
                    <tr
                      v-for="(caseFile, index) in formData.caseFiles"
                      :key="index"
                    >
                      <!-- Stage descripction -->
                      <td
                        class="w-4/5 py-4 pr-3 text-sm font-medium text-primary sm:pl-0 break-words"
                      >
                        <!-- Show the current file name if available -->
                        <span v-if="typeof caseFile.file === 'string'">
                          <a
                            :href="caseFile.file"
                            target="_blank"
                            class="text-blue-500 hover:underline"
                          >
                            {{ caseFile.file.split("/").pop() }}
                          </a>
                        </span>
                        <span v-else-if="caseFile.file" class="text-gray-500">
                          Archivo cargado: {{ caseFile.file.name }}
                        </span>
                        <span v-else class="text-gray-500"
                          >Ningún archivo subido</span
                        >
                        <input
                          type="file"
                          :id="'file-' + index"
                          @change="handleFileUpload($event, index)"
                          class="block w-full rounded-md border-0 py-1.5 text-primary shadow-sm placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-secondary sm:text-sm sm:leading-6"
                          required
                        />
                      </td>
                      <!-- Actions buttons -->
                      <td
                        class="whitespace-nowrap w-1/5 py-4 text-sm text-primary flex gap-2"
                        :class="caseFile.file ? '' : 'px-3'"
                      >
                        <!-- See file -->
                        <button
                          v-if="caseFile.file"
                          @click="openFile(caseFile.file)"
                        >
                          <EyeIcon class="h-7 w-7 text-primary"></EyeIcon>
                        </button>
                        <!-- Delete file -->
                        <button @click="removeCaseFile(index)">
                          <TrashIcon
                            class="h-7 w-7 text-red-600/80"
                            :class="caseFile.file ? '' : 'mx-3'"
                          ></TrashIcon>
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
        <!-- Action buttons -->
        <div class="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-6 border-t border-gray-200">
          <!-- Save button -->
          <button
            @click="onSubmit"
            type="button"
            class="inline-flex items-center justify-center px-6 py-3 text-sm font-semibold rounded-lg shadow-sm transition-all duration-200"
            :class="
              !isSaveButtonEnabled
                ? 'bg-gray-100 text-gray-400 border-2 border-dashed border-gray-300 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
            "
            :disabled="!isSaveButtonEnabled"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            <span>Guardar Proceso</span>
          </button>
          
          <!-- Archive button - only visible when editing -->
          <button
            v-if="actionParam === 'edit' && programIdParam"
            @click="archiveProcess"
            type="button"
            class="inline-flex items-center justify-center px-6 py-3 text-sm font-semibold rounded-lg shadow-sm bg-amber-500 text-white hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 transition-all duration-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
            <span>Archivar Proceso</span>
          </button>
          
          <!-- Cancel button -->
          <button
            @click="cancelAction"
            type="button"
            class="inline-flex items-center justify-center px-6 py-3 text-sm font-semibold rounded-lg shadow-sm bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-all duration-200 sm:ml-auto"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span>Cancelar</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import Swal from "sweetalert2";
import { submitHandler } from "@/shared/submit_handler";
import { computed, onMounted, ref, reactive, watch } from "vue";
import { CheckIcon, ChevronDownIcon, PlusIcon } from "@heroicons/vue/20/solid";
import { TrashIcon, EyeIcon } from "@heroicons/vue/24/outline";
import { showNotification } from "@/shared/notification_message.js";
import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxLabel,
  ComboboxOption,
  ComboboxOptions,
} from "@headlessui/vue";
import { useRoute } from "vue-router";
import router from "@/router";
import { useCaseTypeStore } from "@/stores/legal/case_type";
import { useUserStore } from "@/stores/auth/user";
import { useAuthStore } from "@/stores/auth/auth";
import { useProcessStore } from "@/stores/process";
import userAvatar from "@/assets/images/user_avatar.jpg";

const route = useRoute();
const actionParam = ref("");
const programIdParam = ref("");

const processStore = useProcessStore();

const caseTypeStore = useCaseTypeStore();
const caseTypes = computed(() => caseTypeStore.caseTypes);

const userStore = useUserStore();
const clients = computed(() => userStore.clients);

const authStore = useAuthStore();

const formData = reactive({
  plaintiff: "",
  defendant: "",
  caseTypeId: "",
  subcase: "",
  ref: "",
  authority: "",
  clientId: "",
  lawyerId: "",
  stages: [
    {
      status: "",
      date: "",
    },
  ],
  caseFiles: [
    {
      file: null,
    },
  ],
});

// Variable to track if the form is modified
const isFormModified = ref(false);

let originalFormData = {};

onMounted(async () => {
  actionParam.value = route.params.action;
  programIdParam.value = route.params.process_id;

  if (programIdParam.value) {
    await processStore.init();
    const process = processStore.processById(programIdParam.value);
    if (process) {
      // Map the data from the process object to the formData reactive object
      assignProcessToFormData(process);
      originalFormData = JSON.parse(JSON.stringify(formData));
    }
  }

  // Load case types and users in parallel for faster form setup
  try {
    await Promise.all([
      caseTypeStore.init(),
      userStore.init(),
    ]);
  } catch (error) {
    console.error('Error initializing process form auxiliary data:', error);
  }
});

/**
 * Watch para detectar cambios en formData y compararlo con originalFormData.
 */
watch(
  formData,
  () => {
    // Comparamos formData con originalFormData
    if (!deepEqual(formData, originalFormData)) {
      isFormModified.value = true;
    } else {
      isFormModified.value = false;
    }
  },
  { deep: true }
);

watch(
  () => route.params.action,
  (newValue) => {
    if (newValue === "add") {
      resetForm();
    }
  }
);

/**
 * Función para comparar dos objetos profundamente.
 * @param {object} obj1 - El primer objeto a comparar.
 * @param {object} obj2 - El segundo objeto a comparar.
 * @returns {boolean} - True si los objetos son iguales, false de lo contrario.
 */
function deepEqual(obj1, obj2) {
  return JSON.stringify(obj1) === JSON.stringify(obj2);
}

// Computed property to enable/disable the save button
const isSaveButtonEnabled = computed(() => {
  return (
    formData.plaintiff.trim() &&
    formData.defendant.trim() &&
    formData.subcase.trim() &&
    formData.ref.trim() &&
    formData.authority.trim() &&
    formData.stages.every((stage) => stage.status.trim())
  );
});

/**
 * Function to map process data to formData.
 * @param {object} process - The process data to be assigned to formData.
 */
function assignProcessToFormData(process) {
  formData.processIdParam = process.id || "";
  formData.plaintiff = process.plaintiff || "";
  formData.defendant = process.defendant || "";
  selectedCaseType.value = process.case || "";
  formData.subcase = process.subcase || "";
  formData.ref = process.ref || "";
  formData.authority = process.authority || "";
  selectedClient.value = process.client || "";
  formData.lawyerId = process.lawyer.id || "";

  // Assign stages
  formData.stages = process.stages.map((stage) => ({
    status: stage.status || "",
    date: stage.date || "",
  }));

  // Assign case files
  formData.caseFiles = process.case_files.map((casefile) => ({
    file: casefile.file,
    id: casefile.id || "",
  }));

  // Mark form as modified after initial assignment
  isFormModified.value = false; // Reset to false after initial assignment
}

/**
 * Validates the form data before submission.
 *
 * This function checks the fields of the form data to ensure that they contain valid information.
 * It also verifies that each case file has a file attached; if any file is missing, it shows a warning
 * using a Swal (SweetAlert) modal and returns `false` to indicate that the validation failed.
 *
 * @function validateFormData
 * @returns {boolean} - Returns `true` if all fields are valid; otherwise, `false`.
 */
const validateFormData = () => {
  // Create a list of field names and their corresponding values
  const fields = {
    Accionante: formData.plaintiff,
    Accionado: formData.defendant,
    "Tipo de Caso": formData.caseTypeId,
    "Sub Caso": formData.subcase,
    Radicado: formData.ref,
    Autoridad: formData.authority,
    Cliente: formData.clientId,
    Abogado: formData.lawyerId,
  };

  // Check if any of the basic fields are empty or null
  for (const [fieldName, value] of Object.entries(fields)) {
    if (!value || String(value).trim() === "") {
      Swal.fire({
        title: "Campo requerido!",
        text: `El campo "${fieldName}" es obligatorio.`,
        icon: "warning",
      });
      return false;
    }
  }

  // Check each stage to ensure they have a valid status
  for (const [index, stage] of formData.stages.entries()) {
    if (!stage.status || stage.status.trim() === "") {
      Swal.fire({
        title: "Estado requerido!",
        text: `El estado de la etapa procesal en la fila ${
          index + 1
        } es obligatorio o debe ser eliminado si no es necesario.`,
        icon: "warning",
      });
      return false;
    }
  }

  for (const [index, caseFile] of formData.caseFiles.entries()) {
    if (!caseFile.file) {
      Swal.fire({
        title: "¡Archivo requerido!",
        text: `El archivo en la fila ${
          index + 1
        } es obligatorio o debe ser eliminado si no es necesario.`,
        icon: "warning",
      });
      return false;
    }
  }

  return true; // All fields are valid
};

/**
 * Handles the form submission process.
 *
 * This function updates form data with selected values, validates the form,
 * and if valid, calls the `submitHandler` function to save the data.
 * Upon successful submission, it navigates to the process list view.
 *
 * @async
 * @function onSubmit
 * @returns {void}
 */
const onSubmit = async () => {
  formData.caseTypeId = selectedCaseType.value?.id || "";
  formData.clientId = selectedClient.value?.id || "";
  formData.lawyerId = authStore.userAuth?.id || "";
  
  // Ensure process ID is set for updates
  if (actionParam.value === 'edit' && programIdParam.value) {
    console.log("Submitting with process ID:", programIdParam.value);
    formData.processIdParam = programIdParam.value;
  }

  if (validateFormData()) {
    await submitHandler(
      formData,
      "La información del proceso se ha guardado exitosamente!",
      !!programIdParam.value
    );
    if (actionParam.value == "add") {
      router.push({
        name: "process_list",
        params: { user_id: "", display: "" },
      });
    } else {
      router.back();
    }
  }
};

/**
 * Archives the current process by adding a "Fallo" stage and marking it as complete.
 * This function shows a confirmation dialog before proceeding with the archiving.
 * 
 * @async
 * @function archiveProcess
 * @returns {void}
 */
const archiveProcess = async () => {
  // Ask for confirmation before archiving
  const result = await Swal.fire({
    title: "¿Archivar este proceso?",
    text: "Esta acción marcará el proceso como archivado. ¿Desea continuar?",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#BD93F9",
    cancelButtonColor: "#d33",
    confirmButtonText: "Sí, archivar proceso",
    cancelButtonText: "Cancelar"
  });

  if (result.isConfirmed) {
    // Add a "Fallo" stage to indicate the process is closed/archived
    formData.stages.push({ status: "Fallo" });
    
    // Set the process ID for the update
    formData.processIdParam = programIdParam.value;
    formData.caseTypeId = selectedCaseType.value?.id || "";
    formData.clientId = selectedClient.value?.id || "";
    formData.lawyerId = authStore.userAuth?.id || "";
    
    // Use the archive flag to differentiate this from regular updates
    formData.isArchiving = true;

    if (validateFormData()) {
      await submitHandler(
        formData,
        "El proceso ha sido archivado exitosamente!",
        true // This is an update, not a new creation
      );
      router.back();
    }
  }
};

/**
 * Search query for filtering case types or clients.
 *
 * This reactive reference stores the search query entered by the user.
 *
 * @constant {Ref<string>}
 */
const query = ref("");

/**
 * The currently selected case type.
 *
 * This reactive reference stores the case type selected by the user.
 *
 * @constant {Ref<Object|null>}
 */
const selectedCaseType = ref(null);

/**
 * Filters the list of case types based on the search query.
 *
 * If the `query` is empty, all case types are returned.
 * Otherwise, it filters the case types to include only those whose type matches the query.
 *
 * @constant {ComputedRef<Array>}
 */
const filteredCaseTypes = computed(() =>
  query.value === ""
    ? caseTypes.value
    : caseTypes.value.filter((caseType) => {
        return caseType.type.toLowerCase().includes(query.value.toLowerCase());
      })
);

/**
 * The currently selected client.
 *
 * This reactive reference stores the client selected by the user.
 *
 * @constant {Ref<Object|null>}
 */
const selectedClient = ref(null);

/**
 * Filters the list of clients based on the search query.
 *
 * If the `query` is empty, all clients are returned.
 * Otherwise, it filters the clients to include only those whose `first_name`, `last_name`,
 * `identification`, or `email` match the query.
 *
 * @constant {ComputedRef<Array>}
 */
const filteredClients = computed(() =>
  query.value === ""
    ? clients.value
    : clients.value.filter((client) => {
        return ["first_name", "last_name", "identification", "email"].some(
          (field) =>
            client[field]?.toLowerCase().includes(query.value.toLowerCase())
        );
      })
);

/**
 * Adds a new stage to the form data.
 *
 * This function appends an empty stage object to the `formData.stages` array.
 *
 * @function addStage
 * @returns {void}
 */
const addStage = () => {
  const today = new Date().toISOString().slice(0, 10);
  formData.stages.push({ status: "", date: today });
};

/**
 * Deletes a stage from the form data by its index.
 *
 * This function removes a stage from the `formData.stages` array based on the provided index.
 *
 * @function deleteStage
 * @param {number} index - The index of the stage to be removed.
 * @returns {void}
 */
const deleteStage = (index) => {
  formData.stages.splice(index, 1);
};

/**
 * Handles the file input change event for case files.
 *
 * This function updates the `file` property of the case file at the specified index
 * with the selected file from the input event.
 *
 * @function handleFileUpload
 * @param {Event} event - The file input change event.
 * @param {number} index - The index of the case file to be updated.
 * @returns {void}
 */

const MAX_FILE_SIZE = 50 * 1024 * 1024; // Maximum file size of 50 MB
const ALLOWED_FILE_TYPES = ["png", "jpg", "jpeg", "pdf", "docx"]; // Allowed file extensions

const handleFileUpload = (event, index) => {
  const file = event.target.files[0]; // Get the selected file

  if (!file) return; // Exit if no file is selected

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    showNotification(
      `El archivo "${file.name}" excede el límite de 50 MB. Por favor, selecciona un archivo más pequeño.`,
      "warning"
    );
    return; // Skip further processing if the file is too large
  }

  // Validate file type
  const extension = file.name.split(".").pop().toLowerCase(); // Extract file extension
  if (!ALLOWED_FILE_TYPES.includes(extension)) {
    showNotification(
      "¡Ups! Ese tipo de archivo no es compatible. Asegúrate de que el archivo sea PDF, DOCX, JPG, PNG, JPEG.",
      "warning"
    );
    return; // Skip further processing if the file type is not allowed
  }

  // Assign the file to the corresponding index in the form data
  formData.caseFiles[index].file = file;
};

/**
 * Adds a new case file input group to the form data.
 *
 * This function appends a new case file object with an empty file property to the `formData.caseFiles` array.
 *
 * @function addCaseFile
 * @returns {void}
 */
const addCaseFile = () => {
  formData.caseFiles.push({ file: null, id: "" });
};

// Open file in new tab
function openFile(fileUrl) {
  window.open(fileUrl, "_blank");
}

/**
 * Removes a case file input group from the form data by its index.
 *
 * This function removes a case file from the `formData.caseFiles` array based on the provided index.
 *
 * @function removeCaseFile
 * @param {number} index - The index of the case file to be removed.
 * @returns {void}
 */
const removeCaseFile = (index) => {
  formData.caseFiles.splice(index, 1);
};

/**
 * Resets the form fields to their default empty values.
 */
const resetForm = () => {
  formData.plaintiff = ""; // Reset plaintiff field
  formData.defendant = ""; // Reset defendant field
  formData.caseTypeId = ""; // Reset case type ID
  formData.subcase = ""; // Reset subcase field
  formData.ref = ""; // Reset reference field
  formData.authority = ""; // Reset authority field
  formData.clientId = ""; // Reset client ID field
  formData.lawyerId = ""; // Reset lawyer ID field

  // Reset stages array with an empty status
  const today = new Date().toISOString().slice(0, 10);
  formData.stages = [
    {
      status: "",
      date: today,
    },
  ];

  // Reset caseFiles array with a null file field
  formData.caseFiles = [
    {
      file: null,
    },
  ];
};

/**
 * Function to handle the cancel action.
 * Navigates back to the previous page.
 */
const cancelAction = () => {
  router.back();
};
</script>
