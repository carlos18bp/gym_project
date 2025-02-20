<template>
  <div class="bg-white rounded-lg p-6 shadow-xl max-w-lg w-full">
    <!-- Close button -->
    <div class="flex justify-end">
      <button @click="closeModal()">
        <XMarkIcon class="size-6"></XMarkIcon>
      </button>
    </div>

    <!-- Email form -->
    <form @submit.prevent="handleSubmit">
      <!-- Email address input -->
      <div>
        <label
          for="email"
          class="block text-base font-medium leading-6 text-primary"
        >
          Correo electrónico <span class="text-red-500">*</span>
        </label>
        <div class="mt-2">
          <input
            v-model="formData.email"
            type="text"
            name="email"
            id="email"
            class="block w-full rounded-md border-0 py-1.5 text-primary shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-secondary sm:text-sm sm:leading-6"
            required
          />
        </div>
      </div>

      <!-- Files drag and drop -->
      <div class="mt-4">
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
          <!-- Drag and drop area -->
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
              PNG, JPG, PDF, DOCX de hasta 20MB
            </p>
          </div>
          <!-- List of files -->
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
                <XMarkIcon class="size-3 text-white" />
              </div>
              <component :is="file.icon" class="size-12 mx-auto" />
              <span class="text-center text-xs truncate w-20">{{
                file.name
              }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Send Button -->
      <button
        type="submit"
        class="mt-4 p-2.5 text-sm font-medium rounded-md flex gap-2"
        :class="
          !isSaveButtonEnabled
            ? 'bg-gray-200 text-secondary border-2 border-dashed border-secondary cursor-not-allowed bg-opacity-50'
            : 'bg-secondary text-white'
        "
        :disabled="!isSaveButtonEnabled"
      >
        <span>Enviar</span>
      </button>
    </form>
  </div>
</template>

<script setup>
import {
  XMarkIcon,
  CloudArrowUpIcon,
  PhotoIcon,
  DocumentIcon,
} from "@heroicons/vue/24/outline";
import { ref, reactive, computed, watch } from "vue";
import { showNotification } from "@/shared/notification_message.js";
import { useSendEmail } from "@/composables/useSendEmail";
import { get_request } from "@/stores/services/request_http";

import { jsPDF } from "jspdf";
import { parse } from "node-html-parser";

// Define Emits
const emit = defineEmits(["closeEmailModal"]);

// Import composable for emails
const { sendEmail } = useSendEmail();

// Email endpoint for backend
const EMAIL_ENDPOINT = "dynamic-documents/send_email_with_attachments/";

// PDF attachment reference
const pdfAttachment = ref(null);

// Props definition
const props = defineProps({
  /**
   * The document to be sent via email.
   * @type {Object}
   */
  emailDocument: {
    type: Object,
    required: true,
  },
});

/**
 * Resets the form values.
 */
const resetForm = () => {
  formData.email = ""; // Reset email field
  files.value = []; // Clear attached files
  pdfAttachment.value = null; // Clear the generated PDF
};

// Reactive data for form and file handling
const formData = reactive({
  email: "",
});
const files = ref([]);

// Maximum file size (20 MB)
const MAX_FILE_SIZE = 20 * 1024 * 1024;

/**
 * Handles file selection from the input.
 * @param {Event} event - The file input change event.
 */
const handleFileChange = (event) => {
  const uploadedFiles = Array.from(event.target.files);
  processFiles(uploadedFiles);
  event.target.value = null; // Clear input to avoid conflicts
};

/**
 * Handles file drop event via drag-and-drop.
 * @param {Event} event - The drag-and-drop event.
 */
const handleDrop = (event) => {
  const droppedFiles = Array.from(event.dataTransfer.files);
  processFiles(droppedFiles);
};

/**
 * Processes and validates uploaded files.
 * @param {Array<File>} fileList - List of files to be processed.
 */
const processFiles = (fileList) => {
  let totalSize = files.value.reduce((sum, file) => sum + file.file.size, 0);

  fileList.forEach((file) => {
    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      showNotification(
        `The file "${file.name}" exceeds the 20 MB limit.`,
        "warning"
      );
      return;
    }

    // Validate file type and assign icon/style
    const extension = file.name.split(".").pop().toLowerCase();
    let icon = "";
    let style = { general: "", xMark: "" };

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
        showNotification(
          "Unsupported file type. Only PDF, DOCX, JPG, and PNG are allowed.",
          "warning"
        );
        return;
    }

    // Add valid file to the list
    files.value.push({ name: file.name, icon, style, hover: false, file });
    totalSize += file.size;
  });
};

/**
 * Removes a file from the attached files list.
 * @param {number} index - Index of the file to remove.
 */
const removeFile = (index) => {
  files.value.splice(index, 1);
};

/**
 * Validates the email format.
 * @param {string} email - Email address to validate.
 * @returns {boolean} True if valid, false otherwise.
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Computed property to check if the email is valid
const isEmailValid = computed(() => isValidEmail(formData.email));

// Enable button if email is valid and has a value
const isSaveButtonEnabled = computed(() => isEmailValid.value);

/**
 * Downloads the PDF document from the backend using Axios.
 * @param {number} documentId - The ID of the document.
 * @returns {Promise<File|null>} The downloaded PDF file or null if failed.
 */
const generatePDFDocument = async (documentId) => {
  try {
    const response = await get_request(`dynamic-documents/${documentId}/download-pdf/`, "blob");

    if (!response || !response.data) {
      throw new Error("Invalid response from server");
    }

    return new File([response.data], `document_${documentId}.pdf`, { type: "application/pdf" });
  } catch (error) {
    console.error("Error downloading PDF:", error);
    showNotification("No se pudo descargar el documento PDF.", "error");
    return null;
  }
};

// Watch for changes in `emailDocument` and generate a PDF when available
watch(
  () => props.emailDocument,
  (newDoc) => {
    if (newDoc && Object.keys(newDoc).length > 0 && newDoc.id) {
      generatePDFDocument(newDoc.id);
    }
  },
  { immediate: true }
);

/**
 * Handles form submission and sends the email.
 */
 const handleSubmit = async () => {
  try {
    // Download the PDF from the backend.
    if (props.emailDocument.id) {
      const pdfFile = await generatePDFDocument(props.emailDocument.id);
      if (pdfFile) {
        files.value.push({
          name: pdfFile.name,
          file: pdfFile,
          icon: DocumentIcon,
          style: {
            general: "border-blue-600/20 text-blue-600/60",
            xMark: "bg-blue-600/60",
          },
          hover: false,
        });
      }
    }

    // Extract the attached files
    const attachmentFiles = files.value.map((file) => file.file);

    // Send the email with the PDF and other attachments
    await sendEmail(
      EMAIL_ENDPOINT,
      formData.email,
      props.emailDocument.title,
      "Attached is the requested document along with additional attachments.",
      attachmentFiles,
      { documentId: props.emailDocument.id }
    );
  } catch (error) {
    console.error("Error sending the email:", error);
  } finally {
    // Emit event to close the modal
    closeModal();
  }
};

/**
 * Closes the modal and resets the form.
 */
const closeModal = () => {
  resetForm();
  emit("closeEmailModal");
};
</script>
