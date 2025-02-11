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
        <label for="email" class="block text-base font-medium leading-6 text-primary">
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
        <label for="files" class="block text-base font-medium leading-6 text-primary">
          Anexos
        </label>
        <div
          class="mt-2 flex justify-center rounded-lg border border-dashed border-gray-900/25 bg-white px-6 py-10"
          @dragover.prevent
          @drop.prevent="handleDrop"
        >
          <!-- Drag and drop area -->
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
              <span class="text-center text-xs truncate w-20">{{ file.name }}</span>
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
import { XMarkIcon, CloudArrowUpIcon, PhotoIcon, DocumentIcon } from '@heroicons/vue/24/outline';
import { ref, reactive, computed, watch } from 'vue';
import { showNotification } from '@/shared/notification_message.js';
import { useSendEmail } from '@/composables/useSendEmail';
import { jsPDF } from 'jspdf';
import { parse } from 'node-html-parser';

// Define Emits
const emit = defineEmits(['closeEmailModal']);

// Import composable for emails
const { sendEmail } = useSendEmail();

// Email endpoint for backend
const EMAIL_ENDPOINT = 'dynamic-documents/send_email_with_attachments/';

// pdf generated
const pdfAttachment = ref(null);

// Props definition
const props = defineProps({
  emailDocument: {
    type: Object,
    required: true,
  },
});

/**
 * Restablece los valores del formulario.
 */
 const resetForm = () => {
  formData.email = '';      // Restablecer el email
  files.value = [];         // Limpiar los archivos adjuntos
  pdfAttachment.value = null;  // Limpiar el PDF generado
};

// Reactive data for form and files
const formData = reactive({
  email: '',
});
const files = ref([]);

// Maximum file size (20 MB)
const MAX_FILE_SIZE = 20 * 1024 * 1024;

// Handle file selection from input
const handleFileChange = (event) => {
  const uploadedFiles = Array.from(event.target.files);
  processFiles(uploadedFiles);
  event.target.value = null; // Clear input to avoid conflicts
};

// Handle file dropping via drag-and-drop
const handleDrop = (event) => {
  const droppedFiles = Array.from(event.dataTransfer.files);
  processFiles(droppedFiles);
};

// Process and validate files
const processFiles = (fileList) => {
  let totalSize = files.value.reduce((sum, file) => sum + file.file.size, 0);

  fileList.forEach((file) => {
    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      showNotification(`El archivo "${file.name}" excede el límite de 20 MB.`, 'warning');
      return;
    }

    // Validate file type and assign icon/style
    const extension = file.name.split('.').pop().toLowerCase();
    let icon = '';
    let style = { general: '', xMark: '' };

    switch (extension) {
      case 'png':
      case 'jpg':
      case 'jpeg':
        icon = PhotoIcon;
        style.general = 'border-gray-200 text-gray-400';
        style.xMark = 'bg-gray-400';
        break;
      case 'pdf':
        icon = DocumentIcon;
        style.general = 'border-red-600/20 text-red-600/60';
        style.xMark = 'bg-red-600/60';
        break;
      case 'docx':
        icon = DocumentIcon;
        style.general = 'border-blue-600/20 text-blue-600/60';
        style.xMark = 'bg-blue-600/60';
        break;
      default:
        showNotification('Tipo de archivo no compatible. Solo se permiten PDF, DOCX, JPG, PNG.', 'warning');
        return;
    }

    // Add valid file to the list
    files.value.push({ name: file.name, icon, style, hover: false, file });
    totalSize += file.size;
  });
};

// Remove a file from the list
const removeFile = (index) => {
  files.value.splice(index, 1);
};

// Function to validate email format
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Computed property to check if the email is valid
const isEmailValid = computed(() => isValidEmail(formData.email));

// Enable button if email is valid and has a value
const isSaveButtonEnabled = computed(() => isEmailValid.value);

/**
 * Generate a PDF from the document and store it as an attachment.
 * @param {object} doc - The document to convert to PDF.
 */
 const generatePDFDocument = (doc) => {
  try {
    // Reemplazar variables en el contenido del documento
    let processedContent = doc.content;
    doc.variables.forEach((variable) => {
      const regex = new RegExp(`{{\\s*${variable.name_en}\\s*}}`, 'g');
      processedContent = processedContent.replace(regex, variable.value || '');
    });

    // Parsear el contenido HTML
    const root = parse(processedContent);
    const plainTextContent = root.innerText;  // Convertir HTML a texto plano

    // Crear el PDF
    const pdf = new jsPDF();
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);

    // Ajustar el contenido al ancho del PDF
    const pageWidth = pdf.internal.pageSize.getWidth() - 20;
    const textLines = pdf.splitTextToSize(plainTextContent, pageWidth);

    // Añadir texto al PDF
    pdf.text(textLines, 10, 10);

    // Convertir el PDF a un Blob y almacenarlo
    const pdfBlob = pdf.output('blob');
    pdfAttachment.value = new File([pdfBlob], `${doc.title}.pdf`, { type: 'application/pdf' });

  } catch (error) {
    console.error('Error generando el PDF:', error);
  }
};

// Llamar a la función cuando el prop `emailDocument` esté disponible
watch(
  () => props.emailDocument,
  (newDoc) => {
    // Validar que `newDoc` no sea nulo y tenga contenido
    if (newDoc && Object.keys(newDoc).length > 0 && newDoc.id) {
      generatePDFDocument(newDoc);
    }
  },
  { immediate: true }
);


/**
 * Handle form submission and send the email.
 */
 const handleSubmit = async () => {
  try {
    // Agregar el PDF generado a los archivos adjuntos si existe
    if (pdfAttachment.value) {
      files.value.push({
        name: pdfAttachment.value.name,
        file: pdfAttachment.value,
        icon: DocumentIcon,
        style: {
          general: 'border-blue-600/20 text-blue-600/60',
          xMark: 'bg-blue-600/60',
        },
        hover: false,
      });
    }

    // Extraer los archivos desde la lista de objetos
    const attachmentFiles = files.value.map((file) => file.file);

    // Llamar al composable para enviar el correo
    await sendEmail(
      EMAIL_ENDPOINT,
      formData.email,
      props.emailDocument.title,
      'Adjunto el documento solicitado junto con anexos adicionales.',
      attachmentFiles,
      { documentId: props.emailDocument.id }
    );
  } catch (error) {
    console.error('Error al enviar el correo:', error);
  } finally {
    // Emitir el evento para cerrar el modal
    closeModal();
  }
};

const closeModal = () => {
  resetForm();
  emit('closeEmailModal');
}
</script>

