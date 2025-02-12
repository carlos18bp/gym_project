<template>
  <div class="p-6">
    <!-- Using the SearchBarAndFilterBy component -->
    <SearchBarAndFilterBy @update:searchQuery="searchQuery = $event">
      <slot></slot>
    </SearchBarAndFilterBy>
  </div>
  <!-- Content -->
  <div class="pb-10 px-4 sm:px-6 lg:px-8">
    <div class="w-full p-5 rounded-lg border-2 border-stroke bg-terciary">
      <!-- Title -->
      <div>
        <h1 class="text-primary text-xl font-semibold">Presentar Solicitud</h1>
      </div>
      <!--Form-->
      <form @submit.prevent="submitHandler()">
        <div class="mt-4 space-y-3">
          <!-- First row -->
          <div class="grid md:grid-cols-2 xl:grid-cols-4 gap-3">
            <!--Name form -->
            <div>
              <label
                for="name"
                class="block text-base font-medium leading-6 text-primary"
              >
                Nombre
                <span class="text-red-500">*</span>
              </label>
              <div class="mt-2">
                <input
                  v-model="formData.firstName"
                  type="text"
                  name="name"
                  id="name"
                  class="block w-full rounded-md border-0 py-1.5 text-primary shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-secondary sm:text-sm sm:leading-6"
                  required
                />
              </div>
            </div>
            <!--Last Name form -->
            <div>
              <label
                for="last_name"
                class="block text-base font-medium leading-6 text-primary"
              >
                Apellido
                <span class="text-red-500">*</span>
              </label>
              <div class="mt-2">
                <input
                  v-model="formData.lastName"
                  type="text"
                  name="last_name"
                  id="last_name"
                  class="block w-full rounded-md border-0 py-1.5 text-primary shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-secondary sm:text-sm sm:leading-6"
                  required
                />
              </div>
            </div>
            <!--Email form -->
            <div>
              <label
                for="email"
                class="block text-base font-medium leading-6 text-primary"
              >
                Correo electronico
                <span class="text-red-500">*</span>
              </label>
              <div class="mt-2">
                <input
                  v-model="formData.email"
                  type="email"
                  name="email"
                  id="email"
                  class="block w-full rounded-md border-0 py-1.5 text-primary shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-secondary sm:text-sm sm:leading-6"
                  required
                />
                <p
                  v-if="formData.email && !isValidEmail(formData.email)"
                  class="absolute font-regular text-red-500 text-sm"
                >
                  Por favor, introduce un correo válido.
                </p>
              </div>
            </div>
            <!-- Type request form -->
            <div>
              <Combobox
                as="div"
                v-model="formData.requestTypeId"
                @update:modelValue="query = ''"
              >
                <ComboboxLabel
                  class="block text-base font-medium leading-6 text-primary"
                >
                  Tipo de solicitud
                  <span class="text-red-500">*</span>
                </ComboboxLabel>
                <div class="relative mt-2">
                  <ComboboxInput
                    class="w-full rounded-md border-0 bg-white py-1.5 pl-3 pr-10 text-primary shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-secondary sm:text-sm sm:leading-6"
                    @change="query = $event.target.value"
                    @blur="query = ''"
                    :display-value="
                      (requestType) =>
                        requestType?.name ? `${requestType?.name}` : ''
                    "
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
                    v-if="legalRequestTypes"
                    class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm"
                  >
                    <ComboboxOption
                      v-for="requestType in legalRequestTypes"
                      :key="requestType.id"
                      :value="requestType"
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
                          :class="[
                            'block truncate',
                            selected && 'font-semibold',
                          ]"
                        >
                          {{ requestType.name }}
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
            <!-- Type discipline form -->
            <div>
              <Combobox
                as="div"
                v-model="formData.disciplineId"
                @update:modelValue="query = ''"
              >
                <ComboboxLabel
                  class="block text-base font-medium leading-6 text-primary"
                >
                  Especialidad
                  <span class="text-red-500">*</span>
                </ComboboxLabel>
                <div class="relative mt-2">
                  <ComboboxInput
                    class="w-full rounded-md border-0 bg-white py-1.5 pl-3 pr-10 text-primary shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-secondary sm:text-sm sm:leading-6"
                    @change="query = $event.target.value"
                    @blur="query = ''"
                    :display-value="
                      (legalDiscipline) =>
                        legalDiscipline?.name ? `${legalDiscipline?.name}` : ''
                    "
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
                    v-if="legalDisciplines"
                    class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm"
                  >
                    <ComboboxOption
                      v-for="legalDiscipline in legalDisciplines"
                      :key="legalDiscipline.id"
                      :value="legalDiscipline"
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
                          :class="[
                            'block truncate',
                            selected && 'font-semibold',
                          ]"
                        >
                          {{ legalDiscipline.name }}
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
            <!-- Description Form -->
            <div class="col-span-full">
              <label
                for="description"
                class="block text-base font-medium leading-6 text-primary"
              >
                Descripción
                <span class="text-red-500">*</span>
              </label>
              <div class="mt-2">
                <textarea
                  v-model="formData.description"
                  rows="4"
                  name="comment"
                  id="comment"
                  class="block w-full rounded-md border-0 py-1.5 text-primary shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-secondary sm:text-sm sm:leading-6"
                  required
                />
              </div>
            </div>
            <!-- Files Form -->
            <div class="col-span-full">
              <label
                for="files"
                class="block text-base font-medium leading-6 text-primary"
              >
                Anexos
              </label>
              <div
                class="mt-2 flex justify-center rounded-lg border border-dashed border-gray-900/25 bg-white px-6 py-10"
                @dragover.prevent
                @drop.prevent="handleDrop"
              >
                <!-- Drag and drop -->
                <div v-if="files.length < 1" class="text-center">
                  <CloudArrowUpIcon
                    class="mx-auto size-12 text-gray-300"
                    aria-hidden="true"
                  />
                  <div class="mt-4 flex text-sm/6 text-gray-600">
                    <label
                      for="file-upload"
                      class="relative cursor-pointer rounded-md bg-white font-semibold text-indigo-600 focus-within:outline-none focus-within:ring-2 focus-within:ring-indigo-600 focus-within:ring-offset-2 hover:text-indigo-500"
                    >
                      <span>Sube un archivo</span>
                      <input
                        id="file-upload"
                        name="file-upload"
                        type="file"
                        class="sr-only"
                        @change="handleFileChange"
                      />
                    </label>
                    <p class="pl-1">o arrastra y suelta</p>
                  </div>
                  <p class="text-xs/5 text-gray-600">
                    PNG, JPG, PDF, DOCX de hasta 30MB
                  </p>
                </div>
                <!-- list of files -->
                <div v-else class="w-full flex flex-wrap gap-3">
                  <div
                    v-for="(file, index) in files"
                    :key="index"
                    class="relative p-4 grid rounded-md bg-white border-2"
                    :class="file.style.general"
                    @mouseenter="file.hover = true"
                    @mouseleave="file.hover = false"
                  >
                    <div
                      v-show="file.hover"
                      class="absolute p-0.5 mt-2 ml-2 rounded-full"
                      :class="file.style.xMark"
                      @click="removeFile(index)"
                    >
                      <XMarkIcon class="size-3 text-white"></XMarkIcon>
                    </div>
                    <component
                      :is="file.icon"
                      class="size-12 mx-auto"
                    ></component>
                    <span class="text-center text-xs truncate w-20">
                      {{ file.name }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <!-- Action buttons -->
            <div class="flex gap-3 span-col-full">
              <!-- Save Button -->
              <button
                type="submit"
                class="p-2.5 text-sm font-medium rounded-md flex gap-2"
                :class="
                  !isSaveButtonEnabled
                    ? 'bg-gray-200 text-secondary border-2 border-dashed border-secondary cursor-not-allowed bg-opacity-50'
                    : 'bg-secondary text-white'
                "
                :disabled="!isSaveButtonEnabled"
              >
                <span>Guardar</span>
              </button>
              <!-- Cancel Button -->
              <RouterLink
                :to="{ name: 'process_list' }"
                type="button"
                class="p-2.5 text-sm font-medium rounded-md flex gap-2 bg-red-600/80 text-white cursor-pointer"
              >
                <span>Cancelar</span>
              </RouterLink>
            </div>
          </div>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
/**
 * Imports necessary components and utilities from external libraries and modules.
 */
import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxLabel,
  ComboboxOption,
  ComboboxOptions,
} from "@headlessui/vue";
import {
  CheckIcon,
  ChevronDownIcon,
  PhotoIcon,
  XMarkIcon,
  CloudArrowUpIcon,
} from "@heroicons/vue/20/solid";
import { DocumentIcon } from "@heroicons/vue/24/outline";
import { ref, reactive, onMounted, computed } from "vue";
import { useLegalRequestStore } from "@/stores/legal_request.js";
import { showNotification } from "@/shared/notification_message.js";
import { RouterLink } from "vue-router";
import { showLoading, hideLoading } from "@/shared/loading_message.js";
import { useRouter } from "vue-router";

/**
 * Router of app used for redirect the user.
 */
const router = useRouter();

/**
 * Legal request store instance used for managing state and API calls.
 */
const legalRequestStore = useLegalRequestStore();

/**
 * Reactive references for storing data related to legal request types, disciplines, form data, and file uploads.
 */
const legalRequestTypes = ref([]); // List of legal request types
const legalDisciplines = ref([]); // List of legal disciplines
const formData = reactive({
  firstName: "", // User's first name
  lastName: "", // User's last name
  email: "", // User's email address
  requestTypeId: "", // Selected legal request type ID
  disciplineId: "", // Selected discipline ID
  description: "", // Request description
  files: [], // Files associated with the legal request
});
const query = ref(null); // Query for filtering options in the dropdowns

/**
 * Reactive reference for managing uploaded files.
 */
const files = ref([]);

/**
 * Handles file selection via input element and processes the files.
 * Resets the input element to avoid conflicts with multiple uploads.
 */
const handleFileChange = (event) => {
  const uploadedFiles = Array.from(event.target.files);
  processFiles(uploadedFiles);

  // Clear the input to prevent conflicts
  event.target.value = null;
};

/**
 * Handles file dropping via drag-and-drop and processes the files.
 * Prevents default browser behavior.
 */
const handleDrop = (event) => {
  event.preventDefault(); // Avoid default browser behavior
  const droppedFiles = Array.from(event.dataTransfer.files);
  processFiles(droppedFiles);
};

/**
 * Maximum allowed file size in bytes (30 MB).
 */
const MAX_FILE_SIZE = 30 * 1024 * 1024;

/**
 * Processes the uploaded files by validating their size and extension,
 * assigning icons and styles, and adding them to the file list.
 */
const processFiles = (fileList) => {
  fileList.forEach((file) => {
    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      showNotification(
        `El archivo "${file.name}" excede el límite de 30 MB. Por favor, selecciona un archivo más pequeño.`,
        "warning"
      );
      return; // Skip processing if the file is too large
    }

    const extension = file.name.split(".").pop().toLowerCase();
    let icon = "";
    let style = {
      general: "", // General style for the file container
      xMark: "", // Style for the remove button
    };

    // Assign appropriate icon and style based on the file extension
    switch (extension) {
      case "png":
      case "jpg":
      case "jpeg":
        icon = PhotoIcon;
        style.general = "border-gray-200 text-gray-400";
        style.xMark = "bg-gray-400";
        break;
      case "pdf":
        icon = DocumentIcon;
        style.general = "border-red-600/20 text-red-600/60";
        style.xMark = "bg-red-600/60";
        break;
      case "docx":
        icon = DocumentIcon;
        style.general = "border-blue-600/20 text-blue-600/60";
        style.xMark = "bg-blue-600/60";
        break;
      default:
        // Notify the user if the file type is unsupported
        showNotification(
          "¡Ups! Ese tipo de archivo no es compatible. Asegúrate de que el archivo sea PDF, DOCX, JPG, PNG, JPEG.",
          "warning"
        );
        return;
    }

    // Add the file to the list if it passes validation
    files.value.push({
      name: file.name,
      icon: icon,
      style: style,
      hover: false,
      file: file, // Store the raw file for further processing
    });
  });
};

/**
 * Removes a file from the list based on its index.
 */
const removeFile = (index) => {
  files.value.splice(index, 1);
};

/**
 * Validates the email format using a regular expression.
 * @param {string} email - The email address to validate.
 * @returns {boolean} - True if the email is valid, false otherwise.
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // Email validation regex
  return emailRegex.test(email);
};

/**
 * Computes whether the save button should be enabled based on form validation.
 */
const isSaveButtonEnabled = computed(() => {
  return (
    formData.firstName.trim() &&
    formData.lastName.trim() &&
    formData.email.trim() &&
    isValidEmail(formData.email) && // Validate email format
    formData.requestTypeId &&
    formData.disciplineId &&
    formData.description.trim()
  );
});

/**
 * Handles form submission by validating and sending data to the store.
 * Shows a loading spinner during the process.
 */
const submitHandler = async () => {
  showLoading(); // Show the loading spinner

  // Extract only the raw files from the file list
  const extractedFiles = files.value.map((fileObj) => fileObj.file);

  // Add the extracted files to the form data
  formData.files = extractedFiles;

  try {
    // Submit the form data to the store
    const status = await legalRequestStore.createLegalRequest(formData);
    hideLoading(); // Hide the loading spinner

    if (status === 201) {
      showNotification("¡Solicitud creada exitosamente!", "success");
      resetForm(); // Reset the form after successful submission
      router.push({ name: "process_list" });
    } else {
      showNotification(
        "Error al crear la solicitud. Intenta nuevamente.",
        "error"
      );
    }
  } catch (error) {
    console.error("Error al enviar la solicitud:", error);
    showNotification(
      "Hubo un error inesperado. Por favor, inténtalo más tarde.",
      "error"
    );
  }
};

/**
 * Resets the form data and clears the file list after submission.
 */
const resetForm = () => {
  formData.firstName = "";
  formData.lastName = "";
  formData.email = "";
  formData.requestTypeId = "";
  formData.disciplineId = "";
  formData.description = "";
  files.value = []; // Clear the file list
};

/**
 * Lifecycle hook for initializing the store and loading legal request types and disciplines.
 */
onMounted(async () => {
  await legalRequestStore.init();
  legalRequestTypes.value = legalRequestStore.legalRequestTypes;
  legalDisciplines.value = legalRequestStore.legalDisciplines;
});
</script>
