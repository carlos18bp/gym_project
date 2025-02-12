import { ref } from "vue";
import { jsPDF } from "jspdf";
import { parse } from "node-html-parser";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { saveAs } from "file-saver";

// Reactive state for document preview modal
export const showPreviewModal = ref(false);
export const previewDocumentData = ref({ title: "", content: "" });

/**
 * Opens the preview modal with processed document content.
 * @param {Object} document - The document to preview.
 */
export const openPreviewModal = (document) => {
  let processedContent = document.content;
  document.variables.forEach((variable) => {
    const regex = new RegExp(`{{\s*${variable.name_en}\s*}}`, "g");
    processedContent = processedContent.replace(regex, variable.value) || "";
  });

  previewDocumentData.value = {
    title: document.title,
    content: document.assigned_to ? processedContent : document.content,
  };
  showPreviewModal.value = true;
};

/**
 * Downloads the document as a PDF.
 * @param {Object} doc - The document to download.
 */
export const downloadPDFDocument = (doc) => {
  try {
    let processedContent = doc.content;
    doc.variables.forEach((variable) => {
      const regex = new RegExp(`{{\s*${variable.name_en}\s*}}`, "g");
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
 * Downloads the document as a Word file.
 * @param {Object} doc - The document to download.
 */
export const downloadWordDocument = (doc) => {
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
              children: [
                new TextRun({ text: textContent, font: "Arial", size: 24 }),
              ],
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
