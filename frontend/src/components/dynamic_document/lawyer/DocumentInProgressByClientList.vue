<template>
  <div class="mt-8 flex flex-wrap gap-6">
    <!-- Document In Progress -->
    <div
      v-for="document in progressDocuments"
      :key="document.id"
      class="flex items-center gap-3 py-2 px-4 border rounded-xl border-stroke bg-white"
    >
      <PencilIcon class="size-6 text-secondary"></PencilIcon>
      <div class="grid gap-1">
        <span class="text-base font-medium">{{ document.title }}</span>
        <span class="text-sm font-regular text-gray-400">
          {{ getClientName(document.assigned_to) }}
        </span>
      </div>
      <Menu as="div" class="relative inline-block text-left">
        <div>
          <MenuButton class="flex items-center text-gray-400">
            <span class="sr-only">Open options</span>
            <EllipsisVerticalIcon class="size-6" aria-hidden="true" />
          </MenuButton>
        </div>

        <transition
          enter-active-class="transition ease-out duration-100"
          enter-from-class="transform opacity-0 scale-95"
          enter-to-class="transform opacity-100 scale-100"
          leave-active-class="transition ease-in duration-75"
          leave-from-class="transform opacity-100 scale-100"
          leave-to-class="transform opacity-0 scale-95"
        >
          <MenuItems
            class="absolute left-0 z-10 mt-2 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black/5"
          >
            <div class="py-1">
              <MenuItem v-for="option in documentEditingOptions" :key="option.label">
                <button
                  @click="handleOptionClick(option, document)"
                  class="block w-full text-left px-4 py-2 text-sm font-regular cursor-pointer hover:bg-gray-100 transition"
                >
                  {{ option.label }}
                </button>
              </MenuItem>
            </div>
          </MenuItems>
        </transition>
      </Menu>
    </div>
  </div>

  <!-- Document Preview Modal -->
  <ModalTransition v-show="showPreviewModal">
    <div class="bg-white p-6 rounded-lg shadow-xl max-w-2xl w-full">
      <div class="flex justify-between items-center">
        <h2 class="text-xl font-semibold">Previsualización del Documento: {{ previewDocumentTitle }}</h2>
        <button @click="closePreviewModal">
          <XMarkIcon class="size-6" />
        </button>
      </div>
      <div class="mt-4 overflow-auto max-h-96 text-primary">
        <div v-html="previewDocumentContent" class="prose"></div>
      </div>
    </div>
  </ModalTransition>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/vue";
import { PencilIcon, EllipsisVerticalIcon, XMarkIcon } from "@heroicons/vue/24/outline";
import { useDynamicDocumentStore } from "@/stores/dynamicDocument";
import { useUserStore } from "@/stores/user";
import ModalTransition from "@/components/layouts/animations/ModalTransition.vue";
import { jsPDF } from "jspdf";
import { parse } from "node-html-parser";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { saveAs } from "file-saver";

// Store instances
const documentStore = useDynamicDocumentStore();
const userStore = useUserStore();

// State variables
const showPreviewModal = ref(false);
const previewDocumentTitle = ref("");
const previewDocumentContent = ref("");

// Fetch data on mount
onMounted(() => {
  documentStore.fetchDocuments();
  userStore.init();
});

// Computed properties
const progressDocuments = computed(() => {
  return documentStore.progressDocumentsByClient(userStore.getCurrentUser?.id);
});

// Options for the document menu
const documentEditingOptions = [
  { label: "Completar", action: "complete" },
  { label: "Previsualización", action: "preview" },
  { label: "Descargar PDF", action: "downloadPDF" },
  { label: "Descargar Word", action: "downloadWord" },
];

/**
 * Handle click event on document options.
 * @param {object} option - The selected option.
 * @param {object} document - The document related to the option.
 */
const handleOptionClick = (option, document) => {
  switch (option.action) {
    case "complete":
      completeDocument(document);
      break;
    case "preview":
      openPreviewModal(document);
      break;
    case "downloadPDF":
      downloadPDFDocument(document);
      break;
    case "downloadWord":
      downloadWordDocument(document);
      break;
    default:
      console.warn("Unknown action:", option.action);
  }
};

/**
 * Mark the document as completed.
 * @param {object} document - The document to complete.
 */
const completeDocument = async (document) => {
  try {
    const updatedData = { ...document, state: "Completed" };
    await documentStore.updateDocument(document.id, updatedData);
    alert("Documento marcado como completado.");
  } catch (error) {
    console.error("Error completing document:", error);
  }
};

/**
 * Open the preview modal for the document.
 * @param {object} document - The document to preview.
 */
const openPreviewModal = (document) => {
  previewDocumentTitle.value = document.title;

  // Reemplazar las variables en el contenido
  let processedContent = document.content;
  document.variables.forEach((variable) => {
    const regex = new RegExp(`{{\\s*${variable.name_en}\\s*}}`, "g");
    processedContent = processedContent.replace(regex, variable.value || "");
  });

  // Parsear el contenido HTML
  const root = parse(processedContent);
  previewDocumentContent.value = root.toString();

  showPreviewModal.value = true;
};

/**
 * Close the preview modal.
 */
const closePreviewModal = () => {
  showPreviewModal.value = false;
};

/**
 * Download the document as a PDF.
 * @param {object} doc - The document to download.
 */
const downloadPDFDocument = (doc) => {
  try {
    let processedContent = doc.content;
    doc.variables.forEach((variable) => {
      const regex = new RegExp(`{{\\s*${variable.name_en}\\s*}}`, "g");
      processedContent = processedContent.replace(regex, variable.value || "");
    });

    const root = parse(processedContent);
    const plainTextContent = root.innerText;

    const pdf = new jsPDF();
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    const pageWidth = pdf.internal.pageSize.getWidth() - 20;
    const textLines = pdf.splitTextToSize(plainTextContent, pageWidth);
    pdf.text(textLines, 10, 10);

    pdf.save(`${doc.title}.pdf`);
  } catch (error) {
    console.error("Error generating PDF:", error);
  }
};

/**
 * Download the document as a Word file.
 * @param {object} doc - The document to download.
 */
const downloadWordDocument = (doc) => {
  try {
    let processedContent = doc.content;
    doc.variables.forEach((variable) => {
      const regex = new RegExp(`{{${variable.name_en}}}`, "g");
      processedContent = processedContent.replace(regex, variable.value || "");
    });

    const parser = new DOMParser();
    const parsedHtml = parser.parseFromString(processedContent, "text/html");
    const textContent = parsedHtml.body.innerText;

    const docxDocument = new Document({
      sections: [
        {
          properties: {},
          children: [
            new Paragraph({
              children: [new TextRun({ text: textContent, font: "Arial", size: 24 })],
            }),
          ],
        },
      ],
    });

    Packer.toBlob(docxDocument).then((blob) => {
      saveAs(blob, `${doc.title}.docx`);
    });
  } catch (error) {
    console.error("Error generating Word document:", error);
  }
};

/**
 * Get the client's name by user ID.
 * @param {number} clientId - The ID of the client.
 * @returns {string} - The client's full name.
 */
const getClientName = (clientId) => {
  const client = userStore.userById(clientId);
  return client ? `${client.first_name} ${client.last_name}` : "Desconocido";
};
</script>
