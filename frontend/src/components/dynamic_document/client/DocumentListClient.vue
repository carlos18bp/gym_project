<template>
  <div class="mt-8 flex flex-wrap gap-6">
    <!-- Document Item -->
    <div
      v-for="document in filteredDocuments"
      :key="document.id"
      class="flex items-center gap-3 py-2 px-4 border rounded-xl cursor-pointer"
      :class="{
        'border-green-400 bg-green-300/30': document.state === 'Completed',
        'border-stroke bg-white': document.state === 'Progress'
      }"
    >
      <component
        :is="document.state === 'Completed' ? CheckCircleIcon : PencilIcon"
        class="size-6"
        :class="{
          'text-green-500': document.state === 'Completed',
          'text-secondary': document.state === 'Progress'
        }"
      />
      <div class="grid gap-1">
        <span class="text-base font-medium">{{ document.title }}</span>
        <span class="text-sm font-regular text-gray-400">{{ document.description }}</span>
      </div>
      <Menu as="div" class="relative inline-block text-left">
        <MenuButton class="flex items-center text-gray-400">
          <EllipsisVerticalIcon class="size-6" aria-hidden="true" />
        </MenuButton>
        <transition
          enter-active-class="transition ease-out duration-100"
          enter-from-class="transform opacity-0 scale-95"
          enter-to-class="transform opacity-100 scale-100"
          leave-active-class="transition ease-in duration-75"
          leave-from-class="transform opacity-100 scale-100"
          leave-to-class="transform opacity-0 scale-95"
        >
          <MenuItems class="absolute left-0 z-10 mt-2 w-56 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black/5 focus:outline-none">
            <div class="py-1">
              <!-- Edit/Complete option -->
              <MenuItem>
                <button
                  class="block w-full text-left px-4 py-2 text-sm font-regular hover:bg-gray-100 transition"
                  @click="openEditModal(document)"
                >
                  {{ document.state === 'Completed' ? 'Editar' : 'Completar' }}
                </button>
              </MenuItem>

              <!-- Preview option -->
              <MenuItem>
                <button
                  class="block w-full text-left px-4 py-2 text-sm font-regular hover:bg-gray-100 transition"
                  @click="previewDocument(document)"
                >
                  Previsualizar
                </button>
              </MenuItem>

              <!-- Delete option -->
              <MenuItem>
                <button
                  class="block w-full text-left px-4 py-2 text-sm font-regular hover:bg-gray-100 transition"
                  @click="deleteDocument(document)"
                >
                  Eliminar
                </button>
              </MenuItem>

              <!-- Options only for Completed state -->
              <template v-if="document.state === 'Completed'">
                <MenuItem>
                  <button
                    class="block w-full text-left px-4 py-2 text-sm font-regular hover:bg-gray-100 transition"
                    @click="downloadPDFDocument(document)"
                  >
                    Descargar PDF
                  </button>
                </MenuItem>
                <MenuItem>
                  <button
                    class="block w-full text-left px-4 py-2 text-sm font-regular hover:bg-gray-100 transition"
                    @click="downloadWordDocument(document)"
                  >
                    Descargar Word
                  </button>
                </MenuItem>
                <MenuItem>
                  <button
                    class="block w-full text-left px-4 py-2 text-sm font-regular hover:bg-gray-100 transition"
                    @click="sendDocument(document)"
                  >
                    Enviar
                  </button>
                </MenuItem>
              </template>
            </div>
          </MenuItems>
        </transition>
      </Menu>
    </div>

    <!-- No documents message -->
    <div
      v-if="filteredDocuments.length === 0"
      class="mt-6 flex flex-col items-center justify-center text-center text-gray-500 w-full"
    >
      <p class="text-lg font-semibold">No hay documentos disponibles para mostrar.</p>
      <p class="text-sm">Contacta a tu abogado para gestionar tus documentos.</p>
    </div>

    <!-- Edit Document Modal -->
    <ModalTransition v-show="showEditDocumentModal">
      <UseDocumentByClient
        :document-id="selectedDocumentId"
        @close="closeEditModal"
      />
    </ModalTransition>
  </div>

  <!-- Preview Modal -->
  <ModalTransition v-show="showPreviewModal">
    <div class="bg-white rounded-lg p-6 shadow-xl max-w-4xl w-full mx-auto">
      <div class="flex justify-between items-center border-b pb-2 mb-4">
        <!-- Título del documento -->
        <h2 class="text-xl font-semibold text-primary">
          Previsualización del Documento: {{ documentTitle }}
        </h2>

        <!-- Botón para cerrar el modal -->
        <button @click="showPreviewModal = false">
          <XMarkIcon class="size-6 text-gray-500 hover:text-secondary cursor-pointer" />
        </button>
      </div>

      <!-- Contenido del documento -->
      <div class="prose max-w-none overflow-y-auto max-h-[60vh]">
        <div v-html="previewContent"></div>
      </div>
    </div>
  </ModalTransition>
</template>

<script setup>
import {
  CheckCircleIcon,
  EllipsisVerticalIcon,
  PencilIcon,
  XMarkIcon ,
} from "@heroicons/vue/24/outline";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/vue";
import ModalTransition from "@/components/layouts/animations/ModalTransition.vue";
import UseDocumentByClient from "@/components/dynamic_document/client/modals/UseDocumentByClient.vue";
import { computed, ref } from "vue";
import { useDynamicDocumentStore } from "@/stores/dynamicDocument";
import { useUserStore } from "@/stores/user";

import { jsPDF } from "jspdf";
import { parse } from "node-html-parser";
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { saveAs } from 'file-saver';

// Store instances
const documentStore = useDynamicDocumentStore();
const userStore = useUserStore();

// Reactive state
const currentUser = computed(() => userStore.getCurrentUser);
const showEditDocumentModal = ref(false);
const selectedDocumentId = ref(null);

// Filter documents
const filteredDocuments = computed(() => {
  return documentStore.documents.filter(
    (doc) =>
      doc.assigned_to === currentUser.value.id &&
      (doc.state === "Progress" || doc.state === "Completed")
  );
});

/**
 * Open the edit modal for the selected document.
 * @param {object} document - The document to edit or complete.
 */
const openEditModal = (document) => {
  documentStore.selectedDocument = document; // Set selected document in the store
  selectedDocumentId.value = document.id;
  showEditDocumentModal.value = true;
};

/**
 * Close the edit modal and clear the selected document.
 */
const closeEditModal = () => {
  showEditDocumentModal.value = false;
  documentStore.clearSelectedDocument();
};


const showPreviewModal = ref(false);
const previewContent = ref('');
const documentTitle = ref('');

const previewDocument = (doc) => {
  try {
    // Reemplazar las variables en el contenido
    let processedContent = doc.content;
    doc.variables.forEach((variable) => {
      const regex = new RegExp(`{{\\s*${variable.name_en}\\s*}}`, 'g');
      processedContent = processedContent.replace(regex, variable.value || '');
    });

    // Asignar el contenido procesado y el título al modal
    previewContent.value = processedContent;
    documentTitle.value = doc.title;
    showPreviewModal.value = true;  // Mostrar el modal
  } catch (error) {
    console.error('Error previewing document:', error);
  }
};


/**
 * Delete the document.
 * @param {object} document - The document to delete.
 */
const deleteDocument = async (document) => {
  if (confirm(`¿Deseas eliminar el documento "${document.title}"?`)) {
    await documentStore.deleteDocument(document.id);
    alert("Documento eliminado exitosamente.");
  }
};

/**
 * Download the document in the specified format (PDF or Word).
 * @param {object} doc - The document to download.
 * @param {string} format - The format to download ('pdf' or 'word').
 */
const downloadPDFDocument = (doc) => {
  try {
    // Reemplazar las variables en el contenido
    let processedContent = doc.content;
    doc.variables.forEach((variable) => {
      const regex = new RegExp(`{{\\s*${variable.name_en}\\s*}}`, 'g');
      processedContent = processedContent.replace(regex, variable.value || '');
    });

    // Parsear el contenido HTML
    const root = parse(processedContent);
    const plainTextContent = root.innerText;  // Convierte HTML a texto plano

    // Crear el PDF
    const pdf = new jsPDF();

    // Configuración de fuente
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);

    // Dividir el contenido en líneas ajustadas al ancho del PDF
    const pageWidth = pdf.internal.pageSize.getWidth() - 20;  // Ancho de página con márgenes
    const textLines = pdf.splitTextToSize(plainTextContent, pageWidth);

    // Añadir texto al PDF
    pdf.text(textLines, 10, 10);

    // Descargar el archivo
    pdf.save(`${doc.title}.pdf`);
  } catch (error) {
    console.error("Error generating PDF:", error);
  }
};


const downloadWordDocument = (doc) => {
  try {
    // Reemplazar variables en el contenido
    let content = doc.content;
    doc.variables.forEach(variable => {
      const regex = new RegExp(`{{${variable.name_en}}}`, 'g');
      content = content.replace(regex, variable.value || '');
    });

    // Convertir el contenido HTML en texto plano para el documento Word
    const parser = new DOMParser();
    const parsedHtml = parser.parseFromString(content, 'text/html');
    const textContent = parsedHtml.body.innerText;

    // Crear un documento Word con el contenido procesado
    const docxDocument = new Document({
      sections: [
        {
          properties: {},
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: textContent,
                  font: 'Arial',
                  size: 24, // Tamaño de la fuente en puntos (24 equivale a 12pt)
                }),
              ],
            }),
          ],
        },
      ],
    });

    // Empaquetar el documento y descargarlo
    Packer.toBlob(docxDocument).then((blob) => {
      saveAs(blob, `${doc.title}.docx`);
    });
  } catch (error) {
    console.error('Error downloading Word document:', error);
  }
};


/**
 * Send the document (placeholder function).
 * @param {object} document - The document to send.
 */
const sendDocument = (document) => {
  console.log(`Sending document: ${document.title}`);
};
</script>
