<template>
  <!-- Main content -->
  <div class="pb-10 px-4 sm:px-6 lg:px-8 lg:pt-10">
    <!--Company's content-->
    <div class="w-full p-5 rounded-lg border-2 border-yellow-300 bg-yellow-300/30 space-y-3">
      <!--Fundamental principles-->
      <div class="space-y-3">
        <!-- Title -->
        <div>
          <h1 class="text-primary text-xl font-semibold">
            Nuestros Principios Fundamentales
          </h1>
        </div>
        <!-- Content -->
        <div class="space-y-3">
          <!-- First principle -->
          <div class="space-y-1.5">
            <div class="flex items-center gap-1.5 text-primary text-lg font-semibold">
              <TrophyIcon class="size-4"></TrophyIcon>
              <h2>Tranquilidad</h2>
            </div>
            <p class="text-primary text-md font-regular">
              La tranquilidad es un pilar fundamental en nuestra firma. Nos esforzamos por garantizar a nuestros clientes y colaboradores un ambiente donde puedan tomar decisiones con calma y claridad, siempre respaldados por el conocimiento jurídico y nuestra experiencia. Con cada caso y en cada interacción, trabajamos para que todos sientan la certeza de estar en manos confiables y competentes.
            </p>
          </div>
          <!-- Second principle -->
          <div class="space-y-1.5">
            <div class="flex items-center gap-1.5 text-primary text-lg font-semibold">
              <TrophyIcon class="size-4"></TrophyIcon>
              <h2>Seguridad</h2>
            </div>
            <p class="text-primary text-md font-regular">
              En nuestra empresa, la seguridad no solo se trata de proteger la información y los datos de nuestros clientes, sino también de brindarles confianza absoluta en nuestros procesos. Cada estrategia legal que diseñamos y cada acción que ejecutamos están pensadas para ofrecer soluciones sólidas, garantizando que los intereses de quienes confían en nosotros estén siempre protegidos.
            </p>
          </div>
          <!-- Third principle -->
          <div class="space-y-1.5">
            <div class="flex items-center gap-1.5 text-primary text-lg font-semibold">
              <TrophyIcon class="size-4"></TrophyIcon>
              <h2>Confianza</h2>
            </div>
            <p class="text-primary text-md font-regular">
              La confianza es el lazo que une a nuestra firma con sus clientes y colaboradores. Se construye día a día mediante un trabajo transparente, ético y profesional. Es nuestro compromiso mantener relaciones basadas en el respeto y la integridad, donde cada persona sienta que puede contar con nosotros como un aliado en sus objetivos legales y personales.
            </p>
          </div>
        </div>
      </div>
      <!-- Resources and tools of G&M -->
      <div class="space-y-3">
        <!-- Title -->
        <div>
          <h1 class="text-primary text-xl font-semibold">
            Recursos y Herramientas de G&M Consultores Jurídicos
          </h1>
        </div>
        <!-- Content -->
        <div class="space-y-1.5">
          <!-- Text -->
          <div>
            <p class="text-primary text-md font-regular">
              Accede a los siguientes recursos para conocer los avances, procesos y herramientas clave que respaldan nuestro crecimiento y compromiso continuo:
            </p>
          </div>
          <!-- Links -->
          <div class="flex flex-wrap">
            <div class="grid grid-rows-4 grid-flow-col gap-y-1.5 gap-x-4">
              <div v-for="link in legalLinks" class="row-span-1 flex items-center gap-0.5 text-primary hover:text-yellow-400">
                <CheckBadgeIcon class="size-4"></CheckBadgeIcon>
                <a 
                  :href="link.url" 
                  target="_blank" 
                  class="text-md font-regular hover:font-italic hover:underline hover:decoration-2"
                >
                  {{ link.name }}
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <!-- Facturation form -->
  <div class="px-4 pb-10 sm:px-6 lg:px-8">
    <!--Company's content-->
    <div class="w-full p-5 rounded-lg border-2 border-stroke bg-terciary space-y-3">
      <!-- Title -->
      <div>
        <h1 class="text-primary text-xl font-semibold">
          Presentar Informe
        </h1>
      </div>
      <!-- Form -->
      <form @submit.prevent="submitHandler()">
        <div class="mt-4 space-y-3">
          <!-- First row -->
          <div class="grid md:grid-cols-2 xl:grid-cols-4 gap-3">
            <!-- Contract's number form -->
            <div>
              <label
                for="contract-number"
                class="block text-base font-medium leading-6 text-primary"
              >
                No. Contrato
                <span class="text-red-500">*</span>
              </label>
              <div class="mt-2">
                <input
                  v-model="formData.contract"
                  type="text"
                  name="contract-number"
                  id="contract-number"
                  class="block w-full rounded-md border-0 py-1.5 text-primary shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-secondary sm:text-sm sm:leading-6"
                  required
                />
              </div>
            </div>
            <!-- Period Report Initial Date Form -->
            <div>
              <label
                for="initial-report-period"
                class="block text-base font-medium leading-6 text-primary"
              >
                Fecha Inicial
                <span class="text-red-500">*</span>
              </label>
              <div class="mt-2">
                <input
                  v-model="formData.initialDate"
                  type="date"
                  name="initial-report-period"
                  id="initial-report-period"
                  class="block w-full rounded-md border-0 py-1.5 text-primary shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-secondary sm:text-sm sm:leading-6"
                  required
                />
              </div>
            </div>
            <!-- Period Report Final Date Form -->
            <div>
              <label
                for="final-report-period"
                class="block text-base font-medium leading-6 text-primary"
              >
                Fecha Final
                <span class="text-red-500">*</span>
              </label>
              <div class="mt-2">
                <input
                  v-model="formData.endDate"
                  type="date"
                  name="final-report-period"
                  id="final-report-period"
                  placeholder="Fecha inicial"
                  class="block w-full rounded-md border-0 py-1.5 text-primary shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-secondary sm:text-sm sm:leading-6"
                  required
                />
              </div>
            </div>
            <!-- Payment concept -->
            <div>
              <label
                for="payment-concept"
                class="block text-base font-medium leading-6 text-primary"
              >
                Concepto de Pago
                <span class="text-red-500">*</span>
              </label>
              <div class="mt-2">
                <input
                  v-model="formData.paymentConcept"
                  type="text"
                  name="payment-concept"
                  id="payment-concept"
                  class="block w-full rounded-md border-0 py-1.5 text-primary shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-secondary sm:text-sm sm:leading-6"
                  required
                />
              </div>
            </div>
            <!-- Value to charge -->
            <div>
              <label
                for="payment-concept"
                class="block text-base font-medium leading-6 text-primary"
              >
                Valor a Cobrar y/o Facturar
                <span class="text-red-500">*</span>
              </label>
              <div class="mt-2">
                <div
                  class="flex items-center rounded-md bg-white px-3 outline outline-1 -outline-offset-1 outline-gray-300 focus-within:outline focus-within:outline-2  focus-within:outline-secondary"
                >
                  <div
                    class="shrink-0 select-none text-base text-gray-500 sm:text-sm"
                  >
                    $
                  </div>
                  <input
                    v-model="formData.paymentAmount"
                    type="text"
                    name="payment-concept"
                    id="payment-concept"
                    class="block min-w-0 grow py-1.5 pl-1 pr-3 text-base text-primary border-none placeholder:text-gray-400 focus-within:outline-none focus-within:border-none focus-within:ring-0 sm:text-sm"
                    placeholder="0.00"
                    aria-describedby="payment-currency"
                    required
                  />
                  <div
                    id="payment-currency"
                    class="shrink-0 select-none text-base text-gray-500 sm:text-sm"
                  >
                    COP
                  </div>
                </div>
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
                  <CloudArrowUpIcon class="mx-auto size-12 text-gray-300" aria-hidden="true" />
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
                  <p class="text-xs/5 text-gray-600">PNG, JPG, PDF, DOCX de hasta 20MB</p>
                </div>
                <!-- list of files -->
                <div v-else class="w-full flex flex-wrap gap-3">
                  <div 
                    v-for="(file, index) in files"
                    :key="index"
                    class="relative p-4 grid rounded-md bg-white border-2"
                    :class="file.style.general"
                    @mouseenter="file.hover = true;"
                    @mouseleave="file.hover = false;"
                  >
                    <div v-show="file.hover" class="absolute p-0.5 mt-2 ml-2 rounded-full" :class="file.style.xMark" @click="removeFile(index)">
                      <XMarkIcon class="size-3 text-white"></XMarkIcon>
                    </div>
                    <component :is="file.icon" class="size-12 mx-auto"></component>
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
            </div>
          </div>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import SearchBarAndFilterBy from "@/components/layouts/SearchBarAndFilterBy.vue";
import { 
  TrophyIcon,
  CheckBadgeIcon, 
  PhotoIcon, 
  DocumentIcon, 
  XMarkIcon, 
  CloudArrowUpIcon 
} from '@heroicons/vue/24/outline';
import { useIntranetGymStore } from "@/stores/intranet_gym";
import { 
  onMounted, 
  ref, 
  computed, 
  reactive 
} from "vue";
import { showNotification } from "@/shared/notification_message.js";
import { showLoading, hideLoading } from '@/shared/loading_message.js';
import { useRouter } from 'vue-router';

/**
 * Router of app used for redirect the user.
 */
 const router = useRouter();

// import the store
const intranetGymStore = useIntranetGymStore();
const legalLinks = ref([]);

// Call to init function for fetch the links
onMounted(async () => {
  await intranetGymStore.init();
  legalLinks.value = intranetGymStore.legalLinks;
});

/**
 * Reactive reference for managing uploaded files.
 */
 const files = ref([]);

 const formData = reactive({
  contract: null,
  initialDate: null,
  endDate: null,
  paymentConcept: "",
  paymentAmount: null,
  files: [],
 });

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
 * Maximum allowed file size in bytes (20 MB).
 */
 const MAX_FILE_SIZE = 20 * 1024 * 1024;

/**
 * Maximum allowed total file size in bytes (20 MB).
 */
const MAX_TOTAL_SIZE = 20 * 1024 * 1024;

/**
 * Processes the uploaded files by validating their size and extension,
 * assigning icons and styles, and adding them to the file list.
 */
const processFiles = (fileList) => {
  let totalSize = files.value.reduce((sum, file) => sum + file.file.size, 0);

  fileList.forEach((file) => {
    // Validate individual file size
    if (file.size > MAX_FILE_SIZE) {
      showNotification(
        `El archivo "${file.name}" excede el límite de 20 MB. Por favor, selecciona un archivo más pequeño.`,
        "warning"
      );
      return; // Skip processing if the file is too large
    }

    // Validate total file size
    if (totalSize + file.size > MAX_TOTAL_SIZE) {
      showNotification(
        `No se pueden agregar más archivos porque el tamaño total excede el límite de 20 MB.`,
        "warning"
      );
      return; // Skip processing if adding this file would exceed the total size limit
    }

    const extension = file.name.split(".").pop().toLowerCase();
    let icon = "";
    let style = {
      general: "", // General style for the file container
      xMark: "",  // Style for the remove button
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

    // Update the total size after adding the file
    totalSize += file.size;
  });
};


/**
 * Removes a file from the list based on its index.
 */
const removeFile = (index) => {
  files.value.splice(index, 1);
};

/**
 * Computes whether the save button should be enabled based on form validation.
 */
 const isSaveButtonEnabled = computed(() => {
  return (
    formData.contract !== null &&
    formData.initialDate !== null &&
    formData.endDate !== null &&
    formData.paymentConcept.trim() &&
    formData.paymentAmount !== null &&
    !isNaN(formData.paymentAmount)
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
    const status = await intranetGymStore.createReportRequest(formData);
    hideLoading(); // Hide the loading spinner

    if (status === 201) {
      showNotification("¡Solicitud creada exitosamente!", "success");
      resetForm(); // Reset the form after successful submission
      router.push({ name: 'process_list' });
    } else {
      showNotification("Error al crear la solicitud. Intenta nuevamente.", "error");
    }
  } catch (error) {
    console.error("Error al enviar la solicitud:", error);
    showNotification("Hubo un error inesperado. Por favor, inténtalo más tarde.", "error");
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

</script>